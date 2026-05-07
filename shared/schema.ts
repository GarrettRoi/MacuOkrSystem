import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, json, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const USER_ROLES = ["super_admin", "leader", "basic"] as const;

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

export const okrs = pgTable("okrs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: "set null" }),
  submitterName: text("submitter_name"),
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

export const quarterlyUpdates = pgTable("quarterly_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  okrId: varchar("okr_id").notNull().references(() => okrs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: "set null" }),
  scorerName: text("scorer_name"),
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

export const getQuarterLabel = (value: string): string => {
  const quarter = QUARTERS.find(q => q.value === value);
  return quarter?.label || value;
};

export const PLANNING_YEARS = [1, 2, 3, 4] as const;

export function getPlanningYear(quarter: string, calendarYear: number, planStartYear: number): number {
  if (quarter === "Q1" || quarter === "Q2") {
    return calendarYear - planStartYear + 1;
  }
  return calendarYear - planStartYear;
}

export function getPlanningYearLabel(planningYear: number): string {
  return `Year ${planningYear}`;
}

export function getCalendarYearsForPlanningYear(planningYear: number, planStartYear: number): { q1q2Year: number; q3q4Year: number } {
  const q1q2Year = planStartYear + planningYear - 1;
  const q3q4Year = planStartYear + planningYear;
  return { q1q2Year, q3q4Year };
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

export const baseInsertOkrSchema = createInsertSchema(okrs).omit({ id: true, createdAt: true, currentValue: true, status: true, title: true, description: true, targetValue: true, okrNumber: true });

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

export const insertQuarterlyUpdateSchema = createInsertSchema(quarterlyUpdates).omit({ id: true, submittedAt: true });

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
  progressPercent: number;
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
};

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
  overallProgress: number;
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
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
}, (table) => ({
  staffIdx: index("IDX_activity_log_staff").on(table.staffId),
  occurredIdx: index("IDX_activity_log_occurred").on(table.occurredAt),
}));

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true, occurredAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type InactiveStaffEntry = StaffWithDetails & { lastActivityAt: Date | null };

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
