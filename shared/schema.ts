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
  title: text("title").notNull(),
  description: text("description").notNull(),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  collaborationSpuId: varchar("collaboration_spu_id").references(() => spus.id),
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

export const insertSpuSchema = createInsertSchema(spus).omit({ id: true });
export const insertSubUnitSchema = createInsertSchema(subUnits).omit({ id: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });
export const insertOkrSchema = createInsertSchema(okrs).omit({ id: true, createdAt: true, currentValue: true, status: true });
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
