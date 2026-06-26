import pg from "pg";
import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@shared/schema";
import { storage, seedDatabase, type BackupSnapshot } from "./storage";
import { pool } from "./db";
import { log } from "./vite";

const SYNC_SETTING_KEY = "last_prod_sync_at";

export function isProdSyncConfigured(): boolean {
  return !!process.env.RAILWAY_DATABASE_URL;
}

/**
 * The sync pulls production data INTO this environment, overwriting it. It must
 * never run on the production deployment itself, and never read from and write
 * to the same database.
 */
export function assertSyncAllowed(): void {
  if (!process.env.RAILWAY_DATABASE_URL) {
    throw new Error("Production sync is not configured (RAILWAY_DATABASE_URL is not set).");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production sync is disabled in the production environment.");
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === process.env.RAILWAY_DATABASE_URL) {
    throw new Error("Refusing to sync: the source and destination databases are identical.");
  }
}

export async function getLastSyncAt(): Promise<string | null> {
  return storage.getSetting(SYNC_SETTING_KEY);
}

/**
 * A robust identity of a Postgres database: the cluster's system identifier plus
 * the current database name. Two different connection strings that point at the
 * same physical database will produce the same identity even if their URLs
 * differ textually (proxy vs direct host, reordered params, etc.).
 */
async function getDbIdentity(querier: {
  query: (text: string) => Promise<{ rows: Array<{ sysid: string | null; db: string | null }> }>;
}): Promise<string> {
  const r = await querier.query(
    "SELECT (SELECT system_identifier::text FROM pg_control_system()) AS sysid, current_database() AS db",
  );
  const row = r.rows[0];
  return `${row?.sysid ?? "unknown"}::${row?.db ?? "unknown"}`;
}

/**
 * Refuse to proceed unless the source (production) and destination (this env)
 * are provably different physical databases. Fails closed: any error, or an
 * inability to determine a distinct identity for both, blocks the sync.
 */
async function assertDistinctDatabases(): Promise<void> {
  const sourcePool = new pg.Pool({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  try {
    const [sourceId, destId] = await Promise.all([getDbIdentity(sourcePool), getDbIdentity(pool)]);
    if (sourceId === destId) {
      throw new Error(
        `Refusing to sync: source and destination resolve to the same database (${sourceId}).`,
      );
    }
  } finally {
    await sourcePool.end();
  }
}

/**
 * Read every row of a production table with `SELECT *`, then map raw DB column
 * names to the Drizzle schema property names. Columns present in production but
 * absent from the local schema are dropped; columns present locally but absent
 * in production are simply omitted (the local insert uses their defaults/null).
 * This keeps the sync working even when the two schemas have drifted.
 */
async function readTable<T>(client: pg.PoolClient, table: PgTable): Promise<T[]> {
  const columns = getTableColumns(table);
  const dbNameToProp = new Map<string, string>();
  for (const [prop, col] of Object.entries(columns)) {
    dbNameToProp.set((col as { name: string }).name, prop);
  }

  const dbTableName = getTableName(table);

  const result = await client.query(`SELECT * FROM "${dbTableName}"`);
  return result.rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const [dbName, value] of Object.entries(row)) {
      const prop = dbNameToProp.get(dbName);
      if (prop !== undefined) mapped[prop] = value;
    }
    return mapped as T;
  });
}

async function readProductionSnapshot(): Promise<BackupSnapshot> {
  const sourcePool = new pg.Pool({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  const client = await sourcePool.connect();

  try {
    return {
      spus: await readTable(client, schema.spus),
      subUnits: await readTable(client, schema.subUnits),
      years: await readTable(client, schema.years),
      staff: await readTable(client, schema.staff),
      okrs: await readTable(client, schema.okrs),
      quarterlyUpdates: await readTable(client, schema.quarterlyUpdates),
      okrResponsibilities: await readTable(client, schema.okrResponsibilities),
      staffSpuAssignments: await readTable(client, schema.staffSpuAssignments),
      leaderBasicAssignments: await readTable(client, schema.leaderBasicAssignments),
      universityObjectives: await readTable(client, schema.universityObjectives),
      universityKeyResults: await readTable(client, schema.universityKeyResults),
      universityKeyResultProgress: await readTable(client, schema.universityKeyResultProgress),
      universityObjectiveComments: await readTable(client, schema.universityObjectiveComments),
      universityProgressDatapoints: await readTable(client, schema.universityProgressDatapoints),
      analyticsDashboards: await readTable(client, schema.analyticsDashboards),
      analyticsWidgets: await readTable(client, schema.analyticsWidgets),
      appSettings: await readTable(client, schema.appSettings),
    };
  } finally {
    client.release();
    await sourcePool.end();
  }
}

export type ProdSyncResult = {
  syncedAt: string;
  counts: Record<string, number>;
};

/**
 * Pull production data and replace all editable-data tables in this environment.
 * Re-seeds super-admin accounts afterward so a wipe can never lock anyone out.
 */
export async function syncFromProduction(): Promise<ProdSyncResult> {
  assertSyncAllowed();
  await assertDistinctDatabases();

  log("[prod-sync] Reading production snapshot from Railway...");
  const snapshot = await readProductionSnapshot();

  const counts: Record<string, number> = {};
  for (const [table, rows] of Object.entries(snapshot)) {
    counts[table] = Array.isArray(rows) ? rows.length : 0;
  }

  log(`[prod-sync] Replacing local data (okrs=${counts.okrs ?? 0}, staff=${counts.staff ?? 0})...`);
  await storage.replaceAllData(snapshot);

  // Guarantee super-admin access in this environment regardless of source data.
  await seedDatabase();

  const syncedAt = new Date().toISOString();
  await storage.setSetting(SYNC_SETTING_KEY, syncedAt);
  log(`[prod-sync] Completed at ${syncedAt}`);

  return { syncedAt, counts };
}

/**
 * Run a sync on startup only if it has been more than 24h since the last one.
 */
export async function syncFromProductionIfStale(): Promise<void> {
  if (!isProdSyncConfigured() || process.env.NODE_ENV === "production") return;

  try {
    const last = await getLastSyncAt();
    const stale = !last || Date.now() - new Date(last).getTime() > 24 * 60 * 60 * 1000;
    if (!stale) {
      log("[prod-sync] Skipping startup sync (last sync < 24h ago).");
      return;
    }
    await syncFromProduction();
  } catch (err) {
    console.error("[prod-sync] Startup sync failed:", err);
  }
}
