import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cron from "node-cron";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase, storage } from "./storage";
import { pool } from "./db";

const PgSession = connectPgSimple(session);

async function runStartupMigrations() {
  const client = await pool.connect();
  // Run each migration independently so one failure never blocks the others.
  const migrations = [
    // ── Table creation (safe on existing DBs due to IF NOT EXISTS) ──────────
    `CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    )`,
    `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`,
    `CREATE TABLE IF NOT EXISTS invite_tokens (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id VARCHAR NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS analytics_dashboards (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS analytics_widgets (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      dashboard_id VARCHAR NOT NULL REFERENCES analytics_dashboards(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      chart_type TEXT NOT NULL,
      data_source TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      width TEXT NOT NULL DEFAULT 'full'
    )`,
    `CREATE TABLE IF NOT EXISTS university_key_result_progress (
      key_result_id VARCHAR PRIMARY KEY REFERENCES university_key_results(id) ON DELETE CASCADE,
      progress_percent INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS university_objective_comments (
      objective_id VARCHAR PRIMARY KEY REFERENCES university_objectives(id) ON DELETE CASCADE,
      comment TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS university_progress_datapoints (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      key_result_id VARCHAR NOT NULL REFERENCES university_key_results(id) ON DELETE CASCADE,
      quarter TEXT NOT NULL,
      year INTEGER NOT NULL,
      progress_percent INTEGER NOT NULL DEFAULT 0
    )`,
    // ── Column additions (IF NOT EXISTS guards against re-runs) ─────────────
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS hashed_password TEXT`,
    `ALTER TABLE invite_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMP`,
    `ALTER TABLE okrs ADD COLUMN IF NOT EXISTS collaboration_spu_ids text[] DEFAULT ARRAY[]::text[]`,
    `UPDATE okrs SET collaboration_spu_ids = ARRAY[collaboration_spu_id]::text[] WHERE collaboration_spu_id IS NOT NULL AND (collaboration_spu_ids IS NULL OR collaboration_spu_ids = ARRAY[]::text[])`,
    // ── De-dupe staff_spu_assignments before adding unique index ─────────────
    `DELETE FROM staff_spu_assignments a USING staff_spu_assignments b
       WHERE a.ctid < b.ctid
         AND a.staff_id = b.staff_id
         AND a.spu_id = b.spu_id
         AND COALESCE(a.sub_unit_id, '') = COALESCE(b.sub_unit_id, '')`,
    `CREATE UNIQUE INDEX IF NOT EXISTS staff_spu_assignments_unique_idx
       ON staff_spu_assignments (staff_id, spu_id, COALESCE(sub_unit_id, ''))`,
    `CREATE TABLE IF NOT EXISTS data_backups (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL,
      backup_type TEXT NOT NULL DEFAULT 'manual',
      snapshot JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE data_backups ALTER COLUMN snapshot TYPE JSONB USING snapshot::JSONB`,
  ];
  let failed = 0;
  for (const sql of migrations) {
    try {
      await client.query(sql);
    } catch (err: any) {
      failed++;
      console.error("startup migration skipped:", err.message.split('\n')[0]);
    }
  }
  client.release();
  if (failed === 0) {
    log("startup migrations: OK");
  } else {
    log(`startup migrations: OK (${failed} skipped — see above)`);
  }
}

const app = express();

// Trust Railway/Heroku/Render proxy so secure session cookies work behind HTTPS load balancers
app.set('trust proxy', 1);

declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
    selectedStaffId?: string;
    selectedStaffName?: string;
    sessionVersion?: number;
    ssoState?: string;
    ssoCodeVerifier?: string;
  }
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run schema migrations before anything else so every environment
  // (Replit, Railway, Render, etc.) stays in sync automatically.
  await runStartupMigrations();

  const server = await registerRoutes(app);

  // Seed core super-admin accounts on every startup
  await seedDatabase();

  // Schedule daily automatic backup at midnight server time
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();
      const label = `Daily Backup — ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
      await storage.createBackup(label, "automatic");
      log(`[backup] Daily automatic backup created: ${label}`);

      // Prune backups older than 30 days
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const pruned = await storage.deleteBackupsOlderThan(cutoff);
      if (pruned > 0) {
        log(`[backup] Pruned ${pruned} backup(s) older than 30 days`);
      }
    } catch (err) {
      console.error("[backup] Daily backup failed:", err);
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
