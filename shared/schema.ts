import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
});

export const okrs = pgTable("okrs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  spuId: varchar("spu_id").notNull().references(() => spus.id),
  subUnitId: varchar("sub_unit_id").references(() => subUnits.id),
  okrNumber: text("okr_number").notNull(),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  collaborationSpuId: varchar("collaboration_spu_id").references(() => spus.id),
  universityObjective: text("university_objective").notNull(),
  universityKeyResult: text("university_key_result").notNull(),
  objectiveStatement: text("objective_statement").notNull(),
  keyResults: text("key_results").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  title: text("title"),
  description: text("description"),
  targetValue: integer("target_value"),
});

export const quarterlyUpdates = pgTable("quarterly_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  okrId: varchar("okr_id").notNull().references(() => okrs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  progress: integer("progress").notNull(),
  keyResultScores: text("key_result_scores"),
  averageScore: integer("average_score"),
  additionalKeyResults: text("additional_key_results"),
  notes: text("notes").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const okrResponsibilities = pgTable("okr_responsibilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  okrId: varchar("okr_id").notNull().references(() => okrs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
});

export const UNIVERSITY_OBJECTIVES = [
  "Objective 1: We will fully EMBRACE our calling to be a Wesleyan-Holiness Christ-centered university.",
  "Objective 2: We will prioritize BELONGING to foster a connected community for students, faculty, staff, and alumni.",
  "Objective 3: We will boldly INNOVATE to provide relevant, attainable, dynamic opportunities for learning and growth.",
  "Objective 4: We will demonstrate EXCELLENCE by exceeding expectations through intentional strategy and continuous improvement.",
] as const;

export const UNIVERSITY_KEY_RESULTS = [
  "KR 1.A: Faith integration. 65% of students report that their faith has been strengthened during their time at MACU.",
  "KR 1.B: Chapel engagement. Achieve 75% average chapel attendance across all campuses.",
  "KR 2.A: Student connections. Increase student participation in campus activities by 20%.",
  "KR 2.B: Alumni engagement. Grow alumni event participation by 25%.",
  "KR 3.A: Enrollment growth. Increase total student enrollment by 10%.",
  "KR 3.B: Relevant program offerings. Create 9-12 new academic, co-curricular, or administrative program offerings.",
  "KR 4.A: Academic excellence. Maintain a 90% or higher student satisfaction rate.",
  "KR 4.B: Operational efficiency. Reduce operational costs by 5% through process improvements.",
] as const;

export const OKR_NUMBERS = ["OKR 1", "OKR 2", "OKR 3", "OKR 4", "OKR 5"] as const;

export const RESPONSIBILITY_ROLES = ["owner", "collaborator"] as const;

export const insertSpuSchema = createInsertSchema(spus).omit({ id: true });
export const insertSubUnitSchema = createInsertSchema(subUnits).omit({ id: true });
export const insertYearSchema = createInsertSchema(years).omit({ id: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });
export const insertOkrResponsibilitySchema = createInsertSchema(okrResponsibilities).omit({ id: true }).extend({
  role: z.enum(RESPONSIBILITY_ROLES),
});

export const baseInsertOkrSchema = createInsertSchema(okrs).omit({ id: true, createdAt: true, currentValue: true, status: true, title: true, description: true, targetValue: true });

export const updateOkrSchema = z.object({
  objectiveStatement: z.string().min(20, "Objective must be at least 20 characters").optional(),
  status: z.enum(["not_started", "in_progress", "at_risk", "completed"]).optional(),
}).refine(
  (data) => {
    // At least one field must be provided
    return data.objectiveStatement !== undefined || data.status !== undefined;
  },
  {
    message: "At least one field (objectiveStatement or status) must be provided",
  }
);

export const insertOkrSchema = baseInsertOkrSchema.refine(
  (data) => {
    try {
      const keyResults = JSON.parse(data.keyResults);
      if (!Array.isArray(keyResults)) return false;
      
      const hasValidFields = keyResults.every(kr =>
        typeof kr.description === 'string' &&
        kr.description.length >= 10 &&
        typeof kr.percentage === 'number' &&
        kr.percentage >= 1 &&
        kr.percentage <= 100
      );
      
      if (!hasValidFields) return false;
      
      const total = keyResults.reduce((sum, kr) => sum + kr.percentage, 0);
      return Math.abs(total - 100) < 0.01;
    } catch {
      return false;
    }
  },
  {
    message: "keyResults must be valid JSON with percentage total of 100%",
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

export type Spu = typeof spus.$inferSelect;
export type SubUnit = typeof subUnits.$inferSelect;
export type Year = typeof years.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Okr = typeof okrs.$inferSelect;
export type QuarterlyUpdate = typeof quarterlyUpdates.$inferSelect;
export type OkrResponsibility = typeof okrResponsibilities.$inferSelect;

export type StaffWithDetails = Staff & {
  spu: Spu;
  subUnit?: SubUnit | null;
};

export type OkrWithDetails = Okr & {
  staff: StaffWithDetails;
  spu?: Spu | null;
  subUnit?: SubUnit | null;
  collaborationSpu?: Spu | null;
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
