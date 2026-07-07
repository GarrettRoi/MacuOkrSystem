import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, json, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const USER_ROLES = ["super_admin", "leader", "cabinet", "basic"] as const;

// "cabinet" has the exact same capabilities as "leader" — they manage SPUs and
// the basic users assigned to them. Use this helper anywhere you would have
// previously checked `role === "leader"` for a permissions decision.
export function isLeaderRole(role?: string | null): boolean {
  return role === "leader" || role === "cabinet";
}

// Session table managed by connect-pg-simple. Declared here so `npm run db:push`
// (run by scripts/post-merge.sh after task merges) does NOT drop it.
export const sessionTable = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => ({
  expireIdx: index("IDX_session_expire").on(table.expire),
}));

export const spus = pgTable("spus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const subUnits = pgTable("sub_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  spuId: varchar("spu_id").notNull().references(() => spus.id, { onDelete: "cascade" }),
});

export const years = pgTable("years", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull().unique(),
});

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  spuId: varchar("spu_id").notNull().references(() => spus.id),
  subUnitId: varchar("sub_unit_id").references(() => subUnits.id),
  isAdmin: boolean("is_admin").notNull().default(false),
  role: text("role").notNull().default("basic"),
  hashedPassword: text("hashed_password"),
  loginCount: integer("login_count").notNull().default(0),
});

export const inviteTokens = pgTable("invite_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const insertInviteTokenSchema = createInsertSchema(inviteTokens).omit({ id: true });
export type InsertInviteToken = z.infer<typeof insertInviteTokenSchema>;
export type InviteToken = typeof inviteTokens.$inferSelect;

export const staffSpuAssignments = pgTable("staff_spu_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  spuId: varchar("spu_id").notNull().references(() => spus.id, { onDelete: "cascade" }),
  subUnitId: varchar("sub_unit_id").references(() => subUnits.id, { onDelete: "cascade" }),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const leaderBasicAssignments = pgTable("leader_basic_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaderId: varchar("leader_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  basicId: varchar("basic_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
});

export const universityObjectives = pgTable("university_objectives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  applicableYears: integer("applicable_years").array().default([]),
  isActive: boolean("is_active").notNull().default(true),
});

export const universityKeyResults = pgTable("university_key_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: varchar("objective_id").notNull().references(() => universityObjectives.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const analyticsDashboards = pgTable("analytics_dashboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const analyticsWidgets = pgTable("analytics_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dashboardId: varchar("dashboard_id").notNull().references(() => analyticsDashboards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  chartType: text("chart_type").notNull(),
  dataSource: text("data_source").notNull(),
  config: text("config").notNull().default("{}"),
  sortOrder: integer("sort_order").notNull().default(0),
  width: text("width").notNull().default("full"),
});

export const universityKeyResultProgress = pgTable("university_key_result_progress", {
  keyResultId: varchar("key_result_id").primaryKey().references(() => universityKeyResults.id, { onDelete: "cascade" }),
  progressPercent: integer("progress_percent").notNull().default(0),
});

export const universityObjectiveComments = pgTable("university_objective_comments", {
  objectiveId: varchar("objective_id").primaryKey().references(() => universityObjectives.id, { onDelete: "cascade" }),
  comment: text("comment").notNull().default(""),
});

export const universityProgressDatapoints = pgTable("university_progress_datapoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyResultId: varchar("key_result_id").notNull().references(() => universityKeyResults.id, { onDelete: "cascade" }),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  progressPercent: integer("progress_percent").notNull().default(0),
});

export const insertProgressDatapointSchema = createInsertSchema(universityProgressDatapoints).omit({ id: true });
export type InsertProgressDatapoint = z.infer<typeof insertProgressDatapointSchema>;
export type ProgressDatapoint = typeof universityProgressDatapoints.$inferSelect;

export const universityYearlySnapshots = pgTable("university_yearly_snapshots", {
  year: integer("year").primaryKey(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const yearlySnapshotKeyResultSchema = z.object({
  label: z.string().min(1).max(50),
  description: z.string().min(1),
  progressPercent: z.number().int().min(0).max(100),
});

export const yearlySnapshotObjectiveSchema = z.object({
  label: z.string().min(1).max(50),
  description: z.string().min(1),
  comment: z.string().default(""),
  keyResults: z.array(yearlySnapshotKeyResultSchema),
});

export const yearlySnapshotPayloadSchema = z.object({
  objectives: z.array(yearlySnapshotObjectiveSchema),
});

export type YearlySnapshotKeyResult = z.infer<typeof yearlySnapshotKeyResultSchema>;
export type YearlySnapshotObjective = z.infer<typeof yearlySnapshotObjectiveSchema>;
export type YearlySnapshotPayload = z.infer<typeof yearlySnapshotPayloadSchema>;
export type UniversityYearlySnapshot = {
  year: number;
  payload: YearlySnapshotPayload;
  updatedAt: Date;
};

export const okrs = pgTable("okrs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: "set null" }),
  submitterName: text("submitter_name"),
  actedByStaffId: varchar("acted_by_staff_id").references(() => staff.id, { onDelete: "set null" }),
  actedByName: text("acted_by_name"),
  spuId: varchar("spu_id").notNull().references(() => spus.id),
  subUnitId: varchar("sub_unit_id").references(() => subUnits.id),
  okrNumber: text("okr_number").notNull(),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  collaborationSpuId: varchar("collaboration_spu_id").references(() => spus.id),
  collaborationSpuIds: text("collaboration_spu_ids").array().default([]),
  universityObjective: text("university_objective").notNull(),
  universityKeyResult: text("university_key_result").notNull(),
  objectiveStatement: text("objective_statement").notNull(),
  keyResults: text("key_results").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  submissionTimestamp: text("submission_timestamp"),
  title: text("title"),
  description: text("description"),
  targetValue: integer("target_value"),
});

export const okrCollaborators = pgTable("okr_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  okrId: varchar("okr_id").notNull().references(() => okrs.id, { onDelete: "cascade" }),
  spuId: varchar("spu_id").references(() => spus.id, { onDelete: "cascade" }),
  subUnitId: varchar("sub_unit_id").references(() => subUnits.id, { onDelete: "cascade" }),
});

export const quarterlyUpdates = pgTable("quarterly_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  okrId: varchar("okr_id").notNull().references(() => okrs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: "set null" }),
  scorerName: text("scorer_name"),
  actedByStaffId: varchar("acted_by_staff_id").references(() => staff.id, { onDelete: "set null" }),
  actedByName: text("acted_by_name"),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  progress: integer("progress").notNull(),
  keyResultScores: text("key_result_scores"),
  averageScore: integer("average_score"),
  additionalKeyResults: text("additional_key_results"),
  notes: text("notes").notNull(),
  isPrimaryScore: boolean("is_primary_score").notNull().default(true),
  isCollaborativeScore: boolean("is_collaborative_score").notNull().default(false),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const okrResponsibilities = pgTable("okr_responsibilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  okrId: varchar("okr_id").notNull().references(() => okrs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
});

export const editLogs = pgTable("edit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  okrId: varchar("okr_id").references(() => okrs.id, { onDelete: "set null" }),
  editedBy: varchar("edited_by").references(() => staff.id, { onDelete: "set null" }),
  editedByName: text("edited_by_name"),
  actionType: text("action_type").notNull().default("edit"),
  reason: text("reason").notNull(),
  changedFields: text("changed_fields").notNull(),
  previousValues: text("previous_values").notNull(),
  newValues: text("new_values").notNull(),
  editedAt: timestamp("edited_at").notNull().defaultNow(),
});

export const unmatchedScores = pgTable("unmatched_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spuName: text("spu_name"),
  subUnitName: text("sub_unit_name"),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  okrNumber: text("okr_number"),
  scorerName: text("scorer_name"),
  krScores: text("kr_scores"),
  notes: text("notes"),
  averageScore: integer("average_score"),
  overflowKrText: text("overflow_kr_text"),
  isCollaborativeScore: boolean("is_collaborative_score").default(false),
  rawData: text("raw_data"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  matchedOkrId: varchar("matched_okr_id").references(() => okrs.id, { onDelete: "set null" }),
  matchedAt: timestamp("matched_at"),
});

export const insertUnmatchedScoreSchema = createInsertSchema(unmatchedScores).omit({ id: true, importedAt: true });
export type InsertUnmatchedScore = z.infer<typeof insertUnmatchedScoreSchema>;
export type UnmatchedScore = typeof unmatchedScores.$inferSelect;

export const UNIVERSITY_OBJECTIVES = [
  "Objective 1: We will humbly CREATE transformative opportunities for the holistic growth of students, faculty, staff, alums, and our community from a Christ-centered, biblical worldview and Wesleyan perspective.",
  "Objective 2: We will joyfully COLLABORATE to align our organizational structures, facilities, and resources effectively and efficiently to achieve sustainability and future expansion.",
  "Objective 3: We will boldly INNOVATE to provide relevant, attainable, dynamic opportunities for learning and growth.",
] as const;

export const UNIVERSITY_KEY_RESULTS = [
  "KR 1.A : Wisdom. Identify and develop metrics for measuring wisdom and increase the associated results for each stakeholder group within defined periods.",
  "KR 1.B : Stature. Ensure a minimum of 20 annual wellness programs, diversifying department engagement in creating mental and physical health initiatives serving all stakeholders to at least 30% in 2025, 50% in 2026, and 80% by May 31 2027.",
  "KR 1.C : Favor with God. Increase spiritual formation metrics by 2% annually.",
  "KR 1.D : Favor with man. Double the number of interpersonal training opportunities in 3 years.",
  "KR 2.A: Stewardship of resources: Implement a resource utilization audit with at least 75% of identified opportunities acted upon.",
  "KR 2.B: Technology. Replace 50% of manual processes with technology.",
  "KR 2.C: Processes and procedures. Evaluate and refine 100% of current processes and procedures for optimization and efficiency.",
  "KR 2.D: People and departments. Increase student and employee satisfaction scores by 2% annually.",
  "KR 3.A: Strategic Partnerships. Establish 1-2 partnerships per SPU per year.",
  "KR 3.B: Relevant program offerings. Create 9-12 new academic, co-curricular, or administrative program offerings.",
  "KR 3:C: Engage with cutting edge technology. Incorporate technology into academic, co-curricular, and administrative programs.",
  "KR 3.D: New and expanded financial resources. Increase alternative revenue funding for learning and growth by 10% annually.",
] as const;

export const OKR_NUMBERS = ["OKR 1", "OKR 2", "OKR 3", "OKR 4", "OKR 5"] as const;

export const QUARTERS = [
  { value: "Q1", label: "Q1: June - August" },
  { value: "Q2", label: "Q2: September - November" },
  { value: "Q3", label: "Q3: December - February" },
  { value: "Q4", label: "Q4: March - May" },
] as const;

export const ALL_QUARTERS_LABEL = "All quarters";

// Abbreviated month range for each fiscal quarter (fiscal year runs June–May).
export const QUARTER_MONTHS: Record<string, string> = {
  Q1: "Jun-Aug",
  Q2: "Sep-Nov",
  Q3: "Dec-Feb",
  Q4: "Mar-May",
};

export const getQuarterLabel = (value: string): string => {
  const quarter = QUARTERS.find(q => q.value === value);
  return quarter?.label || value;
};

export const PLANNING_YEARS = [1, 2, 3, 4] as const;

// Plan-year numbers whose PRIMARY (start, i.e. June) calendar year is one of the
// given years — e.g. the admin "Years" tab. With planStartYear=2024, a Years-tab
// entry of 2024 -> plan year 1, 2025 -> 2, 2026 -> 3. This is the authoritative
// list of plan years available for NEW submissions.
export function planningYearsFromYears(availableYears: number[], planStartYear: number): number[] {
  const set = new Set<number>();
  for (const y of availableYears) {
    const py = y - planStartYear + 1;
    if (py >= 1) set.add(py);
  }
  return Array.from(set).sort((a, b) => a - b);
}

// Plan-year numbers that actually have stored data, derived from (quarter,
// calendarYear) rows. Used to keep historical plan years visible in VIEW filters
// even after they leave the Years tab. Q4 rollover years map back correctly
// (e.g. a Q4 row stored in 2027 belongs to plan year 3 when planStartYear=2024).
export function planningYearsFromPeriods(rows: { quarter: string; year: number }[], planStartYear: number): number[] {
  const set = new Set<number>();
  for (const r of rows) {
    const py = getPlanningYear(r.quarter, r.year, planStartYear);
    // Ignore rows that map below plan year 1 (stray/legacy data) — a "Year 0"
    // option is never a real, selectable plan year.
    if (py >= 1) set.add(py);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function getPlanningYear(quarter: string, calendarYear: number, planStartYear: number): number {
  // Fiscal year runs Jun–May. Each quarter is stored under the calendar year of
  // its FIRST month: Q1 (Jun), Q2 (Sep), and Q3 (Dec) all fall in the plan
  // year's start calendar year; only Q4 (Mar–May) spills into the next calendar
  // year. So Q4 rolls back a year; every other quarter maps to start+1.
  if (quarter === "Q4") {
    return calendarYear - planStartYear;
  }
  return calendarYear - planStartYear + 1;
}

export function getPlanningYearLabel(planningYear: number): string {
  return `Year ${planningYear}`;
}

export function getCalendarYearsForPlanningYear(planningYear: number, planStartYear: number): { q1q2Year: number; q3q4Year: number } {
  const q1q2Year = planStartYear + planningYear - 1;
  const q3q4Year = planStartYear + planningYear;
  return { q1q2Year, q3q4Year };
}

// The calendar year in which a plan year begins (its June).
export function getPlanYearStartCalendarYear(planningYear: number, planStartYear: number): number {
  return planStartYear + planningYear - 1;
}

// Derive the calendar year to STORE for a given plan-year + fiscal-quarter
// selection. Q1 (Jun), Q2 (Sep), and Q3 (Dec) fall in the plan year's start
// calendar year; only Q4 (Mar–May) spills into the next calendar year.
export function getCalendarYearForQuarter(planningYear: number, quarter: string, planStartYear: number): number {
  const startYear = getPlanYearStartCalendarYear(planningYear, planStartYear);
  return quarter === "Q4" ? startYear + 1 : startYear;
}

// Two-digit calendar year, e.g. 2024 -> "24".
function twoDigitYear(year: number): string {
  return String(((year % 100) + 100) % 100).padStart(2, "0");
}

// Primary year tag, e.g. "Year 1 (24-25)" (a plan year spans two calendar years).
export function formatPlanYearLabel(planningYear: number, planStartYear: number): string {
  const startYear = getPlanYearStartCalendarYear(planningYear, planStartYear);
  return `Year ${planningYear} (${twoDigitYear(startYear)}-${twoDigitYear(startYear + 1)})`;
}

// Quarter tag given the plan year it belongs to, including its month range.
// Q1/Q2 -> "Qx Mon-Mon, YY", Q3 -> "Q3 Dec-Feb, YY/YY" (crosses calendar years),
// Q4 -> "Q4 Mar-May, YY".
export function formatQuarterTagForPlanYear(quarter: string, planningYear: number, planStartYear: number): string {
  const startYear = getPlanYearStartCalendarYear(planningYear, planStartYear);
  const months = QUARTER_MONTHS[quarter];
  switch (quarter) {
    case "Q1":
      return `Q1 ${months}, ${twoDigitYear(startYear)}`;
    case "Q2":
      return `Q2 ${months}, ${twoDigitYear(startYear)}`;
    case "Q3":
      return `Q3 ${months}, ${twoDigitYear(startYear)}/${twoDigitYear(startYear + 1)}`;
    case "Q4":
      return `Q4 ${months}, ${twoDigitYear(startYear + 1)}`;
    default:
      return quarter;
  }
}

// Quarter tag derived from the STORED (quarter, calendarYear) pair.
export function formatQuarterTag(quarter: string, calendarYear: number, planStartYear: number): string {
  const planningYear = getPlanningYear(quarter, calendarYear, planStartYear);
  return formatQuarterTagForPlanYear(quarter, planningYear, planStartYear);
}

// Both tags + the derived plan year, computed from STORED values.
export function formatPeriodTags(
  quarter: string,
  calendarYear: number,
  planStartYear: number,
): { yearTag: string; quarterTag: string; planningYear: number } {
  const planningYear = getPlanningYear(quarter, calendarYear, planStartYear);
  return {
    planningYear,
    yearTag: formatPlanYearLabel(planningYear, planStartYear),
    quarterTag: formatQuarterTagForPlanYear(quarter, planningYear, planStartYear),
  };
}

// One-line combined label, e.g. "Year 1 (24) · Q3 (24/25)".
export function formatPeriodLabel(quarter: string, calendarYear: number, planStartYear: number): string {
  const { yearTag, quarterTag } = formatPeriodTags(quarter, calendarYear, planStartYear);
  return `${yearTag} · ${quarterTag}`;
}

export const RESPONSIBILITY_ROLES = ["owner", "collaborator"] as const;

export function parseMultiSelectField(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
  }
  return value ? [value] : [];
}

export const insertUniversityObjectiveSchema = createInsertSchema(universityObjectives).omit({ id: true });
export const insertUniversityKeyResultSchema = createInsertSchema(universityKeyResults).omit({ id: true });

export const insertAnalyticsDashboardSchema = createInsertSchema(analyticsDashboards).omit({ id: true, createdAt: true });
export const insertAnalyticsWidgetSchema = createInsertSchema(analyticsWidgets).omit({ id: true });

export const insertSpuSchema = createInsertSchema(spus).omit({ id: true });
export const insertSubUnitSchema = createInsertSchema(subUnits).omit({ id: true });
export const insertYearSchema = createInsertSchema(years).omit({ id: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true }).extend({
  role: z.enum(USER_ROLES).default("basic"),
});
export const insertStaffSpuAssignmentSchema = createInsertSchema(staffSpuAssignments).omit({ id: true });
export const insertLeaderBasicAssignmentSchema = createInsertSchema(leaderBasicAssignments).omit({ id: true });
export const insertOkrResponsibilitySchema = createInsertSchema(okrResponsibilities).omit({ id: true }).extend({
  role: z.enum(RESPONSIBILITY_ROLES),
});

export const baseInsertOkrSchema = createInsertSchema(okrs).omit({ id: true, createdAt: true, currentValue: true, status: true, title: true, description: true, targetValue: true, okrNumber: true, actedByStaffId: true, actedByName: true });

export const updateOkrSchema = z.object({
  objectiveStatement: z.string().min(20, "Objective must be at least 20 characters").optional(),
  okrNumber: z.string().optional(),
  quarter: z.string().optional(),
  year: z.number().optional(),
  staffId: z.string().nullable().optional(),
  spuId: z.string().optional(),
  subUnitId: z.string().nullable().optional(),
  universityObjective: z.string().optional(),
  universityKeyResult: z.string().optional(),
  keyResults: z.string().optional(),
  collaborationSpuId: z.string().nullable().optional(),
  collaborationSpuIds: z.array(z.string()).optional(),
  collaborationSubUnitIds: z.array(z.string()).optional(),
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
});

export const insertOkrSchema = baseInsertOkrSchema.refine(
  (data) => {
    try {
      const keyResults = JSON.parse(data.keyResults);
      if (!Array.isArray(keyResults)) return false;
      
      // Validate that each key result has a valid description
      const hasValidFields = keyResults.every(kr =>
        typeof kr.description === 'string' &&
        kr.description.length >= 10
      );
      
      return hasValidFields;
    } catch {
      return false;
    }
  },
  {
    message: "keyResults must be valid JSON with descriptions of at least 10 characters",
  }
);

export const insertQuarterlyUpdateSchema = createInsertSchema(quarterlyUpdates).omit({ id: true, submittedAt: true, actedByStaffId: true, actedByName: true });

// Schema for individual key result score
const keyResultScoreSchema = z.object({
  keyResultNumber: z.number().int().min(1).max(4),
  description: z.string(),
  score: z.number().min(0).max(100),
});

export const updateQuarterlyUpdateSchema = z.object({
  keyResultScores: z.string().optional().transform((val, ctx) => {
    if (!val) return undefined;
    try {
      const parsed = JSON.parse(val);
      const validated = z.array(keyResultScoreSchema).parse(parsed);
      return JSON.stringify(validated);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "keyResultScores must be valid JSON array of {keyResultNumber, description, score}",
      });
      return z.NEVER;
    }
  }),
  additionalKeyResults: z.string().optional(),
  notes: z.string().min(10, "Notes must be at least 10 characters").optional(),
}).refine(
  (data) => {
    return data.keyResultScores !== undefined || data.additionalKeyResults !== undefined || data.notes !== undefined;
  },
  {
    message: "At least one field must be provided",
  }
);

export type InsertSpu = z.infer<typeof insertSpuSchema>;
export type InsertSubUnit = z.infer<typeof insertSubUnitSchema>;
export type InsertYear = z.infer<typeof insertYearSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type InsertOkr = z.infer<typeof insertOkrSchema>;
export type InsertQuarterlyUpdate = z.infer<typeof insertQuarterlyUpdateSchema>;
export type InsertOkrResponsibility = z.infer<typeof insertOkrResponsibilitySchema>;
export type InsertStaffSpuAssignment = z.infer<typeof insertStaffSpuAssignmentSchema>;
export type InsertLeaderBasicAssignment = z.infer<typeof insertLeaderBasicAssignmentSchema>;

export type InsertUniversityObjective = z.infer<typeof insertUniversityObjectiveSchema>;
export type InsertUniversityKeyResult = z.infer<typeof insertUniversityKeyResultSchema>;

export type AnalyticsDashboard = typeof analyticsDashboards.$inferSelect;
export type AnalyticsWidget = typeof analyticsWidgets.$inferSelect;
export type InsertAnalyticsDashboard = z.infer<typeof insertAnalyticsDashboardSchema>;
export type InsertAnalyticsWidget = z.infer<typeof insertAnalyticsWidgetSchema>;
export type AnalyticsDashboardWithWidgets = AnalyticsDashboard & { widgets: AnalyticsWidget[] };
export type AnalyticsDataPoint = { label: string; value: number };
export type AnalyticsData = { type: "series" | "metric"; data: AnalyticsDataPoint[]; metricValue?: number; metricLabel?: string };

export type UniversityObjective = typeof universityObjectives.$inferSelect;
export type UniversityKeyResult = typeof universityKeyResults.$inferSelect;
export type UniversityKeyResultProgress = typeof universityKeyResultProgress.$inferSelect;
export type UniversityObjectiveComment = typeof universityObjectiveComments.$inferSelect;

export type UniversityKeyResultWithProgress = UniversityKeyResult & {
  progressPercent: number | null;
};

export type UniversityObjectiveWithKeyResults = UniversityObjective & {
  keyResults: UniversityKeyResult[];
};

export type StrategicAdvancementObjective = UniversityObjective & {
  keyResults: UniversityKeyResultWithProgress[];
  comment: string;
};

export type StrategicAdvancementData = {
  objectives: StrategicAdvancementObjective[];
  lastUpdated: string | null;
};

export type StrategicChartKR = {
  id: string;
  label: string;
  description: string;
  datapoints: Array<{ quarter: string; year: number; progressPercent: number }>;
};

export type StrategicChartObjective = {
  id: string;
  label: string;
  description: string;
  comment: string;
  keyResults: StrategicChartKR[];
};

export type StrategicChartRange = {
  startQuarter: string;
  startYear: number;
  endQuarter: string;
  endYear: number;
};

export type StrategicChartData = {
  range: StrategicChartRange | null;
  objectives: StrategicChartObjective[];
  lastUpdated: string | null;
};

export type Spu = typeof spus.$inferSelect;
export type SubUnit = typeof subUnits.$inferSelect;
export type Year = typeof years.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Okr = typeof okrs.$inferSelect;
export type QuarterlyUpdate = typeof quarterlyUpdates.$inferSelect;
export type OkrResponsibility = typeof okrResponsibilities.$inferSelect;
export type StaffSpuAssignment = typeof staffSpuAssignments.$inferSelect;
export type LeaderBasicAssignment = typeof leaderBasicAssignments.$inferSelect;
export type EditLog = typeof editLogs.$inferSelect;

export const insertEditLogSchema = createInsertSchema(editLogs).omit({ id: true, editedAt: true });
export type InsertEditLog = z.infer<typeof insertEditLogSchema>;

export type UserRole = typeof USER_ROLES[number];

export type StaffWithDetails = Omit<Staff, "hashedPassword"> & {
  spu: Spu;
  subUnit?: SubUnit | null;
};

export type StaffSpuAssignmentWithDetails = StaffSpuAssignment & {
  spu: Spu;
  subUnit?: SubUnit | null;
};

export type StaffWithAssignments = StaffWithDetails & {
  assignments: StaffSpuAssignmentWithDetails[];
  leaders?: StaffWithDetails[];
};

export type OkrWithDetails = Okr & {
  staff: StaffWithDetails;
  spu?: Spu | null;
  subUnit?: SubUnit | null;
  collaborationSpu?: Spu | null;
  collaborationSpus?: Spu[];
  collaborationSubUnits?: (SubUnit & { spuName?: string | null })[];
  orphanCollaboratorIds?: string[];
};

export type OkrCollaborator = typeof okrCollaborators.$inferSelect;
export type InsertOkrCollaborator = typeof okrCollaborators.$inferInsert;

export type QuarterUpdateWithDetails = QuarterlyUpdate & {
  okr: OkrWithDetails;
};

export type OkrResponsibilityWithDetails = OkrResponsibility & {
  staff: StaffWithDetails;
};

export type EmployeeProgressRecord = {
  okr: OkrWithDetails;
  latestUpdate?: QuarterlyUpdate | null;
  responsibilities: OkrResponsibilityWithDetails[];
  quarterlyUpdates: QuarterlyUpdate[];
};

export type EmployeeProgressSummary = {
  staff: StaffWithDetails;
  overallProgress: number | null;
  okrCount: number;
  okrs: EmployeeProgressRecord[];
};

export const dataBackups = pgTable("data_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  backupType: text("backup_type", { enum: ["automatic", "manual"] }).notNull().default("manual"),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDataBackupSchema = createInsertSchema(dataBackups).omit({ id: true, createdAt: true });
export type InsertDataBackup = z.infer<typeof insertDataBackupSchema>;
export type DataBackup = typeof dataBackups.$inferSelect;
export type DataBackupMeta = Omit<DataBackup, "snapshot">;

export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  pageUrl: text("page_url"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, submittedAt: true, isRead: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;
export type FeedbackWithStaff = Feedback & { staffName: string };

export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: "set null" }),
  staffName: text("staff_name").notNull(),
  staffEmail: text("staff_email"),
  path: text("path").notNull(),
  // 'page_view' for normal navigation, 'error' for client-side error reports.
  kind: text("kind").notNull().default("page_view"),
  // Populated when kind = 'error'. errorMessage is the short summary shown to
  // the user; errorDetail holds the full server response / stack trace for
  // diagnosis.
  errorMessage: text("error_message"),
  errorDetail: text("error_detail"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
}, (table) => ({
  staffIdx: index("IDX_activity_log_staff").on(table.staffId),
  occurredIdx: index("IDX_activity_log_occurred").on(table.occurredAt),
  kindIdx: index("IDX_activity_log_kind").on(table.kind),
}));

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true, occurredAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type InactiveStaffEntry = StaffWithDetails & { lastActivityAt: Date | null };

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  staffIdx: index("IDX_push_subs_staff").on(table.staffId),
}));

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

export const ANNOUNCEMENT_AUDIENCE_TYPES = ["all", "spu_ids", "spus_missing_score"] as const;
export type AnnouncementAudienceType = typeof ANNOUNCEMENT_AUDIENCE_TYPES[number];

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sentByStaffId: varchar("sent_by_staff_id").references(() => staff.id, { onDelete: "set null" }),
  sentByName: text("sent_by_name").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url"),
  audienceType: text("audience_type").notNull(),
  audienceSpuIds: text("audience_spu_ids").array().default([]),
  audienceQuarter: text("audience_quarter"),
  audienceYear: integer("audience_year"),
  recipientCount: integer("recipient_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const sendAnnouncementSchema = z.object({
  title: z.string().min(1, "Title required").max(120),
  body: z.string().min(1, "Body required").max(500),
  url: z.string().optional().nullable(),
  audience: z.discriminatedUnion("type", [
    z.object({ type: z.literal("all") }),
    z.object({ type: z.literal("spu_ids"), spuIds: z.array(z.string().min(1)).min(1) }),
    z.object({
      type: z.literal("spus_missing_score"),
      quarter: z.string().min(1),
      year: z.number().int(),
    }),
  ]),
});
export type SendAnnouncementInput = z.infer<typeof sendAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

export const appRatings = pgTable("app_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  rating: text("rating").notNull(),
  pageUrl: text("page_url"),
  context: text("context"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertAppRatingSchema = createInsertSchema(appRatings).omit({ id: true, submittedAt: true });
export type InsertAppRating = z.infer<typeof insertAppRatingSchema>;
export type AppRating = typeof appRatings.$inferSelect;
export type AppRatingWithStaff = AppRating & { staffName: string };
