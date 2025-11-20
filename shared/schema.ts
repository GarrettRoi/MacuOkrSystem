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
  notes: text("notes").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
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

export const insertSpuSchema = createInsertSchema(spus).omit({ id: true });
export const insertSubUnitSchema = createInsertSchema(subUnits).omit({ id: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });
export const insertOkrSchema = createInsertSchema(okrs).omit({ id: true, createdAt: true, currentValue: true, status: true, title: true, description: true, targetValue: true });
export const insertQuarterlyUpdateSchema = createInsertSchema(quarterlyUpdates).omit({ id: true, submittedAt: true });

export type InsertSpu = z.infer<typeof insertSpuSchema>;
export type InsertSubUnit = z.infer<typeof insertSubUnitSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type InsertOkr = z.infer<typeof insertOkrSchema>;
export type InsertQuarterlyUpdate = z.infer<typeof insertQuarterlyUpdateSchema>;

export type Spu = typeof spus.$inferSelect;
export type SubUnit = typeof subUnits.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Okr = typeof okrs.$inferSelect;
export type QuarterlyUpdate = typeof quarterlyUpdates.$inferSelect;

export type StaffWithDetails = Staff & {
  spu: Spu;
  subUnit?: SubUnit | null;
};

export type OkrWithDetails = Okr & {
  staff: StaffWithDetails;
  collaborationSpu?: Spu | null;
};

export type QuarterUpdateWithDetails = QuarterlyUpdate & {
  okr: OkrWithDetails;
};
