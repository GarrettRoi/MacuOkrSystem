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
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  verifyPassword(password: string): Promise<boolean>;
  
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

export class MemStorage implements IStorage {
  private accessPassword: string = "14:12";
  private departments: Map<string, Department> = new Map();
  private subDepartments: Map<string, SubDepartment> = new Map();
  private staff: Map<string, Staff> = new Map();
  private okrs: Map<string, Okr> = new Map();
  private quarterlyUpdates: Map<string, QuarterlyUpdate> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    const dept1 = this.createDepartmentSync({ name: "Academic Affairs" });
    const dept2 = this.createDepartmentSync({ name: "Student Services" });
    const dept3 = this.createDepartmentSync({ name: "Administration" });

    const subDept1 = this.createSubDepartmentSync({ name: "Undergraduate Studies", departmentId: dept1.id });
    const subDept2 = this.createSubDepartmentSync({ name: "Graduate Programs", departmentId: dept1.id });

    this.createStaffSync({
      name: "Dr. Sarah Johnson",
      email: "sarah.johnson@macu.edu",
      departmentId: dept1.id,
      subDepartmentId: subDept1.id,
    });

    this.createStaffSync({
      name: "Michael Chen",
      email: "michael.chen@macu.edu",
      departmentId: dept2.id,
      subDepartmentId: undefined,
    });

    this.createStaffSync({
      name: "Emily Rodriguez",
      email: "emily.rodriguez@macu.edu",
      departmentId: dept3.id,
      subDepartmentId: undefined,
    });
  }

  private createDepartmentSync(dept: InsertDepartment): Department {
    const id = randomUUID();
    const department: Department = { ...dept, id };
    this.departments.set(id, department);
    return department;
  }

  private createSubDepartmentSync(subDept: InsertSubDepartment): SubDepartment {
    const id = randomUUID();
    const subDepartment: SubDepartment = { ...subDept, id };
    this.subDepartments.set(id, subDepartment);
    return subDepartment;
  }

  private createStaffSync(staff: InsertStaff): Staff {
    const id = randomUUID();
    const staffMember: Staff = {
      id,
      name: staff.name,
      email: staff.email,
      departmentId: staff.departmentId,
      subDepartmentId: staff.subDepartmentId || null,
    };
    this.staff.set(id, staffMember);
    return staffMember;
  }

  async verifyPassword(password: string): Promise<boolean> {
    return password === this.accessPassword;
  }

  async getAllStaff(): Promise<Staff[]> {
    return Array.from(this.staff.values());
  }

  async getAllStaffWithDetails(): Promise<StaffWithDetails[]> {
    const staffList = Array.from(this.staff.values());
    return staffList.map((s) => {
      const department = this.departments.get(s.departmentId)!;
      const subDepartment = s.subDepartmentId ? this.subDepartments.get(s.subDepartmentId) : undefined;
      return {
        ...s,
        department,
        subDepartment: subDepartment || null,
      };
    });
  }

  async getStaff(id: string): Promise<Staff | undefined> {
    return this.staff.get(id);
  }

  async getStaffWithDetails(id: string): Promise<StaffWithDetails | undefined> {
    const staff = this.staff.get(id);
    if (!staff) return undefined;
    const department = this.departments.get(staff.departmentId)!;
    const subDepartment = staff.subDepartmentId ? this.subDepartments.get(staff.subDepartmentId) : undefined;
    return {
      ...staff,
      department,
      subDepartment: subDepartment || null,
    };
  }

  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    const id = randomUUID();
    const staff: Staff = {
      id,
      name: insertStaff.name,
      email: insertStaff.email,
      departmentId: insertStaff.departmentId,
      subDepartmentId: insertStaff.subDepartmentId || null,
    };
    this.staff.set(id, staff);
    return staff;
  }

  async deleteStaff(id: string): Promise<void> {
    this.staff.delete(id);
  }

  async getAllDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    return this.departments.get(id);
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const id = randomUUID();
    const department: Department = { ...dept, id };
    this.departments.set(id, department);
    return department;
  }

  async deleteDepartment(id: string): Promise<void> {
    this.departments.delete(id);
  }

  async getAllSubDepartments(): Promise<SubDepartment[]> {
    return Array.from(this.subDepartments.values());
  }

  async getSubDepartment(id: string): Promise<SubDepartment | undefined> {
    return this.subDepartments.get(id);
  }

  async createSubDepartment(subDept: InsertSubDepartment): Promise<SubDepartment> {
    const id = randomUUID();
    const subDepartment: SubDepartment = { ...subDept, id };
    this.subDepartments.set(id, subDepartment);
    return subDepartment;
  }

  async deleteSubDepartment(id: string): Promise<void> {
    this.subDepartments.delete(id);
  }

  async getAllOkrs(): Promise<Okr[]> {
    return Array.from(this.okrs.values());
  }

  async getAllOkrsWithDetails(): Promise<OkrWithDetails[]> {
    const okrList = Array.from(this.okrs.values());
    const result: OkrWithDetails[] = [];
    
    for (const okr of okrList) {
      const staff = this.staff.get(okr.staffId);
      if (staff) {
        const department = this.departments.get(staff.departmentId)!;
        const subDepartment = staff.subDepartmentId ? this.subDepartments.get(staff.subDepartmentId) : undefined;
        result.push({
          ...okr,
          staff: {
            ...staff,
            department,
            subDepartment: subDepartment || null,
          },
        });
      }
    }
    
    return result;
  }

  async getOkr(id: string): Promise<Okr | undefined> {
    return this.okrs.get(id);
  }

  async getOkrsByStaff(staffId: string): Promise<Okr[]> {
    return Array.from(this.okrs.values()).filter((okr) => okr.staffId === staffId);
  }

  async createOkr(insertOkr: InsertOkr): Promise<Okr> {
    const id = randomUUID();
    const okr: Okr = {
      id,
      ...insertOkr,
      currentValue: 0,
      status: "not_started",
      createdAt: new Date(),
    };
    this.okrs.set(id, okr);
    return okr;
  }

  async updateOkr(id: string, updates: Partial<Okr>): Promise<Okr> {
    const okr = this.okrs.get(id);
    if (!okr) throw new Error("OKR not found");
    const updated = { ...okr, ...updates };
    this.okrs.set(id, updated);
    return updated;
  }

  async deleteOkr(id: string): Promise<void> {
    this.okrs.delete(id);
  }

  async getAllQuarterlyUpdates(): Promise<QuarterlyUpdate[]> {
    return Array.from(this.quarterlyUpdates.values());
  }

  async getQuarterlyUpdate(id: string): Promise<QuarterlyUpdate | undefined> {
    return this.quarterlyUpdates.get(id);
  }

  async getQuarterlyUpdatesByOkr(okrId: string): Promise<QuarterlyUpdate[]> {
    return Array.from(this.quarterlyUpdates.values()).filter((update) => update.okrId === okrId);
  }

  async createQuarterlyUpdate(insertUpdate: InsertQuarterlyUpdate): Promise<QuarterlyUpdate> {
    const id = randomUUID();
    const update: QuarterlyUpdate = {
      id,
      ...insertUpdate,
      submittedAt: new Date(),
    };
    this.quarterlyUpdates.set(id, update);
    
    const okr = this.okrs.get(insertUpdate.okrId);
    if (okr) {
      okr.currentValue = insertUpdate.progress;
      
      if (insertUpdate.progress === 0) {
        okr.status = "not_started";
      } else if (insertUpdate.progress >= okr.targetValue) {
        okr.status = "completed";
      } else if (insertUpdate.progress < okr.targetValue * 0.5) {
        okr.status = "at_risk";
      } else {
        okr.status = "in_progress";
      }
      
      this.okrs.set(okr.id, okr);
    }
    
    return update;
  }

  async deleteQuarterlyUpdate(id: string): Promise<void> {
    this.quarterlyUpdates.delete(id);
  }
}

export const storage = new MemStorage();
