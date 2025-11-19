import {
  type Staff,
  type Department,
  type SubDepartment,
  type Okr,
  type QuarterlyUpdate,
  type InsertStaff,
  type InsertDepartment,
  type InsertSubDepartment,
  type InsertOkr,
  type InsertQuarterlyUpdate,
  type StaffWithDetails,
  type OkrWithDetails,
  departments,
  subDepartments,
  staff,
  okrs,
  quarterlyUpdates,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  verifyPassword(password: string): Promise<{ isValid: boolean; isAdmin: boolean }>;
  
  getAllStaff(): Promise<Staff[]>;
  getAllStaffWithDetails(): Promise<StaffWithDetails[]>;
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffWithDetails(id: string): Promise<StaffWithDetails | undefined>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  deleteStaff(id: string): Promise<void>;
  
  getAllDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(dept: InsertDepartment): Promise<Department>;
  deleteDepartment(id: string): Promise<void>;
  
  getAllSubDepartments(): Promise<SubDepartment[]>;
  getSubDepartment(id: string): Promise<SubDepartment | undefined>;
  createSubDepartment(subDept: InsertSubDepartment): Promise<SubDepartment>;
  deleteSubDepartment(id: string): Promise<void>;
  
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
        departmentId: staff.departmentId,
        subDepartmentId: staff.subDepartmentId,
        department: departments,
        subDepartment: subDepartments,
      })
      .from(staff)
      .leftJoin(departments, eq(staff.departmentId, departments.id))
      .leftJoin(subDepartments, eq(staff.subDepartmentId, subDepartments.id));

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      departmentId: row.departmentId,
      subDepartmentId: row.subDepartmentId,
      department: row.department!,
      subDepartment: row.subDepartment,
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
        departmentId: staff.departmentId,
        subDepartmentId: staff.subDepartmentId,
        department: departments,
        subDepartment: subDepartments,
      })
      .from(staff)
      .leftJoin(departments, eq(staff.departmentId, departments.id))
      .leftJoin(subDepartments, eq(staff.subDepartmentId, subDepartments.id))
      .where(eq(staff.id, id));

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      departmentId: row.departmentId,
      subDepartmentId: row.subDepartmentId,
      department: row.department!,
      subDepartment: row.subDepartment,
    };
  }

  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    const [staffMember] = await db
      .insert(staff)
      .values(insertStaff)
      .returning();
    return staffMember;
  }

  async deleteStaff(id: string): Promise<void> {
    await db.delete(staff).where(eq(staff.id, id));
  }

  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept || undefined;
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [department] = await db
      .insert(departments)
      .values(dept)
      .returning();
    return department;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getAllSubDepartments(): Promise<SubDepartment[]> {
    return await db.select().from(subDepartments);
  }

  async getSubDepartment(id: string): Promise<SubDepartment | undefined> {
    const [subDept] = await db.select().from(subDepartments).where(eq(subDepartments.id, id));
    return subDept || undefined;
  }

  async createSubDepartment(subDept: InsertSubDepartment): Promise<SubDepartment> {
    const [subDepartment] = await db
      .insert(subDepartments)
      .values(subDept)
      .returning();
    return subDepartment;
  }

  async deleteSubDepartment(id: string): Promise<void> {
    await db.delete(subDepartments).where(eq(subDepartments.id, id));
  }

  async getAllOkrs(): Promise<Okr[]> {
    return await db.select().from(okrs);
  }

  async getAllOkrsWithDetails(): Promise<OkrWithDetails[]> {
    const result = await db
      .select({
        okr: okrs,
        staff: staff,
        department: departments,
        subDepartment: subDepartments,
      })
      .from(okrs)
      .leftJoin(staff, eq(okrs.staffId, staff.id))
      .leftJoin(departments, eq(staff.departmentId, departments.id))
      .leftJoin(subDepartments, eq(staff.subDepartmentId, subDepartments.id));

    return result.map((row) => ({
      ...row.okr,
      staff: {
        ...row.staff!,
        department: row.department!,
        subDepartment: row.subDepartment,
      },
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
    const [update] = await db
      .insert(quarterlyUpdates)
      .values(insertUpdate)
      .returning();
    
    const okr = await this.getOkr(insertUpdate.okrId);
    if (okr) {
      const updates: Partial<Okr> = {
        currentValue: insertUpdate.progress,
      };

      if (insertUpdate.progress === 0) {
        updates.status = "not_started";
      } else if (insertUpdate.progress >= okr.targetValue) {
        updates.status = "completed";
      } else if (insertUpdate.progress < okr.targetValue * 0.5) {
        updates.status = "at_risk";
      } else {
        updates.status = "in_progress";
      }

      await this.updateOkr(okr.id, updates);
    }
    
    return update;
  }

  async deleteQuarterlyUpdate(id: string): Promise<void> {
    await db.delete(quarterlyUpdates).where(eq(quarterlyUpdates.id, id));
  }
}

export const storage = new DatabaseStorage();
