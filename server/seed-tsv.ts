import { readFileSync } from "fs";
import { resolve } from "path";
import { db } from "./db";
import { spus, subUnits, staff, okrs, quarterlyUpdates, years } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const SUPER_ADMIN_EMAILS = [
  "amanda.harris@macu.edu",
  "phil.greenwald@macu.edu",
  "garrett.finnell@macu.edu",
];

function parseTsv(filePath: string): string[][] {
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.split("\t").map((cell) => cell.trim()));
}

function parseQuarterString(quarterStr: string): { quarter: string; year: number } | null {
  // Handles both "Q1: June 2024 - August 2024" and "Y2:Q1: June 2025 - August 2025"
  const match = quarterStr.match(/(?:Y\d+:)?(Q[1-4]):\s+\w+\s+(\d{4})/);
  if (!match) return null;
  return { quarter: match[1], year: parseInt(match[2], 10) };
}

function parseScore(val: string): number | null {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : Math.max(0, Math.min(100, n));
}

async function buildCanonicalSpuSet(): Promise<Map<string, string>> {
  const allSpus = await db.select().from(spus);
  const cache = new Map<string, string>();
  for (const s of allSpus) {
    cache.set(s.name.toLowerCase(), s.id);
  }
  return cache;
}

async function findOrCreateSpu(
  spuCache: Map<string, string>,
  name: string
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (spuCache.has(lower)) return spuCache.get(lower)!;
  const existing = await db.select().from(spus).where(eq(spus.name, trimmed));
  if (existing.length > 0) {
    spuCache.set(lower, existing[0].id);
    return existing[0].id;
  }
  const [created] = await db.insert(spus).values({ name: trimmed }).returning();
  spuCache.set(lower, created.id);
  return created.id;
}

async function findOrCreateSubUnit(
  subUnitCache: Map<string, string>,
  name: string,
  spuId: string
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const cacheKey = `${spuId}::${trimmed.toLowerCase()}`;
  if (subUnitCache.has(cacheKey)) return subUnitCache.get(cacheKey)!;
  const existing = await db
    .select()
    .from(subUnits)
    .where(and(eq(subUnits.name, trimmed), eq(subUnits.spuId, spuId)));
  if (existing.length > 0) {
    subUnitCache.set(cacheKey, existing[0].id);
    return existing[0].id;
  }
  const [created] = await db.insert(subUnits).values({ name: trimmed, spuId }).returning();
  subUnitCache.set(cacheKey, created.id);
  return created.id;
}

async function findOrCreateStaff(
  staffCache: Map<string, string>,
  name: string,
  email: string,
  spuId: string
): Promise<string> {
  const emailLower = email.toLowerCase();
  if (staffCache.has(emailLower)) return staffCache.get(emailLower)!;
  const existing = await db.select().from(staff).where(eq(staff.email, emailLower));
  if (existing.length > 0) {
    staffCache.set(emailLower, existing[0].id);
    return existing[0].id;
  }
  const [created] = await db
    .insert(staff)
    .values({
      name: name.trim(),
      email: emailLower,
      spuId,
      isAdmin: false,
      role: "basic",
    })
    .returning();
  staffCache.set(emailLower, created.id);
  return created.id;
}

async function findOrCreateYear(
  yearCache: Map<number, string>,
  year: number
): Promise<string> {
  if (yearCache.has(year)) return yearCache.get(year)!;
  const existing = await db.select().from(years).where(eq(years.year, year));
  if (existing.length > 0) {
    yearCache.set(year, existing[0].id);
    return existing[0].id;
  }
  const [created] = await db.insert(years).values({ year }).returning();
  yearCache.set(year, created.id);
  return created.id;
}

async function resolveCollabSpu(
  canonicalSpuCache: Map<string, string>,
  name: string
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  // Only resolve to SPUs that already exist in the canonical set (from SPU TSV)
  if (canonicalSpuCache.has(lower)) return canonicalSpuCache.get(lower)!;
  return null;
}

async function seedSpusFromFile(
  spuCache: Map<string, string>,
  subUnitCache: Map<string, string>
): Promise<void> {
  console.log("Seeding SPUs and sub-units from SPU TSV...");
  const rows = parseTsv(
    resolve("attached_assets/Full_SPU_and_Sub_Unit_List_-_SPU_Naming_Conventions_1775150686007.tsv")
  );

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const spuName = row[0]?.trim();
    const subUnitName = row[1]?.trim();
    if (!spuName) continue;

    const spuId = await findOrCreateSpu(spuCache, spuName);
    if (!spuId) continue;

    if (subUnitName) {
      await findOrCreateSubUnit(subUnitCache, subUnitName, spuId);
    }
  }

  const totalSpus = await db.select().from(spus);
  const totalSubUnits = await db.select().from(subUnits);
  console.log(`  SPUs in DB: ${totalSpus.length}`);
  console.log(`  Sub-units in DB: ${totalSubUnits.length}`);
}

async function seedOkrsFromFile(
  spuCache: Map<string, string>,
  subUnitCache: Map<string, string>,
  staffCache: Map<string, string>,
  yearCache: Map<number, string>
): Promise<void> {
  console.log("Seeding OKRs from OKR TSV...");
  const rows = parseTsv(
    resolve("attached_assets/Final_OKR_Data_Set_Complete_5.31.24-present_-_Form_Responses_1_1775150412561.tsv")
  );

  // Build a canonical SPU cache (only SPUs from the SPU TSV) to use for collab SPU resolution
  const canonicalSpuCache = await buildCanonicalSpuSet();

  let okrCreated = 0;
  let updateCreated = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) {
      skipped++;
      continue;
    }

    const timestamp = row[0]?.trim();
    const email = row[1]?.trim();
    const submitterName = row[2]?.trim();
    const quarterStr = row[3]?.trim();
    const okrNumber = row[4]?.trim();
    const spuName = row[5]?.trim();
    const subUnitName = row[6]?.trim();
    const collabSpu1 = row[7]?.trim();
    const collabSpu2 = row[8]?.trim();
    const collabSpu3 = row[9]?.trim();
    const collabSpu4 = row[10]?.trim();
    const collabSpu5 = row[11]?.trim();
    const universityObjective = row[12]?.trim();
    const universityKeyResult = row[13]?.trim();
    const objectiveStatement = row[14]?.trim();
    const kr1 = row[15]?.trim();
    const kr2 = row[16]?.trim();
    const kr3 = row[17]?.trim();
    const kr4 = row[18]?.trim();
    const kr5 = row[19]?.trim();
    const kr6 = row[20]?.trim();
    const scoreKr1 = row[21]?.trim();
    const scoreKr2 = row[22]?.trim();
    const scoreKr3 = row[23]?.trim();
    const scoreKr4 = row[24]?.trim();
    const scoreKr5 = row[25]?.trim();
    const scoreKr6 = row[26]?.trim();
    const comments = row[27]?.trim();

    if (!quarterStr || !spuName || !objectiveStatement) {
      skipped++;
      continue;
    }

    const parsed = parseQuarterString(quarterStr);
    if (!parsed) {
      console.warn(`  Row ${i + 1}: Could not parse quarter "${quarterStr}", skipping`);
      skipped++;
      continue;
    }

    const { quarter, year } = parsed;

    const spuId = await findOrCreateSpu(spuCache, spuName);
    if (!spuId) {
      skipped++;
      continue;
    }

    let subUnitId: string | null = null;
    if (subUnitName) {
      subUnitId = await findOrCreateSubUnit(subUnitCache, subUnitName, spuId);
    }

    await findOrCreateYear(yearCache, year);

    let staffId: string | null = null;
    if (email && submitterName) {
      const emailLower = email.toLowerCase();
      if (SUPER_ADMIN_EMAILS.includes(emailLower)) {
        // Super-admin: look up by email without creating a new record
        const existing = await db.select().from(staff).where(eq(staff.email, emailLower));
        if (existing.length > 0) {
          staffId = existing[0].id;
          staffCache.set(emailLower, existing[0].id);
        } else {
          console.warn(`  Row ${i + 1}: Super-admin ${emailLower} not in DB, OKR will have null staffId`);
        }
      } else {
        staffId = await findOrCreateStaff(staffCache, submitterName, email, spuId);
      }
    }

    const keyResultsArr: { keyResultNumber: number; description: string }[] = [];
    const krStatements = [kr1, kr2, kr3, kr4, kr5, kr6];
    for (let k = 0; k < krStatements.length; k++) {
      if (krStatements[k]) {
        keyResultsArr.push({ keyResultNumber: k + 1, description: krStatements[k] });
      }
    }
    const keyResultsJson = JSON.stringify(
      keyResultsArr.length > 0
        ? keyResultsArr
        : [{ keyResultNumber: 1, description: objectiveStatement.substring(0, 200) }]
    );

    // Resolve collaboration SPUs only against canonical SPUs (avoid creating duplicates)
    const collabSpuIds: string[] = [];
    for (const cName of [collabSpu1, collabSpu2, collabSpu3, collabSpu4, collabSpu5]) {
      if (cName) {
        const cId = await resolveCollabSpu(canonicalSpuCache, cName);
        if (cId) collabSpuIds.push(cId);
      }
    }

    const okrNumberClean = okrNumber || "OKR 1";

    const existingOkrs = await db
      .select()
      .from(okrs)
      .where(
        and(
          eq(okrs.quarter, quarter),
          eq(okrs.year, year),
          eq(okrs.spuId, spuId),
          eq(okrs.okrNumber, okrNumberClean),
          eq(okrs.objectiveStatement, objectiveStatement)
        )
      );

    let okrId: string;
    if (existingOkrs.length > 0) {
      okrId = existingOkrs[0].id;
    } else {
      const [createdOkr] = await db
        .insert(okrs)
        .values({
          staffId: staffId || null,
          submitterName: submitterName || null,
          spuId,
          subUnitId: subUnitId || null,
          okrNumber: okrNumberClean,
          quarter,
          year,
          collaborationSpuId: collabSpuIds[0] || null,
          collaborationSpuIds: collabSpuIds,
          universityObjective: universityObjective || "",
          universityKeyResult: universityKeyResult || "",
          objectiveStatement,
          keyResults: keyResultsJson,
          currentValue: 0,
          status: "not_started",
          submissionTimestamp: timestamp || null,
        })
        .returning();
      okrId = createdOkr.id;
      okrCreated++;
    }

    // Build KR scores from the row
    const krScores: { keyResultNumber: number; description: string; score: number }[] = [];
    const scoreVals = [scoreKr1, scoreKr2, scoreKr3, scoreKr4, scoreKr5, scoreKr6];
    for (let k = 0; k < scoreVals.length; k++) {
      const score = parseScore(scoreVals[k] || "");
      const krDesc = krStatements[k];
      if (score !== null) {
        krScores.push({ keyResultNumber: k + 1, description: krDesc || "", score });
      }
    }

    const avgScore =
      krScores.length > 0
        ? Math.round(krScores.reduce((s, kr) => s + kr.score, 0) / krScores.length)
        : null;

    const progress = avgScore ?? 0;
    const notesText = comments && comments.length > 0 ? comments : "No comments provided";

    // Always create one quarterly update per OKR row
    const existingUpdate = await db
      .select()
      .from(quarterlyUpdates)
      .where(
        and(
          eq(quarterlyUpdates.okrId, okrId),
          eq(quarterlyUpdates.quarter, quarter),
          eq(quarterlyUpdates.year, year),
          eq(quarterlyUpdates.isPrimaryScore, true)
        )
      );

    if (existingUpdate.length === 0) {
      await db.insert(quarterlyUpdates).values({
        okrId,
        staffId: staffId || null,
        scorerName: submitterName || null,
        quarter,
        year,
        progress,
        keyResultScores: krScores.length > 0 ? JSON.stringify(krScores) : null,
        averageScore: avgScore,
        notes: notesText,
        isPrimaryScore: true,
        isCollaborativeScore: false,
      });
      updateCreated++;
    }
  }

  console.log(`  OKRs created: ${okrCreated}`);
  console.log(`  Quarterly updates created: ${updateCreated}`);
  console.log(`  Rows skipped: ${skipped}`);
}

async function verifySuperAdmins(): Promise<void> {
  for (const email of SUPER_ADMIN_EMAILS) {
    const existing = await db.select().from(staff).where(eq(staff.email, email));
    if (existing.length === 0) {
      console.warn(`  WARNING: Super-admin ${email} not found in database`);
    } else {
      const s = existing[0];
      if (!s.isAdmin) {
        console.warn(`  WARNING: ${email} exists but isAdmin=false — preserving existing record without modification`);
      } else {
        console.log(`  OK: Super-admin ${email} (${s.name}) is present`);
      }
    }
  }
}

async function seed() {
  console.log("=== TSV Seed Script ===");
  console.log("Starting database seeding from TSV files...\n");

  console.log("Verifying super-admin accounts...");
  await verifySuperAdmins();
  console.log();

  const spuCache = new Map<string, string>();
  const subUnitCache = new Map<string, string>();
  const staffCache = new Map<string, string>();
  const yearCache = new Map<number, string>();

  const existingSpus = await db.select().from(spus);
  for (const s of existingSpus) {
    spuCache.set(s.name.toLowerCase(), s.id);
  }

  const existingSubUnits = await db.select().from(subUnits);
  for (const su of existingSubUnits) {
    subUnitCache.set(`${su.spuId}::${su.name.toLowerCase()}`, su.id);
  }

  const existingStaff = await db.select().from(staff);
  for (const s of existingStaff) {
    staffCache.set(s.email.toLowerCase(), s.id);
  }

  const existingYears = await db.select().from(years);
  for (const y of existingYears) {
    yearCache.set(y.year, y.id);
  }

  console.log(
    `Loaded caches: ${spuCache.size} SPUs, ${subUnitCache.size} sub-units, ${staffCache.size} staff, ${yearCache.size} years\n`
  );

  await seedSpusFromFile(spuCache, subUnitCache);
  console.log();
  await seedOkrsFromFile(spuCache, subUnitCache, staffCache, yearCache);
  console.log();

  const finalSpus = await db.select().from(spus);
  const finalSubUnits = await db.select().from(subUnits);
  const finalStaff = await db.select().from(staff);
  const finalOkrs = await db.select().from(okrs);
  const finalUpdates = await db.select().from(quarterlyUpdates);
  const finalYears = await db.select().from(years);

  console.log("=== Final Database Summary ===");
  console.log(`SPUs: ${finalSpus.length}`);
  console.log(`Sub-units: ${finalSubUnits.length}`);
  console.log(`Staff: ${finalStaff.length}`);
  console.log(`Years: ${finalYears.length}`);
  console.log(`OKRs: ${finalOkrs.length}`);
  console.log(`Quarterly updates: ${finalUpdates.length}`);
  console.log("\nSeed complete!");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
