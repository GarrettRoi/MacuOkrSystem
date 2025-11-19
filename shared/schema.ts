import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const subDepartments = pgTable("sub_departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
});

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  departmentId: varchar("department_id").notNull().references(() => departments.id),
  subDepartmentId: varchar("sub_department_id").references(() => subDepartments.id),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const okrs = pgTable("okrs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true });
export const insertSubDepartmentSchema = createInsertSchema(subDepartments).omit({ id: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });
export const insertOkrSchema = createInsertSchema(okrs).omit({ id: true, createdAt: true, currentValue: true, status: true });
export const insertQuarterlyUpdateSchema = createInsertSchema(quarterlyUpdates).omit({ id: true, submittedAt: true });

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertSubDepartment = z.infer<typeof insertSubDepartmentSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type InsertOkr = z.infer<typeof insertOkrSchema>;
export type InsertQuarterlyUpdate = z.infer<typeof insertQuarterlyUpdateSchema>;

export type Department = typeof departments.$inferSelect;
export type SubDepartment = typeof subDepartments.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Okr = typeof okrs.$inferSelect;
export type QuarterlyUpdate = typeof quarterlyUpdates.$inferSelect;

export type StaffWithDetails = Staff & {
  department: Department;
  subDepartment?: SubDepartment | null;
};

export type OkrWithDetails = Okr & {
  staff: StaffWithDetails;
};

export type QuarterUpdateWithDetails = QuarterlyUpdate & {
  okr: OkrWithDetails;
};
