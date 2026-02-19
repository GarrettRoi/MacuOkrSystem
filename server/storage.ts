import {
  type Staff,
  type Spu,
  type SubUnit,
  type Year,
  type Okr,
  type QuarterlyUpdate,
  type OkrResponsibility,
  type StaffSpuAssignment,
  type LeaderBasicAssignment,
  type InsertStaff,
  type InsertSpu,
  type InsertSubUnit,
  type InsertYear,
  type InsertOkr,
  type InsertQuarterlyUpdate,
  type InsertOkrResponsibility,
  type InsertStaffSpuAssignment,
  type InsertLeaderBasicAssignment,
  type InsertUniversityObjective,
  type InsertUniversityKeyResult,
  type UniversityObjective,
  type UniversityKeyResult,
  type UniversityObjectiveWithKeyResults,
  type EditLog,
  type InsertEditLog,
  type StaffWithDetails,
  type StaffSpuAssignmentWithDetails,
  type OkrWithDetails,
  type EmployeeProgressRecord,
  type EmployeeProgressSummary,
  spus,
  subUnits,
  years,
  staff,
  okrs,
  quarterlyUpdates,
  okrResponsibilities,
  staffSpuAssignments,
  leaderBasicAssignments,
  appSettings,
  universityObjectives,
  universityKeyResults,
  editLogs,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface IStorage {
  verifyPassword(password: string): Promise<{ isValid: boolean; isAdmin: boolean }>;
  
  getAllStaff(): Promise<Staff[]>;
  getAllStaffWithDetails(): Promise<StaffWithDetails[]>;
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffWithDetails(id: string): Promise<StaffWithDetails | undefined>;
  getStaffByName(name: string): Promise<Staff | undefined>;
  findOrCreateStaff(name: string, spuId: string, subUnitId?: string): Promise<Staff>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff>;
  deleteStaff(id: string): Promise<void>;
  mergeStaff(sourceId: string, targetId: string): Promise<{ okrsMerged: number; updatesMerged: number; responsibilitiesMerged: number }>;
  
  getAllSpus(): Promise<Spu[]>;
  getSpu(id: string): Promise<Spu | undefined>;
  getSpuByName(name: string): Promise<Spu | undefined>;
  findOrCreateSpu(name: string): Promise<Spu>;
  createSpu(spu: InsertSpu): Promise<Spu>;
  updateSpu(id: string, updates: Partial<InsertSpu>): Promise<Spu>;
  deleteSpu(id: string): Promise<void>;
  
  getAllSubUnits(): Promise<SubUnit[]>;
  getSubUnit(id: string): Promise<SubUnit | undefined>;
  getSubUnitByNameAndSpu(name: string, spuId: string): Promise<SubUnit | undefined>;
  findOrCreateSubUnit(name: string, spuId: string): Promise<SubUnit>;
  createSubUnit(subUnit: InsertSubUnit): Promise<SubUnit>;
  updateSubUnit(id: string, updates: Partial<InsertSubUnit>): Promise<SubUnit>;
  deleteSubUnit(id: string): Promise<void>;
  
  getAllYears(): Promise<Year[]>;
  getYear(id: string): Promise<Year | undefined>;
  getYearByValue(year: number): Promise<Year | undefined>;
  findOrCreateYear(year: number): Promise<Year>;
  createYear(year: InsertYear): Promise<Year>;
  deleteYear(id: string): Promise<void>;
  
  getAllOkrs(): Promise<Okr[]>;
  getAllOkrsWithDetails(): Promise<OkrWithDetails[]>;
  getOkr(id: string): Promise<Okr | undefined>;
  getOkrsByStaff(staffId: string): Promise<Okr[]>;
  getOkrsBySpu(spuId: string): Promise<Okr[]>;
  countOkrsBySpu(spuId: string, year: number): Promise<number>;
  getOkrsWithDetailsBySpu(spuId: string): Promise<OkrWithDetails[]>;
  createOkr(okr: InsertOkr & { okrNumber: string }): Promise<Okr>;
  updateOkr(id: string, updates: Partial<Okr>): Promise<Okr>;
  deleteOkr(id: string): Promise<void>;
  
  getAllQuarterlyUpdates(): Promise<QuarterlyUpdate[]>;
  getQuarterlyUpdate(id: string): Promise<QuarterlyUpdate | undefined>;
  getQuarterlyUpdatesByOkr(okrId: string): Promise<QuarterlyUpdate[]>;
  createQuarterlyUpdate(update: InsertQuarterlyUpdate): Promise<QuarterlyUpdate>;
  updateQuarterlyUpdate(id: string, updates: Partial<InsertQuarterlyUpdate>): Promise<QuarterlyUpdate>;
  deleteQuarterlyUpdate(id: string): Promise<void>;
  
  createOkrResponsibility(responsibility: InsertOkrResponsibility): Promise<OkrResponsibility>;
  getOkrResponsibilities(okrId: string): Promise<OkrResponsibility[]>;
  deleteOkrResponsibility(id: string): Promise<void>;
  
  // Staff SPU Assignments
  getStaffSpuAssignments(staffId: string): Promise<StaffSpuAssignmentWithDetails[]>;
  getAllStaffSpuAssignments(): Promise<StaffSpuAssignmentWithDetails[]>;
  createStaffSpuAssignment(assignment: InsertStaffSpuAssignment): Promise<StaffSpuAssignment>;
  deleteStaffSpuAssignment(id: string): Promise<void>;
  getStaffBySpuAssignment(spuId: string): Promise<StaffWithDetails[]>;
  
  // Leader-Basic Relationships
  getLeadersForBasicUser(basicId: string): Promise<StaffWithDetails[]>;
  getBasicUsersForLeader(leaderId: string): Promise<StaffWithDetails[]>;
  getTeamMembersForLeader(leaderId: string): Promise<StaffWithDetails[]>;
  createLeaderBasicAssignment(assignment: InsertLeaderBasicAssignment): Promise<LeaderBasicAssignment>;
  deleteLeaderBasicAssignment(leaderId: string, basicId: string): Promise<void>;
  
  // University Strategic Planning
  getAllUniversityObjectives(): Promise<import("@shared/schema").UniversityObjectiveWithKeyResults[]>;
  createUniversityObjective(obj: import("@shared/schema").InsertUniversityObjective): Promise<import("@shared/schema").UniversityObjective>;
  updateUniversityObjective(id: string, updates: Partial<import("@shared/schema").InsertUniversityObjective>): Promise<import("@shared/schema").UniversityObjective>;
  deleteUniversityObjective(id: string): Promise<void>;
  createUniversityKeyResult(kr: import("@shared/schema").InsertUniversityKeyResult): Promise<import("@shared/schema").UniversityKeyResult>;
  updateUniversityKeyResult(id: string, updates: Partial<import("@shared/schema").InsertUniversityKeyResult>): Promise<import("@shared/schema").UniversityKeyResult>;
  deleteUniversityKeyResult(id: string): Promise<void>;

  // App Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Staff lookup by ID number or email
  getStaffByIdNumber(staffIdNumber: string): Promise<Staff | undefined>;
  getStaffByEmail(email: string): Promise<Staff | undefined>;
  
  getEmployeeProgress(filters: {
    year?: number;
    quarter?: string;
    staffId?: string;
    spuId?: string;
    status?: string;
  }): Promise<EmployeeProgressRecord[]>;
  
  getEmployeeProgressGrouped(filters: {
    year?: number;
    quarter?: string;
    staffId?: string;
    spuId?: string;
    status?: string;
  }): Promise<EmployeeProgressSummary[]>;

  createEditLog(log: InsertEditLog): Promise<EditLog>;
  getAllEditLogs(): Promise<EditLog[]>;
}

export class DatabaseStorage implements IStorage {
  private adminPassword: string = "admin14:12";
  private staffPassword: string = "staff14:12";

  async verifyPassword(password: string): Promise<{ isValid: boolean; isAdmin: boolean }> {
    if (password === this.adminPassword) {
      return { isValid: true, isAdmin: true };
    } else if (password === this.staffPassword) {
      return { isValid: true, isAdmin: false };
    }
    return { isValid: false, isAdmin: false };
  }

  async getAllStaff(): Promise<Staff[]> {
    return await db.select().from(staff);
  }

  async getAllStaffWithDetails(): Promise<StaffWithDetails[]> {
    const result = await db
      .select({
        id: staff.id,
        staffIdNumber: staff.staffIdNumber,
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        role: staff.role,
        spuId: staff.spuId,
        subUnitId: staff.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(staff)
      .leftJoin(spus, eq(staff.spuId, spus.id))
      .leftJoin(subUnits, eq(staff.subUnitId, subUnits.id));

    return result.map((row) => ({
      id: row.id,
      staffIdNumber: row.staffIdNumber,
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      role: row.role,
      spuId: row.spuId,
      subUnitId: row.subUnitId,
      spu: row.spu!,
      subUnit: row.subUnit,
    }));
  }

  async getStaff(id: string): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(eq(staff.id, id));
    return result || undefined;
  }

  async getStaffWithDetails(id: string): Promise<StaffWithDetails | undefined> {
    const result = await db
      .select({
        id: staff.id,
        staffIdNumber: staff.staffIdNumber,
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        role: staff.role,
        spuId: staff.spuId,
        subUnitId: staff.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(staff)
      .leftJoin(spus, eq(staff.spuId, spus.id))
      .leftJoin(subUnits, eq(staff.subUnitId, subUnits.id))
      .where(eq(staff.id, id));

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      id: row.id,
      staffIdNumber: row.staffIdNumber,
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      role: row.role,
      spuId: row.spuId,
      subUnitId: row.subUnitId,
      spu: row.spu!,
      subUnit: row.subUnit,
    };
  }

  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    const [staffMember] = await db
      .insert(staff)
      .values(insertStaff)
      .returning();
    return staffMember;
  }

  async updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff> {
    const [updatedStaff] = await db
      .update(staff)
      .set(updates)
      .where(eq(staff.id, id))
      .returning();
    return updatedStaff;
  }

  async deleteStaff(id: string): Promise<void> {
    // OKRs belong to SPUs, not staff - they will have staffId set to null automatically
    // Other relations (assignments, leader-basic) have cascade delete
    await db.delete(staff).where(eq(staff.id, id));
  }

  async mergeStaff(sourceId: string, targetId: string): Promise<{ okrsMerged: number; updatesMerged: number; responsibilitiesMerged: number }> {
    // Transfer all OKRs from source to target
    const sourceOkrs = await db.select().from(okrs).where(eq(okrs.staffId, sourceId));
    for (const okr of sourceOkrs) {
      await db.update(okrs).set({ staffId: targetId }).where(eq(okrs.id, okr.id));
    }

    // Transfer all quarterly updates from source to target
    const sourceUpdates = await db.select().from(quarterlyUpdates).where(eq(quarterlyUpdates.staffId, sourceId));
    for (const update of sourceUpdates) {
      await db.update(quarterlyUpdates).set({ staffId: targetId }).where(eq(quarterlyUpdates.id, update.id));
    }

    // Transfer all OKR responsibilities from source to target
    const sourceResponsibilities = await db.select().from(okrResponsibilities).where(eq(okrResponsibilities.staffId, sourceId));
    for (const resp of sourceResponsibilities) {
      // Check if target already has this responsibility for this OKR
      const existing = await db.select().from(okrResponsibilities)
        .where(and(eq(okrResponsibilities.okrId, resp.okrId), eq(okrResponsibilities.staffId, targetId)));
      if (existing.length === 0) {
        await db.update(okrResponsibilities).set({ staffId: targetId }).where(eq(okrResponsibilities.id, resp.id));
      } else {
        // Delete duplicate responsibility
        await db.delete(okrResponsibilities).where(eq(okrResponsibilities.id, resp.id));
      }
    }

    // Delete the source staff member
    await db.delete(staff).where(eq(staff.id, sourceId));

    return {
      okrsMerged: sourceOkrs.length,
      updatesMerged: sourceUpdates.length,
      responsibilitiesMerged: sourceResponsibilities.length,
    };
  }

  async getStaffByName(name: string): Promise<Staff | undefined> {
    const normalized = name.trim().toLowerCase();
    const allStaff = await db.select().from(staff);
    return allStaff.find(s => s.name.toLowerCase() === normalized);
  }

  async findOrCreateStaff(name: string, spuId: string, subUnitId?: string): Promise<Staff> {
    const existing = await this.getStaffByName(name);
    if (existing) return existing;
    
    // Normalize name: title case each word
    const normalizedName = name.trim().split(/\s+/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    // Check again with normalized name
    const existingNormalized = await this.getStaffByName(normalizedName);
    if (existingNormalized) return existingNormalized;
    
    const email = normalizedName.toLowerCase().replace(/\s+/g, '.') + '@macu.edu';
    
    // Check if email already exists
    const allStaff = await this.getAllStaff();
    const emailExists = allStaff.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (emailExists) return emailExists;
    
    return await this.createStaff({
      name: normalizedName,
      email,
      spuId,
      subUnitId: subUnitId || null,
      isAdmin: false,
      role: "basic",
    });
  }

  async getAllSpus(): Promise<Spu[]> {
    return await db.select().from(spus).orderBy(asc(spus.name));
  }

  async getSpu(id: string): Promise<Spu | undefined> {
    const [spu] = await db.select().from(spus).where(eq(spus.id, id));
    return spu || undefined;
  }

  async getSpuByName(name: string): Promise<Spu | undefined> {
    const normalized = name.trim().toLowerCase();
    const allSpus = await db.select().from(spus);
    return allSpus.find(s => s.name.toLowerCase() === normalized);
  }

  async findOrCreateSpu(name: string): Promise<Spu> {
    const existing = await this.getSpuByName(name);
    if (existing) return existing;
    return await this.createSpu({ name: name.trim() });
  }

  async createSpu(spu: InsertSpu): Promise<Spu> {
    const [createdSpu] = await db
      .insert(spus)
      .values(spu)
      .returning();
    return createdSpu;
  }

  async updateSpu(id: string, updates: Partial<InsertSpu>): Promise<Spu> {
    const [updatedSpu] = await db
      .update(spus)
      .set(updates)
      .where(eq(spus.id, id))
      .returning();
    return updatedSpu;
  }

  async deleteSpu(id: string): Promise<void> {
    await db.delete(spus).where(eq(spus.id, id));
  }

  async getAllSubUnits(): Promise<SubUnit[]> {
    return await db.select().from(subUnits).orderBy(asc(subUnits.name));
  }

  async getSubUnit(id: string): Promise<SubUnit | undefined> {
    const [subUnit] = await db.select().from(subUnits).where(eq(subUnits.id, id));
    return subUnit || undefined;
  }

  async getSubUnitByNameAndSpu(name: string, spuId: string): Promise<SubUnit | undefined> {
    const normalized = name.trim().toLowerCase();
    const allSubUnits = await db.select().from(subUnits).where(eq(subUnits.spuId, spuId));
    return allSubUnits.find(s => s.name.toLowerCase() === normalized);
  }

  async findOrCreateSubUnit(name: string, spuId: string): Promise<SubUnit> {
    const existing = await this.getSubUnitByNameAndSpu(name, spuId);
    if (existing) return existing;
    return await this.createSubUnit({ name: name.trim(), spuId });
  }

  async createSubUnit(subUnit: InsertSubUnit): Promise<SubUnit> {
    const [createdSubUnit] = await db
      .insert(subUnits)
      .values(subUnit)
      .returning();
    return createdSubUnit;
  }

  async updateSubUnit(id: string, updates: Partial<InsertSubUnit>): Promise<SubUnit> {
    const [updatedSubUnit] = await db
      .update(subUnits)
      .set(updates)
      .where(eq(subUnits.id, id))
      .returning();
    return updatedSubUnit;
  }

  async deleteSubUnit(id: string): Promise<void> {
    await db.delete(subUnits).where(eq(subUnits.id, id));
  }

  async getAllYears(): Promise<Year[]> {
    return await db.select().from(years);
  }

  async getYear(id: string): Promise<Year | undefined> {
    const [year] = await db.select().from(years).where(eq(years.id, id));
    return year || undefined;
  }

  async getYearByValue(yearValue: number): Promise<Year | undefined> {
    const [year] = await db.select().from(years).where(eq(years.year, yearValue));
    return year || undefined;
  }

  async findOrCreateYear(yearValue: number): Promise<Year> {
    const existing = await this.getYearByValue(yearValue);
    if (existing) return existing;
    return await this.createYear({ year: yearValue });
  }

  async createYear(year: InsertYear): Promise<Year> {
    const [createdYear] = await db
      .insert(years)
      .values(year)
      .returning();
    return createdYear;
  }

  async deleteYear(id: string): Promise<void> {
    await db.delete(years).where(eq(years.id, id));
  }

  async getAllOkrs(): Promise<Okr[]> {
    return await db.select().from(okrs);
  }

  async getAllOkrsWithDetails(): Promise<OkrWithDetails[]> {
    const okrSpu = alias(spus, 'okrSpu');
    const okrSubUnit = alias(subUnits, 'okrSubUnit');
    const staffSpu = alias(spus, 'staffSpu');
    const staffSubUnit = alias(subUnits, 'staffSubUnit');
    const collaborationSpu = alias(spus, 'collaborationSpu');
    
    const result = await db
      .select({
        okr: okrs,
        staff: staff,
        okrSpu: okrSpu,
        okrSubUnit: okrSubUnit,
        staffSpu: staffSpu,
        staffSubUnit: staffSubUnit,
        collaborationSpu: collaborationSpu,
      })
      .from(okrs)
      .leftJoin(staff, eq(okrs.staffId, staff.id))
      .leftJoin(okrSpu, eq(okrs.spuId, okrSpu.id))
      .leftJoin(okrSubUnit, eq(okrs.subUnitId, okrSubUnit.id))
      .leftJoin(staffSpu, eq(staff.spuId, staffSpu.id))
      .leftJoin(staffSubUnit, eq(staff.subUnitId, staffSubUnit.id))
      .leftJoin(collaborationSpu, eq(okrs.collaborationSpuId, collaborationSpu.id));

    return result.map((row) => ({
      ...row.okr,
      staff: {
        ...row.staff!,
        spu: row.staffSpu!,
        subUnit: row.staffSubUnit || null,
      },
      spu: row.okrSpu || null,
      subUnit: row.okrSubUnit || null,
      collaborationSpu: row.collaborationSpu || null,
    }));
  }

  async getOkr(id: string): Promise<Okr | undefined> {
    const [okr] = await db.select().from(okrs).where(eq(okrs.id, id));
    return okr || undefined;
  }

  async getOkrsByStaff(staffId: string): Promise<Okr[]> {
    return await db.select().from(okrs).where(eq(okrs.staffId, staffId));
  }

  async getOkrsBySpu(spuId: string): Promise<Okr[]> {
    return await db.select().from(okrs).where(eq(okrs.spuId, spuId));
  }

  async countOkrsBySpu(spuId: string, year: number): Promise<number> {
    const result = await db.select().from(okrs).where(and(eq(okrs.spuId, spuId), eq(okrs.year, year)));
    return result.length;
  }

  async getOkrsWithDetailsBySpu(spuId: string): Promise<OkrWithDetails[]> {
    const okrSpu = alias(spus, 'okrSpu');
    const okrSubUnit = alias(subUnits, 'okrSubUnit');
    const staffSpu = alias(spus, 'staffSpu');
    const staffSubUnit = alias(subUnits, 'staffSubUnit');
    const collaborationSpu = alias(spus, 'collaborationSpu');
    
    const result = await db
      .select({
        okr: okrs,
        staff: staff,
        okrSpu: okrSpu,
        okrSubUnit: okrSubUnit,
        staffSpu: staffSpu,
        staffSubUnit: staffSubUnit,
        collaborationSpu: collaborationSpu,
      })
      .from(okrs)
      .leftJoin(staff, eq(okrs.staffId, staff.id))
      .leftJoin(okrSpu, eq(okrs.spuId, okrSpu.id))
      .leftJoin(okrSubUnit, eq(okrs.subUnitId, okrSubUnit.id))
      .leftJoin(staffSpu, eq(staff.spuId, staffSpu.id))
      .leftJoin(staffSubUnit, eq(staff.subUnitId, staffSubUnit.id))
      .leftJoin(collaborationSpu, eq(okrs.collaborationSpuId, collaborationSpu.id))
      .where(eq(okrs.spuId, spuId));

    return result.map((row) => ({
      ...row.okr,
      staff: row.staff ? {
        ...row.staff,
        spu: row.staffSpu!,
        subUnit: row.staffSubUnit || null,
      } : {
        id: row.okr.staffId || "deleted",
        staffIdNumber: null,
        name: row.okr.submitterName || "Unknown",
        email: "",
        spuId: row.okr.spuId,
        subUnitId: null,
        isAdmin: false,
        role: "basic" as const,
        spu: row.okrSpu!,
        subUnit: null,
      },
      spu: row.okrSpu || null,
      subUnit: row.okrSubUnit || null,
      collaborationSpu: row.collaborationSpu || null,
    }));
  }

  async createOkr(insertOkr: InsertOkr & { okrNumber: string }): Promise<Okr> {
    const [okr] = await db
      .insert(okrs)
      .values(insertOkr)
      .returning();
    return okr;
  }

  async updateOkr(id: string, updates: Partial<Okr>): Promise<Okr> {
    const [okr] = await db
      .update(okrs)
      .set(updates)
      .where(eq(okrs.id, id))
      .returning();
    return okr;
  }

  async deleteOkr(id: string): Promise<void> {
    await db.delete(okrs).where(eq(okrs.id, id));
  }

  async getAllQuarterlyUpdates(): Promise<QuarterlyUpdate[]> {
    return await db.select().from(quarterlyUpdates);
  }

  async getQuarterlyUpdate(id: string): Promise<QuarterlyUpdate | undefined> {
    const [update] = await db.select().from(quarterlyUpdates).where(eq(quarterlyUpdates.id, id));
    return update || undefined;
  }

  async getQuarterlyUpdatesByOkr(okrId: string): Promise<QuarterlyUpdate[]> {
    return await db.select().from(quarterlyUpdates).where(eq(quarterlyUpdates.okrId, okrId));
  }

  async createQuarterlyUpdate(insertUpdate: InsertQuarterlyUpdate): Promise<QuarterlyUpdate> {
    // Simply create the quarterly update without modifying the parent OKR
    // The dashboard and other consumers should calculate current progress
    // from the latest quarterly update's averageScore when needed
    const [update] = await db
      .insert(quarterlyUpdates)
      .values(insertUpdate)
      .returning();
    
    return update;
  }

  async updateQuarterlyUpdate(id: string, updates: Partial<InsertQuarterlyUpdate>): Promise<QuarterlyUpdate> {
    const [update] = await db
      .update(quarterlyUpdates)
      .set(updates)
      .where(eq(quarterlyUpdates.id, id))
      .returning();
    return update;
  }

  async deleteQuarterlyUpdate(id: string): Promise<void> {
    await db.delete(quarterlyUpdates).where(eq(quarterlyUpdates.id, id));
  }

  async createOkrResponsibility(responsibility: InsertOkrResponsibility): Promise<OkrResponsibility> {
    const [result] = await db
      .insert(okrResponsibilities)
      .values(responsibility)
      .returning();
    return result;
  }

  async getOkrResponsibilities(okrId: string): Promise<OkrResponsibility[]> {
    return await db.select().from(okrResponsibilities).where(eq(okrResponsibilities.okrId, okrId));
  }

  async deleteOkrResponsibility(id: string): Promise<void> {
    await db.delete(okrResponsibilities).where(eq(okrResponsibilities.id, id));
  }

  async getEmployeeProgress(filters: {
    year?: number;
    quarter?: string;
    staffId?: string;
    spuId?: string;
    status?: string;
  }): Promise<EmployeeProgressRecord[]> {
    const collaborationSpu = alias(spus, "collaboration_spu");
    const staffSpu = alias(spus, "staff_spu");
    const staffSubUnit = alias(subUnits, "staff_sub_unit");

    // Build filter conditions
    const conditions = [];
    if (filters.year !== undefined) {
      conditions.push(eq(okrs.year, filters.year));
    }
    if (filters.quarter) {
      conditions.push(eq(okrs.quarter, filters.quarter));
    }
    if (filters.staffId) {
      conditions.push(eq(okrs.staffId, filters.staffId));
    }
    if (filters.spuId) {
      conditions.push(eq(okrs.spuId, filters.spuId));
    }
    if (filters.status) {
      conditions.push(eq(okrs.status, filters.status));
    }

    // Build the base query with all joins
    let query = db
      .select()
      .from(okrs)
      .leftJoin(staff, eq(okrs.staffId, staff.id))
      .leftJoin(spus, eq(okrs.spuId, spus.id))
      .leftJoin(subUnits, eq(okrs.subUnitId, subUnits.id))
      .leftJoin(collaborationSpu, eq(okrs.collaborationSpuId, collaborationSpu.id))
      .leftJoin(staffSpu, eq(staff.spuId, staffSpu.id))
      .leftJoin(staffSubUnit, eq(staff.subUnitId, staffSubUnit.id));

    // Apply filters if any
    const okrResults = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;

    if (okrResults.length === 0) return [];

    const okrIds = okrResults.map(row => row.okrs.id);

    const [allUpdates, allResponsibilities] = await Promise.all([
      db
        .select()
        .from(quarterlyUpdates)
        .where(inArray(quarterlyUpdates.okrId, okrIds))
        .orderBy(desc(quarterlyUpdates.submittedAt)),
      db
        .select({
          id: okrResponsibilities.id,
          okrId: okrResponsibilities.okrId,
          staffId: okrResponsibilities.staffId,
          role: okrResponsibilities.role,
          staff: staff,
          spu: spus,
          subUnit: subUnits,
        })
        .from(okrResponsibilities)
        .leftJoin(staff, eq(okrResponsibilities.staffId, staff.id))
        .leftJoin(spus, eq(staff.spuId, spus.id))
        .leftJoin(subUnits, eq(staff.subUnitId, subUnits.id))
        .where(inArray(okrResponsibilities.okrId, okrIds)),
    ]);

    const updatesMap = new Map<string, typeof allUpdates>();
    for (const update of allUpdates) {
      if (!updatesMap.has(update.okrId)) {
        updatesMap.set(update.okrId, []);
      }
      updatesMap.get(update.okrId)!.push(update);
    }

    const responsibilitiesMap = new Map<string, typeof allResponsibilities>();
    for (const resp of allResponsibilities) {
      if (!responsibilitiesMap.has(resp.okrId)) {
        responsibilitiesMap.set(resp.okrId, []);
      }
      responsibilitiesMap.get(resp.okrId)!.push(resp);
    }

    const progressRecords: EmployeeProgressRecord[] = okrResults.map(row => {
      const okrId = row.okrs.id;
      const updates = updatesMap.get(okrId) || [];
      const primaryUpdates = updates.filter(u => u.isPrimaryScore !== false);
      const latestUpdate = primaryUpdates.length > 0 ? primaryUpdates[0] : (updates.length > 0 ? updates[0] : null);
      const responsibilities = responsibilitiesMap.get(okrId) || [];

      return {
        okr: {
          ...row.okrs,
          staff: {
            ...row.staff!,
            spu: row.staff_spu!,
            subUnit: row.staff_sub_unit,
          },
          spu: row.spus,
          subUnit: row.sub_units,
          collaborationSpu: row.collaboration_spu,
        },
        latestUpdate,
        responsibilities: responsibilities.map(r => ({
          id: r.id,
          okrId: r.okrId,
          staffId: r.staffId,
          role: r.role,
          staff: {
            ...r.staff!,
            spu: r.spu!,
            subUnit: r.subUnit,
          },
        })),
        quarterlyUpdates: updates,
      };
    });

    return progressRecords;
  }

  async getEmployeeProgressGrouped(filters: {
    year?: number;
    quarter?: string;
    staffId?: string;
    spuId?: string;
    status?: string;
  }): Promise<EmployeeProgressSummary[]> {
    // Get all employee progress records
    const records = await this.getEmployeeProgress(filters);
    
    // Group by staff member
    const staffMap = new Map<string, EmployeeProgressRecord[]>();
    
    for (const record of records) {
      const staffId = record.okr.staff.id;
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, []);
      }
      staffMap.get(staffId)!.push(record);
    }
    
    // Calculate summaries for each staff member
    const summaries: EmployeeProgressSummary[] = [];
    
    for (const [staffId, staffRecords] of Array.from(staffMap.entries())) {
      const staff = staffRecords[0].okr.staff;
      
      // Calculate overall progress (average across all OKRs, treating missing updates as 0)
      const okrsWithProgress = staffRecords.map((r: EmployeeProgressRecord) => {
        if (!r.latestUpdate || r.latestUpdate.averageScore === null || r.latestUpdate.averageScore === undefined || isNaN(r.latestUpdate.averageScore)) {
          return 0;
        }
        return r.latestUpdate.averageScore;
      });
      const overallProgress = okrsWithProgress.length > 0
        ? Math.round(okrsWithProgress.reduce((sum: number, score: number) => sum + score, 0) / okrsWithProgress.length)
        : 0;
      
      summaries.push({
        staff,
        overallProgress,
        okrCount: staffRecords.length,
        okrs: staffRecords,
      });
    }
    
    // Sort by staff name
    summaries.sort((a, b) => a.staff.name.localeCompare(b.staff.name));
    
    return summaries;
  }

  // Staff SPU Assignments
  async getStaffSpuAssignments(staffId: string): Promise<StaffSpuAssignmentWithDetails[]> {
    const result = await db
      .select({
        id: staffSpuAssignments.id,
        staffId: staffSpuAssignments.staffId,
        spuId: staffSpuAssignments.spuId,
        subUnitId: staffSpuAssignments.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(staffSpuAssignments)
      .leftJoin(spus, eq(staffSpuAssignments.spuId, spus.id))
      .leftJoin(subUnits, eq(staffSpuAssignments.subUnitId, subUnits.id))
      .where(eq(staffSpuAssignments.staffId, staffId));

    return result.map((row) => ({
      id: row.id,
      staffId: row.staffId,
      spuId: row.spuId,
      subUnitId: row.subUnitId,
      spu: row.spu!,
      subUnit: row.subUnit || null,
    }));
  }

  async getAllStaffSpuAssignments(): Promise<StaffSpuAssignmentWithDetails[]> {
    const result = await db
      .select({
        id: staffSpuAssignments.id,
        staffId: staffSpuAssignments.staffId,
        spuId: staffSpuAssignments.spuId,
        subUnitId: staffSpuAssignments.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(staffSpuAssignments)
      .leftJoin(spus, eq(staffSpuAssignments.spuId, spus.id))
      .leftJoin(subUnits, eq(staffSpuAssignments.subUnitId, subUnits.id));

    return result.map((row) => ({
      id: row.id,
      staffId: row.staffId,
      spuId: row.spuId,
      subUnitId: row.subUnitId,
      spu: row.spu!,
      subUnit: row.subUnit || null,
    }));
  }

  async createStaffSpuAssignment(assignment: InsertStaffSpuAssignment): Promise<StaffSpuAssignment> {
    const [result] = await db
      .insert(staffSpuAssignments)
      .values(assignment)
      .returning();
    return result;
  }

  async deleteStaffSpuAssignment(id: string): Promise<void> {
    await db.delete(staffSpuAssignments).where(eq(staffSpuAssignments.id, id));
  }

  async getStaffBySpuAssignment(spuId: string): Promise<StaffWithDetails[]> {
    const result = await db
      .select({
        id: staff.id,
        staffIdNumber: staff.staffIdNumber,
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        role: staff.role,
        spuId: staff.spuId,
        subUnitId: staff.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(staffSpuAssignments)
      .innerJoin(staff, eq(staffSpuAssignments.staffId, staff.id))
      .leftJoin(spus, eq(staff.spuId, spus.id))
      .leftJoin(subUnits, eq(staff.subUnitId, subUnits.id))
      .where(eq(staffSpuAssignments.spuId, spuId));

    return result.map((row) => ({
      id: row.id,
      staffIdNumber: row.staffIdNumber,
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      role: row.role,
      spuId: row.spuId,
      subUnitId: row.subUnitId,
      spu: row.spu!,
      subUnit: row.subUnit || null,
    }));
  }

  // Leader-Basic Relationships
  async getLeadersForBasicUser(basicId: string): Promise<StaffWithDetails[]> {
    const result = await db
      .select({
        id: staff.id,
        staffIdNumber: staff.staffIdNumber,
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        role: staff.role,
        spuId: staff.spuId,
        subUnitId: staff.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(leaderBasicAssignments)
      .innerJoin(staff, eq(leaderBasicAssignments.leaderId, staff.id))
      .leftJoin(spus, eq(staff.spuId, spus.id))
      .leftJoin(subUnits, eq(staff.subUnitId, subUnits.id))
      .where(eq(leaderBasicAssignments.basicId, basicId));

    return result.map((row) => ({
      id: row.id,
      staffIdNumber: row.staffIdNumber,
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      role: row.role,
      spuId: row.spuId,
      subUnitId: row.subUnitId,
      spu: row.spu!,
      subUnit: row.subUnit || null,
    }));
  }

  async getBasicUsersForLeader(leaderId: string): Promise<StaffWithDetails[]> {
    const result = await db
      .select({
        id: staff.id,
        staffIdNumber: staff.staffIdNumber,
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        role: staff.role,
        spuId: staff.spuId,
        subUnitId: staff.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(leaderBasicAssignments)
      .innerJoin(staff, eq(leaderBasicAssignments.basicId, staff.id))
      .leftJoin(spus, eq(staff.spuId, spus.id))
      .leftJoin(subUnits, eq(staff.subUnitId, subUnits.id))
      .where(eq(leaderBasicAssignments.leaderId, leaderId));

    return result.map((row) => ({
      id: row.id,
      staffIdNumber: row.staffIdNumber,
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      role: row.role,
      spuId: row.spuId,
      subUnitId: row.subUnitId,
      spu: row.spu!,
      subUnit: row.subUnit || null,
    }));
  }

  async getTeamMembersForLeader(leaderId: string): Promise<StaffWithDetails[]> {
    // Get the leader's info
    const leader = await this.getStaff(leaderId);
    if (!leader) return [];

    // Collect all SPU IDs: primary SPU + additional assignments
    const spuIds: string[] = [leader.spuId];
    const assignments = await this.getStaffSpuAssignments(leaderId);
    for (const a of assignments) {
      if (!spuIds.includes(a.spuId)) {
        spuIds.push(a.spuId);
      }
    }

    // Get all staff in those SPUs (excluding the leader themselves)
    const result = await db
      .select({
        id: staff.id,
        staffIdNumber: staff.staffIdNumber,
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        role: staff.role,
        spuId: staff.spuId,
        subUnitId: staff.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(staff)
      .leftJoin(spus, eq(staff.spuId, spus.id))
      .leftJoin(subUnits, eq(staff.subUnitId, subUnits.id))
      .where(and(
        inArray(staff.spuId, spuIds),
        ne(staff.id, leaderId)
      ));

    return result.map((row) => ({
      id: row.id,
      staffIdNumber: row.staffIdNumber,
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      role: row.role,
      spuId: row.spuId,
      subUnitId: row.subUnitId,
      spu: row.spu!,
      subUnit: row.subUnit || null,
    }));
  }

  async createLeaderBasicAssignment(assignment: InsertLeaderBasicAssignment): Promise<LeaderBasicAssignment> {
    const [result] = await db
      .insert(leaderBasicAssignments)
      .values(assignment)
      .returning();
    return result;
  }

  async deleteLeaderBasicAssignment(leaderId: string, basicId: string): Promise<void> {
    await db.delete(leaderBasicAssignments).where(
      and(
        eq(leaderBasicAssignments.leaderId, leaderId),
        eq(leaderBasicAssignments.basicId, basicId)
      )
    );
  }

  // App Settings
  async getSetting(key: string): Promise<string | null> {
    const [result] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return result?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });
  }

  // Staff lookup by ID number or email
  async getStaffByIdNumber(staffIdNumber: string): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(eq(staff.staffIdNumber, staffIdNumber));
    return result || undefined;
  }

  async getStaffByEmail(email: string): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(eq(staff.email, email));
    return result || undefined;
  }

  async getAllUniversityObjectives(): Promise<UniversityObjectiveWithKeyResults[]> {
    const objectives = await db.select().from(universityObjectives).orderBy(asc(universityObjectives.sortOrder));
    const krs = await db.select().from(universityKeyResults).orderBy(asc(universityKeyResults.sortOrder));
    return objectives.map(obj => ({
      ...obj,
      keyResults: krs.filter(kr => kr.objectiveId === obj.id),
    }));
  }

  async createUniversityObjective(obj: InsertUniversityObjective): Promise<UniversityObjective> {
    const [result] = await db.insert(universityObjectives).values(obj).returning();
    return result;
  }

  async updateUniversityObjective(id: string, updates: Partial<InsertUniversityObjective>): Promise<UniversityObjective> {
    const [result] = await db.update(universityObjectives).set(updates).where(eq(universityObjectives.id, id)).returning();
    return result;
  }

  async deleteUniversityObjective(id: string): Promise<void> {
    await db.delete(universityObjectives).where(eq(universityObjectives.id, id));
  }

  async createUniversityKeyResult(kr: InsertUniversityKeyResult): Promise<UniversityKeyResult> {
    const [result] = await db.insert(universityKeyResults).values(kr).returning();
    return result;
  }

  async updateUniversityKeyResult(id: string, updates: Partial<InsertUniversityKeyResult>): Promise<UniversityKeyResult> {
    const [result] = await db.update(universityKeyResults).set(updates).where(eq(universityKeyResults.id, id)).returning();
    return result;
  }

  async deleteUniversityKeyResult(id: string): Promise<void> {
    await db.delete(universityKeyResults).where(eq(universityKeyResults.id, id));
  }

  async createEditLog(log: InsertEditLog): Promise<EditLog> {
    const [result] = await db.insert(editLogs).values(log).returning();
    return result;
  }

  async getAllEditLogs(): Promise<EditLog[]> {
    return await db.select().from(editLogs).orderBy(desc(editLogs.editedAt));
  }
}

export const storage = new DatabaseStorage();
