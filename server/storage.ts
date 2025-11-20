import {
  type Staff,
  type Spu,
  type SubUnit,
  type Okr,
  type QuarterlyUpdate,
  type InsertStaff,
  type InsertSpu,
  type InsertSubUnit,
  type InsertOkr,
  type InsertQuarterlyUpdate,
  type StaffWithDetails,
  type OkrWithDetails,
  spus,
  subUnits,
  staff,
  okrs,
  quarterlyUpdates,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface IStorage {
  verifyPassword(password: string): Promise<{ isValid: boolean; isAdmin: boolean }>;
  
  getAllStaff(): Promise<Staff[]>;
  getAllStaffWithDetails(): Promise<StaffWithDetails[]>;
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffWithDetails(id: string): Promise<StaffWithDetails | undefined>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff>;
  deleteStaff(id: string): Promise<void>;
  
  getAllSpus(): Promise<Spu[]>;
  getSpu(id: string): Promise<Spu | undefined>;
  createSpu(spu: InsertSpu): Promise<Spu>;
  updateSpu(id: string, updates: Partial<InsertSpu>): Promise<Spu>;
  deleteSpu(id: string): Promise<void>;
  
  getAllSubUnits(): Promise<SubUnit[]>;
  getSubUnit(id: string): Promise<SubUnit | undefined>;
  createSubUnit(subUnit: InsertSubUnit): Promise<SubUnit>;
  updateSubUnit(id: string, updates: Partial<InsertSubUnit>): Promise<SubUnit>;
  deleteSubUnit(id: string): Promise<void>;
  
  getAllOkrs(): Promise<Okr[]>;
  getAllOkrsWithDetails(): Promise<OkrWithDetails[]>;
  getOkr(id: string): Promise<Okr | undefined>;
  getOkrsByStaff(staffId: string): Promise<Okr[]>;
  createOkr(okr: InsertOkr): Promise<Okr>;
  updateOkr(id: string, updates: Partial<Okr>): Promise<Okr>;
  deleteOkr(id: string): Promise<void>;
  
  getAllQuarterlyUpdates(): Promise<QuarterlyUpdate[]>;
  getQuarterlyUpdate(id: string): Promise<QuarterlyUpdate | undefined>;
  getQuarterlyUpdatesByOkr(okrId: string): Promise<QuarterlyUpdate[]>;
  createQuarterlyUpdate(update: InsertQuarterlyUpdate): Promise<QuarterlyUpdate>;
  deleteQuarterlyUpdate(id: string): Promise<void>;
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
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
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
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
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
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
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
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
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
    await db.delete(staff).where(eq(staff.id, id));
  }

  async getAllSpus(): Promise<Spu[]> {
    return await db.select().from(spus);
  }

  async getSpu(id: string): Promise<Spu | undefined> {
    const [spu] = await db.select().from(spus).where(eq(spus.id, id));
    return spu || undefined;
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
    return await db.select().from(subUnits);
  }

  async getSubUnit(id: string): Promise<SubUnit | undefined> {
    const [subUnit] = await db.select().from(subUnits).where(eq(subUnits.id, id));
    return subUnit || undefined;
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

  async createOkr(insertOkr: InsertOkr): Promise<Okr> {
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

  async deleteQuarterlyUpdate(id: string): Promise<void> {
    await db.delete(quarterlyUpdates).where(eq(quarterlyUpdates.id, id));
  }
}

export const storage = new DatabaseStorage();
