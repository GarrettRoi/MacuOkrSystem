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
  type StrategicAdvancementData,
  type StrategicChartData,
  type StrategicChartRange,
  type AnalyticsDashboard,
  type AnalyticsWidget,
  type InsertAnalyticsDashboard,
  type InsertAnalyticsWidget,
  type AnalyticsDashboardWithWidgets,
  type EditLog,
  type InsertEditLog,
  type UnmatchedScore,
  type InsertUnmatchedScore,
  type InviteToken,
  type StaffWithDetails,
  type StaffSpuAssignmentWithDetails,
  type OkrWithDetails,
  type EmployeeProgressRecord,
  type EmployeeProgressSummary,
  type DataBackup,
  type DataBackupMeta,
  type UniversityKeyResultProgress,
  type UniversityObjectiveComment,
  type ProgressDatapoint,
  spus,
  subUnits,
  years,
  staff,
  okrs,
  okrCollaborators,
  quarterlyUpdates,
  okrResponsibilities,
  staffSpuAssignments,
  leaderBasicAssignments,
  appSettings,
  universityObjectives,
  universityKeyResults,
  universityKeyResultProgress,
  universityObjectiveComments,
  universityProgressDatapoints,
  universityYearlySnapshots,
  analyticsDashboards,
  analyticsWidgets,
  editLogs,
  unmatchedScores,
  inviteTokens,
  dataBackups,
  feedback,
  appRatings,
  activityLog,
  pushSubscriptions,
  announcements,
} from "@shared/schema";
import type {
  PushSubscriptionRow,
  InsertPushSubscription,
  Announcement,
  InsertOkrCollaborator,
} from "@shared/schema";
import type { ActivityLogEntry, InsertActivityLog, InactiveStaffEntry } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, asc, desc, inArray, ne, isNull, gt, sql, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

type BackupSnapshot = {
  spus: Spu[];
  subUnits: SubUnit[];
  years: Year[];
  staff: Staff[];
  okrs: Okr[];
  quarterlyUpdates: QuarterlyUpdate[];
  okrResponsibilities: OkrResponsibility[];
  staffSpuAssignments: StaffSpuAssignment[];
  leaderBasicAssignments: LeaderBasicAssignment[];
  universityObjectives: UniversityObjective[];
  universityKeyResults: UniversityKeyResult[];
  universityKeyResultProgress: UniversityKeyResultProgress[];
  universityObjectiveComments: UniversityObjectiveComment[];
  universityProgressDatapoints: ProgressDatapoint[];
  analyticsDashboards: AnalyticsDashboard[];
  analyticsWidgets: AnalyticsWidget[];
  appSettings: { key: string; value: string }[];
};

export type PushSubscriber = {
  staffId: string;
  name: string;
  email: string;
  role: string;
  deviceCount: number;
  lastSubscribedAt: Date;
};

function safeStaff<T extends { hashedPassword?: string | null }>(s: T): Omit<T, "hashedPassword"> {
  const { hashedPassword: _h, ...rest } = s;
  return rest as Omit<T, "hashedPassword">;
}

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
  countOkrsBySpu(spuId: string, year: number, quarter: string): Promise<number>;
  getOkrsWithDetailsBySpu(spuId: string): Promise<OkrWithDetails[]>;
  getOkrsWithDetailsForStaff(staffId: string | null, spuIds: string[]): Promise<OkrWithDetails[]>;
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

  // Strategic Advancement
  getStrategicAdvancementData(): Promise<import("@shared/schema").StrategicAdvancementData>;
  setKeyResultProgress(keyResultId: string, progressPercent: number): Promise<void>;
  setObjectiveComment(objectiveId: string, comment: string): Promise<void>;
  getStrategicChartData(): Promise<import("@shared/schema").StrategicChartData>;
  setChartRange(range: import("@shared/schema").StrategicChartRange): Promise<void>;
  bulkUpsertChartDatapoints(items: Array<{ keyResultId: string; quarter: string; year: number; progressPercent: number | null }>): Promise<void>;

  // Strategic Advancement — Yearly Snapshots
  listYearlySnapshots(): Promise<import("@shared/schema").UniversityYearlySnapshot[]>;
  getYearlySnapshot(year: number): Promise<import("@shared/schema").UniversityYearlySnapshot | null>;
  upsertYearlySnapshot(year: number, payload: import("@shared/schema").YearlySnapshotPayload): Promise<import("@shared/schema").UniversityYearlySnapshot>;
  deleteYearlySnapshot(year: number): Promise<void>;

  // Analytics Dashboards
  getAllAnalyticsDashboards(): Promise<AnalyticsDashboardWithWidgets[]>;
  getPublishedAnalyticsDashboards(): Promise<AnalyticsDashboardWithWidgets[]>;
  createAnalyticsDashboard(data: InsertAnalyticsDashboard): Promise<AnalyticsDashboard>;
  updateAnalyticsDashboard(id: string, data: Partial<InsertAnalyticsDashboard>): Promise<AnalyticsDashboard>;
  deleteAnalyticsDashboard(id: string): Promise<void>;
  createAnalyticsWidget(data: InsertAnalyticsWidget): Promise<AnalyticsWidget>;
  updateAnalyticsWidget(id: string, data: Partial<InsertAnalyticsWidget>): Promise<AnalyticsWidget>;
  deleteAnalyticsWidget(id: string): Promise<void>;

  // App Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Staff lookup by email
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

  // Unmatched Scores
  getAllUnmatchedScores(): Promise<UnmatchedScore[]>;
  getPendingUnmatchedScores(): Promise<UnmatchedScore[]>;
  getUnmatchedScore(id: string): Promise<UnmatchedScore | undefined>;
  createUnmatchedScore(score: InsertUnmatchedScore): Promise<UnmatchedScore>;
  matchUnmatchedScore(id: string, okrId: string): Promise<UnmatchedScore>;
  dismissUnmatchedScore(id: string): Promise<void>;
  deleteUnmatchedScore(id: string): Promise<void>;

  // SPU merge and conversion operations
  mergeSpus(sourceId: string, targetId: string): Promise<{ staffMoved: number; okrsMoved: number; subUnitsMoved: number; assignmentsMoved: number }>;
  convertSpuToSubUnit(sourceSpuId: string, targetSpuId: string): Promise<{ staffMoved: number; okrsMoved: number; subUnitsMoved: number }>;
  promoteSubUnitToSpu(subUnitId: string, subUnitIdsToMove: string[]): Promise<{ newSpuId: string; staffMoved: number; okrsMoved: number; subUnitsMoved: number }>;
  moveSubUnit(subUnitId: string, targetSpuId: string): Promise<{ staffMoved: number; okrsMoved: number; assignmentsMoved: number }>;

  // Invite tokens
  createInviteToken(staffId: string, token: string, expiresAt: Date): Promise<InviteToken>;
  getInviteToken(token: string): Promise<InviteToken | undefined>;
  consumeInviteToken(token: string): Promise<InviteToken | undefined>;
  markInviteTokenUsed(id: string): Promise<void>;
  setPasswordViaToken(token: string, email: string, hashedPassword: string): Promise<{ success: true } | { error: string; status: number }>;

  // Staff credentials
  setStaffPassword(staffId: string, hashedPassword: string): Promise<void>;
  getStaffByEmailWithPassword(email: string): Promise<Staff | undefined>;
  incrementLoginCount(staffId: string): Promise<void>;

  // Data Backups
  createBackup(label: string, backupType: "automatic" | "manual"): Promise<DataBackupMeta>;
  listBackups(): Promise<DataBackupMeta[]>;
  deleteBackupsOlderThan(date: Date): Promise<number>;
  restoreBackup(id: string): Promise<void>;

  // Feedback
  createFeedback(data: { staffId: string; message: string; pageUrl?: string | null }): Promise<import("@shared/schema").Feedback>;
  getAllFeedback(): Promise<import("@shared/schema").FeedbackWithStaff[]>;
  markFeedbackRead(id: string): Promise<import("@shared/schema").Feedback>;
  getUnreadFeedbackCount(): Promise<number>;
  createAppRating(data: { staffId: string; rating: string; pageUrl?: string | null; context?: string | null }): Promise<import("@shared/schema").AppRating>;
  getAllAppRatings(): Promise<import("@shared/schema").AppRatingWithStaff[]>;

  // Activity Log
  createActivityLog(data: InsertActivityLog): Promise<ActivityLogEntry>;
  getActivityLogs(filters: { staffId?: string; limit?: number }): Promise<ActivityLogEntry[]>;
  getInactiveStaff(days: number): Promise<InactiveStaffEntry[]>;

  // Push Notifications
  upsertPushSubscription(sub: InsertPushSubscription): Promise<PushSubscriptionRow>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;
  getAllPushSubscriptions(): Promise<PushSubscriptionRow[]>;
  getPushSubscriptionsForStaff(staffIds: string[]): Promise<PushSubscriptionRow[]>;
  getPushSubscribers(): Promise<PushSubscriber[]>;

  // Announcements
  createAnnouncement(data: Omit<Announcement, "id" | "sentAt">): Promise<Announcement>;
  getAllAnnouncements(limit?: number): Promise<Announcement[]>;

  // Staff by role
  getStaffByRole(role: string): Promise<Staff[]>;
}

export class DatabaseStorage implements IStorage {
  private adminPassword: string = process.env.ADMIN_PASSWORD ?? "admin14:12";
  private staffPassword: string = process.env.STAFF_PASSWORD ?? "staff14:12";

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
        loginCount: staff.loginCount,
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
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      loginCount: row.loginCount,
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
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        loginCount: staff.loginCount,
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
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      loginCount: row.loginCount,
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

  // Fetches collaborator data for a batch of OKR ids. Returns a per-okr map of
  // { spuIds, subUnitIds }. Prefers the okr_collaborators join table (cascade-safe);
  // falls back to the legacy collaboration_spu_ids text array for OKRs that have
  // no join-table rows yet (pre-backfill historical data).
  private async fetchCollaboratorsForOkrs(
    okrRows: Array<{ id: string; collaborationSpuIds: unknown }>
  ): Promise<Map<string, { spuIds: string[]; subUnitIds: string[]; rawIds: string[] }>> {
    const result = new Map<string, { spuIds: string[]; subUnitIds: string[]; rawIds: string[] }>();
    if (okrRows.length === 0) return result;
    const ids = okrRows.map(r => r.id);
    const joinRows = await db
      .select()
      .from(okrCollaborators)
      .where(inArray(okrCollaborators.okrId, ids));
    const byOkr = new Map<string, { spuIds: Set<string>; subUnitIds: Set<string> }>();
    for (const row of joinRows) {
      if (!byOkr.has(row.okrId)) byOkr.set(row.okrId, { spuIds: new Set(), subUnitIds: new Set() });
      const entry = byOkr.get(row.okrId)!;
      if (row.spuId) entry.spuIds.add(row.spuId);
      if (row.subUnitId) entry.subUnitIds.add(row.subUnitId);
    }
    for (const okr of okrRows) {
      const joined = byOkr.get(okr.id);
      const legacyArr = (okr.collaborationSpuIds as string[] | null) || [];
      if (joined) {
        result.set(okr.id, {
          spuIds: Array.from(joined.spuIds),
          subUnitIds: Array.from(joined.subUnitIds),
          rawIds: legacyArr,
        });
      } else {
        // Legacy fallback: text array may contain a mix of spu and sub-unit ids.
        // Classification happens at the consumer (using the spu/sub-unit maps).
        result.set(okr.id, { spuIds: [], subUnitIds: [], rawIds: legacyArr });
      }
    }
    return result;
  }

  // Replaces all collaborator rows for an OKR with the given lists.
  // Assumes IDs are pre-validated against spus/sub_units by the caller (route).
  async setOkrCollaborators(okrId: string, spuIds: string[], subUnitIds: string[]): Promise<void> {
    await db.delete(okrCollaborators).where(eq(okrCollaborators.okrId, okrId));
    const rows: InsertOkrCollaborator[] = [
      ...Array.from(new Set(spuIds)).map(id => ({ okrId, spuId: id, subUnitId: null })),
      ...Array.from(new Set(subUnitIds)).map(id => ({ okrId, spuId: null, subUnitId: id })),
    ];
    if (rows.length > 0) {
      await db.insert(okrCollaborators).values(rows);
    }
  }

  async getOkrCollaborators(okrId: string): Promise<{ spuIds: string[]; subUnitIds: string[] }> {
    const rows = await db.select().from(okrCollaborators).where(eq(okrCollaborators.okrId, okrId));
    return {
      spuIds: rows.filter(r => r.spuId).map(r => r.spuId!),
      subUnitIds: rows.filter(r => r.subUnitId).map(r => r.subUnitId!),
    };
  }

  async getAllOkrsWithDetails(): Promise<OkrWithDetails[]> {
    const okrSpu = alias(spus, 'okrSpu');
    const okrSubUnit = alias(subUnits, 'okrSubUnit');
    const staffSpu = alias(spus, 'staffSpu');
    const staffSubUnit = alias(subUnits, 'staffSubUnit');
    const collaborationSpu = alias(spus, 'collaborationSpu');
    
    const [result, allSpus, allSubUnits] = await Promise.all([
      db
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
        .leftJoin(collaborationSpu, eq(okrs.collaborationSpuId, collaborationSpu.id)),
      db.select().from(spus),
      db.select().from(subUnits),
    ]);

    const collabMap = await this.fetchCollaboratorsForOkrs(result.map(r => r.okr));
    const enriched = this.enrichRowsWithCollaborators(result, allSpus, allSubUnits, collabMap);
    return enriched;
  }

  // Shared post-processing for the 3 getOkrsWithDetails* methods.
  private enrichRowsWithCollaborators(
    result: Array<any>,
    allSpus: Spu[],
    allSubUnits: SubUnit[],
    collabMap: Map<string, { spuIds: string[]; subUnitIds: string[]; rawIds: string[] }>
  ): OkrWithDetails[] {
    const spuMap = new Map(allSpus.map(s => [s.id, s]));
    const subUnitMap = new Map(allSubUnits.map(su => [su.id, su]));

    return result.map((row) => {
      const collab = collabMap.get(row.okr.id) || { spuIds: [], subUnitIds: [], rawIds: [] };
      // If we have join-table data, prefer it. Otherwise classify the legacy text array.
      const hasJoinData = collab.spuIds.length > 0 || collab.subUnitIds.length > 0;
      let spuIds: string[] = [...collab.spuIds];
      let subUnitIds: string[] = [...collab.subUnitIds];
      const orphanIds: string[] = [];
      // Merge any legacy raw IDs not yet represented in the join data so partial
      // migrations don't silently hide collaborators. Classify each by lookup.
      for (const id of collab.rawIds) {
        if (spuIds.includes(id) || subUnitIds.includes(id)) continue;
        if (spuMap.has(id)) spuIds.push(id);
        else if (subUnitMap.has(id)) subUnitIds.push(id);
        else orphanIds.push(id);
      }
      const collaborationSpus = spuIds.map(id => spuMap.get(id)).filter(Boolean) as Spu[];
      const collaborationSubUnits = subUnitIds
        .map(id => {
          const su = subUnitMap.get(id);
          if (!su) return null;
          return { ...su, spuName: spuMap.get(su.spuId)?.name ?? null };
        })
        .filter(Boolean) as (SubUnit & { spuName?: string | null })[];

      return {
        ...row.okr,
        staff: row.staff ? {
          ...safeStaff(row.staff),
          spu: row.staffSpu!,
          subUnit: row.staffSubUnit || null,
        } : {
          id: row.okr.staffId || "deleted",
          name: row.okr.submitterName || "Unknown",
          email: "",
          spuId: row.okr.spuId,
          subUnitId: null,
          isAdmin: false,
          loginCount: 0,
          role: "basic" as const,
          spu: row.staffSpu || row.okrSpu!,
          subUnit: null,
        },
        spu: row.okrSpu || null,
        subUnit: row.okrSubUnit || null,
        collaborationSpu: row.collaborationSpu || null,
        collaborationSpus,
        collaborationSubUnits,
        orphanCollaboratorIds: orphanIds,
      };
    });
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

  async getOkrsWithDetailsForStaff(staffId: string | null, spuIds: string[]): Promise<OkrWithDetails[]> {
    const okrSpu = alias(spus, 'okrSpu');
    const okrSubUnit = alias(subUnits, 'okrSubUnit');
    const staffSpu = alias(spus, 'staffSpu');
    const staffSubUnit = alias(subUnits, 'staffSubUnit');
    const collaborationSpu = alias(spus, 'collaborationSpu');

    const conditions = [] as any[];
    if (spuIds.length > 0) conditions.push(inArray(okrs.spuId, spuIds));
    if (staffId) conditions.push(eq(okrs.staffId, staffId));
    if (conditions.length === 0) return [];
    const whereClause = conditions.length > 1 ? or(...conditions) : conditions[0];

    const [result, allSpus, allSubUnits] = await Promise.all([
      db
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
        .where(whereClause),
      db.select().from(spus),
      db.select().from(subUnits),
    ]);

    const collabMap = await this.fetchCollaboratorsForOkrs(result.map(r => r.okr));
    return this.enrichRowsWithCollaborators(result, allSpus, allSubUnits, collabMap);
  }

  async countOkrsBySpu(spuId: string, year: number, quarter: string): Promise<number> {
    const result = await db.select().from(okrs).where(and(eq(okrs.spuId, spuId), eq(okrs.year, year), eq(okrs.quarter, quarter)));
    return result.length;
  }

  async getOkrsWithDetailsBySpu(spuId: string): Promise<OkrWithDetails[]> {
    const okrSpu = alias(spus, 'okrSpu');
    const okrSubUnit = alias(subUnits, 'okrSubUnit');
    const staffSpu = alias(spus, 'staffSpu');
    const staffSubUnit = alias(subUnits, 'staffSubUnit');
    const collaborationSpu = alias(spus, 'collaborationSpu');
    
    const [result, allSpus, allSubUnits] = await Promise.all([
      db
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
        .where(eq(okrs.spuId, spuId)),
      db.select().from(spus),
      db.select().from(subUnits),
    ]);

    const collabMap = await this.fetchCollaboratorsForOkrs(result.map(r => r.okr));
    return this.enrichRowsWithCollaborators(result, allSpus, allSubUnits, collabMap);
  }

  async createOkr(
    insertOkr: InsertOkr & {
      okrNumber: string;
      collaborationSpuIds?: string[] | null;
      collaborationSubUnitIds?: string[];
    }
  ): Promise<Okr> {
    const { collaborationSubUnitIds, ...okrCols } = insertOkr as any;
    const [okr] = await db
      .insert(okrs)
      .values(okrCols)
      .returning();
    const spuIds = (insertOkr.collaborationSpuIds as string[] | null) || [];
    const subUnitIds = collaborationSubUnitIds || [];
    if (spuIds.length > 0 || subUnitIds.length > 0) {
      await this.setOkrCollaborators(okr.id, spuIds, subUnitIds);
    }
    return okr;
  }

  async updateOkr(
    id: string,
    updates: Partial<Okr> & { collaborationSubUnitIds?: string[] }
  ): Promise<Okr> {
    const { collaborationSubUnitIds, ...okrCols } = updates as any;
    const [okr] = await db
      .update(okrs)
      .set(okrCols)
      .where(eq(okrs.id, id))
      .returning();
    // Sync collaborators if either array was provided in the update
    const spuIdsProvided = okrCols.collaborationSpuIds !== undefined;
    const subUnitIdsProvided = collaborationSubUnitIds !== undefined;
    if (spuIdsProvided || subUnitIdsProvided) {
      const current = await this.getOkrCollaborators(id);
      const spuIds = spuIdsProvided ? (okrCols.collaborationSpuIds || []) : current.spuIds;
      const subUnitIds = subUnitIdsProvided ? (collaborationSubUnitIds || []) : current.subUnitIds;
      await this.setOkrCollaborators(id, spuIds, subUnitIds);
    }
    return okr;
  }

  // Returns OKRs that have IDs in their legacy collaboration_spu_ids text
  // array referencing entities that no longer exist (or are sub-units when the
  // legacy column expected SPUs). Used for super_admin audit + backfill flows.
  async getCollaboratorAuditReport(): Promise<Array<{
    okrId: string;
    okrNumber: string;
    quarter: string;
    year: number;
    spuName: string | null;
    submitterName: string | null;
    validSpuIds: string[];
    validSubUnitIds: string[];
    orphanIds: string[];
    legacyIds: string[];
  }>> {
    const [allOkrs, allSpus, allSubUnits] = await Promise.all([
      db.select().from(okrs),
      db.select().from(spus),
      db.select().from(subUnits),
    ]);
    const spuMap = new Map(allSpus.map(s => [s.id, s]));
    const subUnitMap = new Map(allSubUnits.map(su => [su.id, su]));
    const collabMap = await this.fetchCollaboratorsForOkrs(allOkrs);
    const report: Array<any> = [];
    for (const okr of allOkrs) {
      const legacy = (okr.collaborationSpuIds as string[] | null) || [];
      const joined = collabMap.get(okr.id) || { spuIds: [], subUnitIds: [], rawIds: legacy };
      const validSpuIds: string[] = [...joined.spuIds];
      const validSubUnitIds: string[] = [...joined.subUnitIds];
      const orphanIds: string[] = [];
      const hasJoinData = joined.spuIds.length > 0 || joined.subUnitIds.length > 0;
      if (!hasJoinData) {
        for (const id of legacy) {
          if (spuMap.has(id)) validSpuIds.push(id);
          else if (subUnitMap.has(id)) validSubUnitIds.push(id);
          else orphanIds.push(id);
        }
      } else {
        for (const id of legacy) {
          if (!spuMap.has(id) && !subUnitMap.has(id) && !validSpuIds.includes(id) && !validSubUnitIds.includes(id)) {
            orphanIds.push(id);
          }
        }
      }
      if (legacy.length === 0 && validSpuIds.length === 0 && validSubUnitIds.length === 0) continue;
      report.push({
        okrId: okr.id,
        okrNumber: okr.okrNumber,
        quarter: okr.quarter,
        year: okr.year,
        spuName: spuMap.get(okr.spuId)?.name ?? null,
        submitterName: okr.submitterName,
        validSpuIds,
        validSubUnitIds,
        orphanIds,
        legacyIds: legacy,
      });
    }
    return report;
  }

  // Idempotent: walks every OKR with a non-empty legacy text array and writes
  // the classified valid IDs into the join table. Orphans are left alone in
  // the text array (preserved as historical record). Safe to run multiple times.
  async backfillOkrCollaborators(): Promise<{
    processed: number;
    okrsWithOrphans: number;
    totalOrphans: number;
    orphanSamples: string[];
  }> {
    const report = await this.getCollaboratorAuditReport();
    let processed = 0;
    let okrsWithOrphans = 0;
    let totalOrphans = 0;
    const orphanSamples = new Set<string>();
    for (const row of report) {
      const existing = await this.getOkrCollaborators(row.okrId);
      // Only seed the join table when it's still empty for this OKR.
      if (existing.spuIds.length === 0 && existing.subUnitIds.length === 0 &&
          (row.validSpuIds.length > 0 || row.validSubUnitIds.length > 0)) {
        await this.setOkrCollaborators(row.okrId, row.validSpuIds, row.validSubUnitIds);
        processed++;
      }
      if (row.orphanIds.length > 0) {
        okrsWithOrphans++;
        totalOrphans += row.orphanIds.length;
        for (const id of row.orphanIds) orphanSamples.add(id);
      }
    }
    return {
      processed,
      okrsWithOrphans,
      totalOrphans,
      orphanSamples: Array.from(orphanSamples).slice(0, 20),
    };
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
    const [okrResults, allSpus] = await Promise.all([
      conditions.length > 0 ? query.where(and(...conditions)) : query,
      db.select().from(spus),
    ]);

    if (okrResults.length === 0) return [];

    const spuMap = new Map(allSpus.map(s => [s.id, s]));
    const okrIds = okrResults.map(row => row.okrs.id);
    const allSubUnits = await db.select().from(subUnits);
    const subUnitMap = new Map(allSubUnits.map(su => [su.id, su]));
    // Reuse the shared collaborator fetch so employee-progress sees the join
    // table (SPUs + sub-units + orphans), not just the legacy text array.
    const collabMap = await this.fetchCollaboratorsForOkrs(
      okrResults.map(row => row.okrs)
    );

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
      const collab = collabMap.get(okrId) || { spuIds: [], subUnitIds: [], rawIds: [] };
      const spuIds: string[] = [...collab.spuIds];
      const subUnitIds: string[] = [...collab.subUnitIds];
      const orphanIds: string[] = [];
      for (const id of collab.rawIds) {
        if (spuIds.includes(id) || subUnitIds.includes(id)) continue;
        if (spuMap.has(id)) spuIds.push(id);
        else if (subUnitMap.has(id)) subUnitIds.push(id);
        else orphanIds.push(id);
      }
      const collaborationSpus = spuIds.map(id => spuMap.get(id)).filter(Boolean) as typeof allSpus;
      const collaborationSubUnits = subUnitIds
        .map(id => {
          const su = subUnitMap.get(id);
          if (!su) return null;
          return { ...su, spuName: spuMap.get(su.spuId)?.name ?? null };
        })
        .filter(Boolean) as Array<SubUnit & { spuName?: string | null }>;

      return {
        okr: {
          ...row.okrs,
          staff: row.staff ? {
            ...safeStaff(row.staff),
            spu: row.staff_spu!,
            subUnit: row.staff_sub_unit,
          } : {
            id: row.okrs.staffId || "deleted",
            name: row.okrs.submitterName || "Unknown",
            email: "",
            spuId: row.okrs.spuId,
            subUnitId: null,
            isAdmin: false,
            loginCount: 0,
            role: "basic" as const,
            spu: row.spus!,
            subUnit: null,
          },
          spu: row.spus,
          subUnit: row.sub_units,
          collaborationSpu: row.collaboration_spu,
          collaborationSpus,
          collaborationSubUnits,
          orphanCollaboratorIds: orphanIds,
        },
        latestUpdate,
        responsibilities: responsibilities.map(r => ({
          id: r.id,
          okrId: r.okrId,
          staffId: r.staffId,
          role: r.role,
          staff: r.staff ? {
            ...safeStaff(r.staff),
            spu: r.spu!,
            subUnit: r.subUnit,
          } : {
            id: r.staffId || "deleted",
            name: "Unknown",
            email: "",
            spuId: "",
            subUnitId: null,
            isAdmin: false,
            loginCount: 0,
            role: "basic" as const,
            spu: r.spu!,
            subUnit: null,
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
      
      // Calculate overall progress (average across SCORED OKRs only; unscored OKRs are excluded)
      const scoredProgress = staffRecords
        .map((r: EmployeeProgressRecord) => {
          if (!r.latestUpdate || r.latestUpdate.averageScore === null || r.latestUpdate.averageScore === undefined || isNaN(r.latestUpdate.averageScore)) {
            return null;
          }
          return r.latestUpdate.averageScore;
        })
        .filter((score): score is number => score !== null);
      const overallProgress = scoredProgress.length > 0
        ? Math.round(scoredProgress.reduce((sum: number, score: number) => sum + score, 0) / scoredProgress.length)
        : null;
      
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
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        loginCount: staff.loginCount,
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
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      loginCount: row.loginCount,
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
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        loginCount: staff.loginCount,
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
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      loginCount: row.loginCount,
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
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        loginCount: staff.loginCount,
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
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      loginCount: row.loginCount,
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

    // Get staff whose primary SPU is in the leader's SPU list (excluding the leader themselves)
    const primaryMatches = await db
      .select({
        id: staff.id,
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        loginCount: staff.loginCount,
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

    // Get staff whose additional SPU assignments match the leader's SPU list
    const additionalMatches = await db
      .select({
        id: staff.id,
        name: staff.name,
        email: staff.email,
        isAdmin: staff.isAdmin,
        loginCount: staff.loginCount,
        role: staff.role,
        spuId: staff.spuId,
        subUnitId: staff.subUnitId,
        spu: spus,
        subUnit: subUnits,
      })
      .from(staff)
      .innerJoin(staffSpuAssignments, eq(staffSpuAssignments.staffId, staff.id))
      .leftJoin(spus, eq(staff.spuId, spus.id))
      .leftJoin(subUnits, eq(staff.subUnitId, subUnits.id))
      .where(and(
        inArray(staffSpuAssignments.spuId, spuIds),
        ne(staff.id, leaderId)
      ));

    // Merge and deduplicate by staff id
    const seenIds = new Set<string>();
    const merged: typeof primaryMatches = [];
    for (const row of [...primaryMatches, ...additionalMatches]) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        merged.push(row);
      }
    }

    return merged.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      isAdmin: row.isAdmin,
      loginCount: row.loginCount,
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

  async getStaffByRole(role: string): Promise<Staff[]> {
    return await db.select().from(staff).where(eq(staff.role, role));
  }

  async upsertPushSubscription(sub: InsertPushSubscription): Promise<PushSubscriptionRow> {
    const [row] = await db
      .insert(pushSubscriptions)
      .values(sub)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          staffId: sub.staffId,
          p256dh: sub.p256dh,
          auth: sub.auth,
          userAgent: sub.userAgent ?? null,
        },
      })
      .returning();
    return row;
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getAllPushSubscriptions(): Promise<PushSubscriptionRow[]> {
    return await db.select().from(pushSubscriptions);
  }

  async getPushSubscriptionsForStaff(staffIds: string[]): Promise<PushSubscriptionRow[]> {
    if (staffIds.length === 0) return [];
    return await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.staffId, staffIds));
  }

  async getPushSubscribers(): Promise<PushSubscriber[]> {
    const rows = await db
      .select({
        staffId: pushSubscriptions.staffId,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        createdAt: pushSubscriptions.createdAt,
      })
      .from(pushSubscriptions)
      .innerJoin(staff, eq(pushSubscriptions.staffId, staff.id));

    const byStaff = new Map<string, PushSubscriber>();
    for (const r of rows) {
      const existing = byStaff.get(r.staffId);
      if (existing) {
        existing.deviceCount += 1;
        if (r.createdAt > existing.lastSubscribedAt) existing.lastSubscribedAt = r.createdAt;
      } else {
        byStaff.set(r.staffId, {
          staffId: r.staffId,
          name: r.name,
          email: r.email,
          role: r.role,
          deviceCount: 1,
          lastSubscribedAt: r.createdAt,
        });
      }
    }
    return Array.from(byStaff.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createAnnouncement(data: Omit<Announcement, "id" | "sentAt">): Promise<Announcement> {
    const [row] = await db.insert(announcements).values(data).returning();
    return row;
  }

  async getAllAnnouncements(limit: number = 50): Promise<Announcement[]> {
    return await db.select().from(announcements).orderBy(desc(announcements.sentAt)).limit(limit);
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

  async getStaffByEmail(email: string): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(ilike(staff.email, email));
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

  async getStrategicAdvancementData(): Promise<StrategicAdvancementData> {
    const objectives = await db.select().from(universityObjectives).where(eq(universityObjectives.isActive, true)).orderBy(asc(universityObjectives.sortOrder));
    const krs = await db.select().from(universityKeyResults).orderBy(asc(universityKeyResults.sortOrder));
    const progressRows = await db.select().from(universityKeyResultProgress);
    const commentRows = await db.select().from(universityObjectiveComments);
    const lastUpdatedRow = await db.select().from(appSettings).where(eq(appSettings.key, "strategic_advancement_updated_at"));
    const progressMap = new Map(progressRows.map(r => [r.keyResultId, r.progressPercent]));
    const commentMap = new Map(commentRows.map(r => [r.objectiveId, r.comment]));
    return {
      objectives: objectives.map(obj => ({
        ...obj,
        keyResults: krs
          .filter(kr => kr.objectiveId === obj.id)
          .map(kr => ({ ...kr, progressPercent: progressMap.get(kr.id) ?? null })),
        comment: commentMap.get(obj.id) ?? "",
      })),
      lastUpdated: lastUpdatedRow[0]?.value ?? null,
    };
  }

  async setKeyResultProgress(keyResultId: string, progressPercent: number): Promise<void> {
    await db
      .insert(universityKeyResultProgress)
      .values({ keyResultId, progressPercent })
      .onConflictDoUpdate({ target: universityKeyResultProgress.keyResultId, set: { progressPercent } });
  }

  async setObjectiveComment(objectiveId: string, comment: string): Promise<void> {
    await db
      .insert(universityObjectiveComments)
      .values({ objectiveId, comment })
      .onConflictDoUpdate({ target: universityObjectiveComments.objectiveId, set: { comment } });
  }

  async getStrategicChartData(): Promise<StrategicChartData> {
    const objectives = await db.select().from(universityObjectives).where(eq(universityObjectives.isActive, true)).orderBy(asc(universityObjectives.sortOrder));
    const krs = await db.select().from(universityKeyResults).orderBy(asc(universityKeyResults.sortOrder));
    const datapoints = await db.select().from(universityProgressDatapoints);
    const commentRows = await db.select().from(universityObjectiveComments);
    const commentMap = new Map(commentRows.map(r => [r.objectiveId, r.comment]));
    const lastUpdatedRow = await db.select().from(appSettings).where(eq(appSettings.key, "strategic_advancement_updated_at"));
    const rangeRow = await db.select().from(appSettings).where(eq(appSettings.key, "strategic_chart_range"));
    let range: StrategicChartRange | null = null;
    if (rangeRow[0]?.value) {
      try { range = JSON.parse(rangeRow[0].value); } catch {}
    }
    return {
      range,
      objectives: objectives.map(obj => ({
        id: obj.id,
        label: obj.label,
        description: obj.description,
        comment: commentMap.get(obj.id) ?? "",
        keyResults: krs
          .filter(kr => kr.objectiveId === obj.id)
          .map(kr => ({
            id: kr.id,
            label: kr.label,
            description: kr.description,
            datapoints: datapoints.filter(d => d.keyResultId === kr.id).map(d => ({ quarter: d.quarter, year: d.year, progressPercent: d.progressPercent })),
          })),
      })),
      lastUpdated: lastUpdatedRow[0]?.value ?? null,
    };
  }

  async setChartRange(range: StrategicChartRange): Promise<void> {
    await db.insert(appSettings).values({ key: "strategic_chart_range", value: JSON.stringify(range) })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(range) } });
  }

  async bulkUpsertChartDatapoints(items: Array<{ keyResultId: string; quarter: string; year: number; progressPercent: number | null }>): Promise<void> {
    for (const item of items) {
      if (item.progressPercent === null) {
        await db.delete(universityProgressDatapoints)
          .where(and(eq(universityProgressDatapoints.keyResultId, item.keyResultId), eq(universityProgressDatapoints.quarter, item.quarter), eq(universityProgressDatapoints.year, item.year)));
      } else {
        const existing = await db.select().from(universityProgressDatapoints)
          .where(and(eq(universityProgressDatapoints.keyResultId, item.keyResultId), eq(universityProgressDatapoints.quarter, item.quarter), eq(universityProgressDatapoints.year, item.year)));
        if (existing.length > 0) {
          await db.update(universityProgressDatapoints).set({ progressPercent: item.progressPercent })
            .where(and(eq(universityProgressDatapoints.keyResultId, item.keyResultId), eq(universityProgressDatapoints.quarter, item.quarter), eq(universityProgressDatapoints.year, item.year)));
        } else {
          await db.insert(universityProgressDatapoints).values({ keyResultId: item.keyResultId, quarter: item.quarter, year: item.year, progressPercent: item.progressPercent });
        }
      }
    }
  }

  async listYearlySnapshots(): Promise<import("@shared/schema").UniversityYearlySnapshot[]> {
    const rows = await db.select().from(universityYearlySnapshots).orderBy(desc(universityYearlySnapshots.year));
    return rows.map(r => ({ year: r.year, payload: r.payload as import("@shared/schema").YearlySnapshotPayload, updatedAt: r.updatedAt }));
  }

  async getYearlySnapshot(year: number): Promise<import("@shared/schema").UniversityYearlySnapshot | null> {
    const rows = await db.select().from(universityYearlySnapshots).where(eq(universityYearlySnapshots.year, year));
    if (rows.length === 0) return null;
    const r = rows[0];
    return { year: r.year, payload: r.payload as import("@shared/schema").YearlySnapshotPayload, updatedAt: r.updatedAt };
  }

  async upsertYearlySnapshot(year: number, payload: import("@shared/schema").YearlySnapshotPayload): Promise<import("@shared/schema").UniversityYearlySnapshot> {
    const updatedAt = new Date();
    await db
      .insert(universityYearlySnapshots)
      .values({ year, payload: payload as any, updatedAt })
      .onConflictDoUpdate({ target: universityYearlySnapshots.year, set: { payload: payload as any, updatedAt } });
    return { year, payload, updatedAt };
  }

  async deleteYearlySnapshot(year: number): Promise<void> {
    await db.delete(universityYearlySnapshots).where(eq(universityYearlySnapshots.year, year));
  }

  private async getDashboardsWithWidgets(filter?: { isPublished: boolean }): Promise<AnalyticsDashboardWithWidgets[]> {
    let query = db.select().from(analyticsDashboards).orderBy(asc(analyticsDashboards.sortOrder), asc(analyticsDashboards.createdAt));
    const rows = filter !== undefined
      ? await db.select().from(analyticsDashboards).where(eq(analyticsDashboards.isPublished, filter.isPublished)).orderBy(asc(analyticsDashboards.sortOrder), asc(analyticsDashboards.createdAt))
      : await query;
    const widgets = await db.select().from(analyticsWidgets).orderBy(asc(analyticsWidgets.sortOrder));
    return rows.map(d => ({ ...d, widgets: widgets.filter(w => w.dashboardId === d.id) }));
  }

  async getAllAnalyticsDashboards(): Promise<AnalyticsDashboardWithWidgets[]> {
    return this.getDashboardsWithWidgets();
  }

  async getPublishedAnalyticsDashboards(): Promise<AnalyticsDashboardWithWidgets[]> {
    return this.getDashboardsWithWidgets({ isPublished: true });
  }

  async createAnalyticsDashboard(data: InsertAnalyticsDashboard): Promise<AnalyticsDashboard> {
    const [result] = await db.insert(analyticsDashboards).values(data).returning();
    return result;
  }

  async updateAnalyticsDashboard(id: string, data: Partial<InsertAnalyticsDashboard>): Promise<AnalyticsDashboard> {
    const [result] = await db.update(analyticsDashboards).set(data).where(eq(analyticsDashboards.id, id)).returning();
    return result;
  }

  async deleteAnalyticsDashboard(id: string): Promise<void> {
    await db.delete(analyticsDashboards).where(eq(analyticsDashboards.id, id));
  }

  async createAnalyticsWidget(data: InsertAnalyticsWidget): Promise<AnalyticsWidget> {
    const [result] = await db.insert(analyticsWidgets).values(data).returning();
    return result;
  }

  async updateAnalyticsWidget(id: string, data: Partial<InsertAnalyticsWidget>): Promise<AnalyticsWidget> {
    const [result] = await db.update(analyticsWidgets).set(data).where(eq(analyticsWidgets.id, id)).returning();
    return result;
  }

  async deleteAnalyticsWidget(id: string): Promise<void> {
    await db.delete(analyticsWidgets).where(eq(analyticsWidgets.id, id));
  }

  async createEditLog(log: InsertEditLog): Promise<EditLog> {
    const [result] = await db.insert(editLogs).values(log).returning();
    return result;
  }

  async getAllEditLogs(): Promise<EditLog[]> {
    return await db.select().from(editLogs).orderBy(desc(editLogs.editedAt));
  }

  async getAllUnmatchedScores(): Promise<UnmatchedScore[]> {
    return await db.select().from(unmatchedScores).orderBy(desc(unmatchedScores.importedAt));
  }

  async getPendingUnmatchedScores(): Promise<UnmatchedScore[]> {
    return await db.select().from(unmatchedScores)
      .where(eq(unmatchedScores.status, "pending"))
      .orderBy(desc(unmatchedScores.importedAt));
  }

  async getUnmatchedScore(id: string): Promise<UnmatchedScore | undefined> {
    const [result] = await db.select().from(unmatchedScores).where(eq(unmatchedScores.id, id));
    return result;
  }

  async createUnmatchedScore(score: InsertUnmatchedScore): Promise<UnmatchedScore> {
    const [result] = await db.insert(unmatchedScores).values(score).returning();
    return result;
  }

  async matchUnmatchedScore(id: string, okrId: string): Promise<UnmatchedScore> {
    const [result] = await db.update(unmatchedScores)
      .set({ status: "matched", matchedOkrId: okrId, matchedAt: new Date() })
      .where(eq(unmatchedScores.id, id))
      .returning();
    return result;
  }

  async dismissUnmatchedScore(id: string): Promise<void> {
    await db.update(unmatchedScores)
      .set({ status: "dismissed" })
      .where(eq(unmatchedScores.id, id));
  }

  async deleteUnmatchedScore(id: string): Promise<void> {
    await db.delete(unmatchedScores).where(eq(unmatchedScores.id, id));
  }

  async mergeSpus(sourceId: string, targetId: string): Promise<{ staffMoved: number; okrsMoved: number; subUnitsMoved: number; assignmentsMoved: number }> {
    return await db.transaction(async (tx) => {
      const movedStaff = await tx.select().from(staff).where(eq(staff.spuId, sourceId));
      await tx.update(staff).set({ spuId: targetId }).where(eq(staff.spuId, sourceId));

      const movedOkrsSpuId = await tx.select().from(okrs).where(eq(okrs.spuId, sourceId));
      await tx.update(okrs).set({ spuId: targetId }).where(eq(okrs.spuId, sourceId));
      await tx.update(okrs).set({ collaborationSpuId: targetId }).where(eq(okrs.collaborationSpuId, sourceId));
      await tx.execute(sql`UPDATE okrs SET collaboration_spu_ids = array_replace(collaboration_spu_ids, ${sourceId}::text, ${targetId}::text) WHERE ${sourceId}::text = ANY(collaboration_spu_ids)`);
      // Also remap the new join table so the ON DELETE CASCADE on spus
      // doesn't silently drop collaborator rows when sourceId is deleted below.
      await tx.update(okrCollaborators).set({ spuId: targetId }).where(eq(okrCollaborators.spuId, sourceId));

      const movedSubUnits = await tx.select().from(subUnits).where(eq(subUnits.spuId, sourceId));
      await tx.update(subUnits).set({ spuId: targetId }).where(eq(subUnits.spuId, sourceId));

      const movedAssignments = await tx.select().from(staffSpuAssignments).where(eq(staffSpuAssignments.spuId, sourceId));
      await tx.update(staffSpuAssignments).set({ spuId: targetId }).where(eq(staffSpuAssignments.spuId, sourceId));

      await tx.delete(spus).where(eq(spus.id, sourceId));

      return {
        staffMoved: movedStaff.length,
        okrsMoved: movedOkrsSpuId.length,
        subUnitsMoved: movedSubUnits.length,
        assignmentsMoved: movedAssignments.length,
      };
    });
  }

  async convertSpuToSubUnit(sourceSpuId: string, targetSpuId: string): Promise<{ staffMoved: number; okrsMoved: number; subUnitsMoved: number }> {
    const sourceSpu = await this.getSpu(sourceSpuId);
    if (!sourceSpu) throw new Error("Source SPU not found");

    return await db.transaction(async (tx) => {
      const movedChildSubUnits = await tx.select().from(subUnits).where(eq(subUnits.spuId, sourceSpuId));
      await tx.update(subUnits).set({ spuId: targetSpuId }).where(eq(subUnits.spuId, sourceSpuId));

      const [newSubUnit] = await tx.insert(subUnits).values({ name: sourceSpu.name, spuId: targetSpuId }).returning();

      const movedStaff = await tx.select().from(staff).where(eq(staff.spuId, sourceSpuId));
      await tx.update(staff).set({ spuId: targetSpuId, subUnitId: newSubUnit.id })
        .where(and(eq(staff.spuId, sourceSpuId), isNull(staff.subUnitId)));
      await tx.update(staff).set({ spuId: targetSpuId })
        .where(and(eq(staff.spuId, sourceSpuId)));

      const movedOkrs = await tx.select().from(okrs).where(eq(okrs.spuId, sourceSpuId));
      await tx.update(okrs).set({ spuId: targetSpuId, subUnitId: newSubUnit.id })
        .where(and(eq(okrs.spuId, sourceSpuId), isNull(okrs.subUnitId)));
      await tx.update(okrs).set({ spuId: targetSpuId })
        .where(eq(okrs.spuId, sourceSpuId));
      await tx.update(okrs).set({ collaborationSpuId: targetSpuId }).where(eq(okrs.collaborationSpuId, sourceSpuId));
      await tx.execute(sql`UPDATE okrs SET collaboration_spu_ids = array_replace(collaboration_spu_ids, ${sourceSpuId}::text, ${targetSpuId}::text) WHERE ${sourceSpuId}::text = ANY(collaboration_spu_ids)`);
      // Remap join-table collaborator rows: the deleted SPU becomes a sub-unit
      // under targetSpuId, so any OKR that "collaborated with" the old SPU
      // should now collaborate with the new sub-unit instead.
      await tx.update(okrCollaborators)
        .set({ spuId: null, subUnitId: newSubUnit.id })
        .where(eq(okrCollaborators.spuId, sourceSpuId));

      await tx.update(staffSpuAssignments).set({ spuId: targetSpuId, subUnitId: newSubUnit.id })
        .where(and(eq(staffSpuAssignments.spuId, sourceSpuId), isNull(staffSpuAssignments.subUnitId)));
      await tx.update(staffSpuAssignments).set({ spuId: targetSpuId })
        .where(eq(staffSpuAssignments.spuId, sourceSpuId));

      await tx.delete(spus).where(eq(spus.id, sourceSpuId));

      return {
        staffMoved: movedStaff.length,
        okrsMoved: movedOkrs.length,
        subUnitsMoved: movedChildSubUnits.length,
      };
    });
  }

  async promoteSubUnitToSpu(subUnitId: string, subUnitIdsToMove: string[]): Promise<{ newSpuId: string; staffMoved: number; okrsMoved: number; subUnitsMoved: number }> {
    const subUnit = await this.getSubUnit(subUnitId);
    if (!subUnit) throw new Error("Sub-unit not found");

    return await db.transaction(async (tx) => {
      const [newSpu] = await tx.insert(spus).values({ name: subUnit.name }).returning();

      const movedStaff = await tx.select().from(staff).where(eq(staff.subUnitId, subUnitId));
      await tx.update(staff).set({ spuId: newSpu.id, subUnitId: null }).where(eq(staff.subUnitId, subUnitId));

      const movedOkrs = await tx.select().from(okrs).where(eq(okrs.subUnitId, subUnitId));
      await tx.update(okrs).set({ spuId: newSpu.id, subUnitId: null }).where(eq(okrs.subUnitId, subUnitId));

      await tx.update(staffSpuAssignments).set({ spuId: newSpu.id, subUnitId: null }).where(eq(staffSpuAssignments.subUnitId, subUnitId));

      let subUnitsMoved = 0;
      if (subUnitIdsToMove.length > 0) {
        const validIds = subUnitIdsToMove.filter(id => id !== subUnitId);
        if (validIds.length > 0) {
          await tx.update(subUnits).set({ spuId: newSpu.id }).where(inArray(subUnits.id, validIds));
          await tx.update(staff).set({ spuId: newSpu.id }).where(inArray(staff.subUnitId, validIds));
          await tx.update(okrs).set({ spuId: newSpu.id }).where(inArray(okrs.subUnitId, validIds));
          await tx.update(staffSpuAssignments).set({ spuId: newSpu.id }).where(inArray(staffSpuAssignments.subUnitId, validIds));
          subUnitsMoved = validIds.length;
        }
      }

      await tx.delete(subUnits).where(eq(subUnits.id, subUnitId));

      return {
        newSpuId: newSpu.id,
        staffMoved: movedStaff.length,
        okrsMoved: movedOkrs.length,
        subUnitsMoved,
      };
    });
  }

  async moveSubUnit(subUnitId: string, targetSpuId: string): Promise<{ staffMoved: number; okrsMoved: number; assignmentsMoved: number }> {
    return await db.transaction(async (tx) => {
      const [subUnit] = await tx.select().from(subUnits).where(eq(subUnits.id, subUnitId));
      if (!subUnit) throw new Error("Sub-unit not found");
      const [targetSpu] = await tx.select().from(spus).where(eq(spus.id, targetSpuId));
      if (!targetSpu) throw new Error("Target SPU not found");
      if (subUnit.spuId === targetSpuId) throw Object.assign(new Error("Sub-unit is already under this SPU"), { statusCode: 400 });

      await tx.update(subUnits).set({ spuId: targetSpuId }).where(eq(subUnits.id, subUnitId));

      const movedStaff = await tx.update(staff).set({ spuId: targetSpuId }).where(eq(staff.subUnitId, subUnitId)).returning({ id: staff.id });
      const movedOkrs = await tx.update(okrs).set({ spuId: targetSpuId }).where(eq(okrs.subUnitId, subUnitId)).returning({ id: okrs.id });
      const movedAssignments = await tx.update(staffSpuAssignments).set({ spuId: targetSpuId }).where(eq(staffSpuAssignments.subUnitId, subUnitId)).returning({ id: staffSpuAssignments.id });

      return {
        staffMoved: movedStaff.length,
        okrsMoved: movedOkrs.length,
        assignmentsMoved: movedAssignments.length,
      };
    });
  }

  async createInviteToken(staffId: string, token: string, expiresAt: Date): Promise<InviteToken> {
    return await db.transaction(async (tx) => {
      // Invalidate any prior unused tokens for this staff member
      await tx
        .update(inviteTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(inviteTokens.staffId, staffId), isNull(inviteTokens.usedAt)));

      const [created] = await tx
        .insert(inviteTokens)
        .values({ staffId, token, expiresAt })
        .returning();
      return created;
    });
  }

  async getInviteToken(token: string): Promise<InviteToken | undefined> {
    const [result] = await db
      .select()
      .from(inviteTokens)
      .where(eq(inviteTokens.token, token));
    return result || undefined;
  }

  async consumeInviteToken(token: string): Promise<InviteToken | undefined> {
    const now = new Date();
    const [consumed] = await db
      .update(inviteTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(inviteTokens.token, token),
          isNull(inviteTokens.usedAt),
          gt(inviteTokens.expiresAt, now)
        )
      )
      .returning();
    return consumed || undefined;
  }

  async markInviteTokenUsed(id: string): Promise<void> {
    await db
      .update(inviteTokens)
      .set({ usedAt: new Date() })
      .where(eq(inviteTokens.id, id));
  }

  async setPasswordViaToken(token: string, email: string, hashedPassword: string): Promise<{ success: true } | { error: string; status: number }> {
    try {
      return await db.transaction(async (tx) => {
        const now = new Date();

        // 1. Read-only validation: check token state before consuming
        const [existing] = await tx
          .select()
          .from(inviteTokens)
          .where(eq(inviteTokens.token, token));
        if (!existing) return { error: "Invalid token", status: 404 };
        if (existing.usedAt) return { error: "Token has already been used", status: 410 };
        if (existing.expiresAt <= now) return { error: "Token has expired", status: 410 };

        // 2. Check email uniqueness before consuming (recoverable validation)
        const normalizedEmail = email.toLowerCase().trim();
        const [emailConflict] = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.email, normalizedEmail), ne(staff.id, existing.staffId)))
          .limit(1);
        if (emailConflict) {
          return { error: "Email address is already in use by another account", status: 409 };
        }

        // 3. Atomically consume the token (concurrent-safe: WHERE isNull(usedAt))
        const [consumed] = await tx
          .update(inviteTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(inviteTokens.token, token),
              isNull(inviteTokens.usedAt),
              gt(inviteTokens.expiresAt, now)
            )
          )
          .returning();

        if (!consumed) {
          return { error: "Token has already been used", status: 410 };
        }

        // 4. All checks passed — update email + password
        await tx
          .update(staff)
          .set({ email: normalizedEmail, hashedPassword })
          .where(eq(staff.id, consumed.staffId));

        return { success: true } as const;
      });
    } catch {
      return { error: "Failed to set password", status: 500 };
    }
  }

  async setStaffPassword(staffId: string, hashedPassword: string): Promise<void> {
    await db
      .update(staff)
      .set({ hashedPassword })
      .where(eq(staff.id, staffId));
  }

  async getStaffByEmailWithPassword(email: string): Promise<Staff | undefined> {
    const [result] = await db
      .select()
      .from(staff)
      .where(eq(staff.email, email.toLowerCase().trim()));
    return result || undefined;
  }

  async incrementLoginCount(staffId: string): Promise<void> {
    await db
      .update(staff)
      .set({ loginCount: sql`${staff.loginCount} + 1` })
      .where(eq(staff.id, staffId));
  }

  async createBackup(label: string, backupType: "automatic" | "manual"): Promise<DataBackupMeta> {
    // Run all reads inside a REPEATABLE READ transaction so every table is
    // captured at the exact same database snapshot — no concurrent write can
    // produce a partially-consistent backup.
    const created = await db.transaction(async (tx) => {
      const [
        allSpus,
        allSubUnits,
        allYears,
        allStaff,
        allOkrs,
        allQuarterlyUpdates,
        allOkrResponsibilities,
        allStaffSpuAssignments,
        allLeaderBasicAssignments,
        allUniversityObjectives,
        allUniversityKeyResults,
        allUniversityKeyResultProgress,
        allUniversityObjectiveComments,
        allUniversityProgressDatapoints,
        allAnalyticsDashboards,
        allAnalyticsWidgets,
        allAppSettings,
      ] = await Promise.all([
        tx.select().from(spus),
        tx.select().from(subUnits),
        tx.select().from(years),
        tx.select().from(staff),
        tx.select().from(okrs),
        tx.select().from(quarterlyUpdates),
        tx.select().from(okrResponsibilities),
        tx.select().from(staffSpuAssignments),
        tx.select().from(leaderBasicAssignments),
        tx.select().from(universityObjectives),
        tx.select().from(universityKeyResults),
        tx.select().from(universityKeyResultProgress),
        tx.select().from(universityObjectiveComments),
        tx.select().from(universityProgressDatapoints),
        tx.select().from(analyticsDashboards),
        tx.select().from(analyticsWidgets),
        tx.select().from(appSettings),
      ]);

      const snapshot: BackupSnapshot = {
        spus: allSpus,
        subUnits: allSubUnits,
        years: allYears,
        staff: allStaff,
        okrs: allOkrs,
        quarterlyUpdates: allQuarterlyUpdates,
        okrResponsibilities: allOkrResponsibilities,
        staffSpuAssignments: allStaffSpuAssignments,
        leaderBasicAssignments: allLeaderBasicAssignments,
        universityObjectives: allUniversityObjectives,
        universityKeyResults: allUniversityKeyResults,
        universityKeyResultProgress: allUniversityKeyResultProgress,
        universityObjectiveComments: allUniversityObjectiveComments,
        universityProgressDatapoints: allUniversityProgressDatapoints,
        analyticsDashboards: allAnalyticsDashboards,
        analyticsWidgets: allAnalyticsWidgets,
        appSettings: allAppSettings,
      };

      const [row] = await tx
        .insert(dataBackups)
        .values({ label, backupType, snapshot })
        .returning({
          id: dataBackups.id,
          label: dataBackups.label,
          backupType: dataBackups.backupType,
          createdAt: dataBackups.createdAt,
        });
      return row;
    }, { isolationLevel: "repeatable read" });

    return created;
  }

  async listBackups(): Promise<DataBackupMeta[]> {
    const rows = await db
      .select({
        id: dataBackups.id,
        label: dataBackups.label,
        backupType: dataBackups.backupType,
        createdAt: dataBackups.createdAt,
      })
      .from(dataBackups)
      .orderBy(desc(dataBackups.createdAt));
    return rows;
  }

  async deleteBackupsOlderThan(date: Date): Promise<number> {
    const rows = await db
      .select({ id: dataBackups.id })
      .from(dataBackups)
      .where(sql`${dataBackups.createdAt} < ${date}`);
    if (rows.length === 0) return 0;
    const ids = rows.map(r => r.id);
    await db.delete(dataBackups).where(inArray(dataBackups.id, ids));
    return ids.length;
  }

  async restoreBackup(id: string): Promise<void> {
    const [backup] = await db.select().from(dataBackups).where(eq(dataBackups.id, id));
    if (!backup) throw new Error(`Backup ${id} not found`);

    const snap = backup.snapshot as BackupSnapshot;
    if (!snap || typeof snap !== "object" || !Array.isArray(snap.spus)) {
      throw new Error("Backup snapshot is malformed or corrupted");
    }

    await db.transaction(async (tx) => {
      // Delete in reverse dependency order (leaves first).
      // invite_tokens are deleted here to avoid orphaned FK references but are
      // intentionally NOT restored from the snapshot — they are transient
      // credentials that should not be replayed from a historical backup.
      await tx.delete(analyticsWidgets);
      await tx.delete(universityProgressDatapoints);
      await tx.delete(universityKeyResultProgress);
      await tx.delete(universityObjectiveComments);
      await tx.delete(okrResponsibilities);
      await tx.delete(quarterlyUpdates);
      await tx.delete(okrs);
      await tx.delete(staffSpuAssignments);
      await tx.delete(leaderBasicAssignments);
      await tx.delete(inviteTokens);
      await tx.delete(staff);
      await tx.delete(universityKeyResults);
      await tx.delete(universityObjectives);
      await tx.delete(analyticsDashboards);
      await tx.delete(subUnits);
      await tx.delete(spus);
      await tx.delete(years);
      await tx.delete(appSettings);

      // Re-insert in dependency order (parents first)
      if (snap.spus?.length) await tx.insert(spus).values(snap.spus);
      if (snap.subUnits?.length) await tx.insert(subUnits).values(snap.subUnits);
      if (snap.years?.length) await tx.insert(years).values(snap.years);
      if (snap.appSettings?.length) await tx.insert(appSettings).values(snap.appSettings);
      if (snap.universityObjectives?.length) await tx.insert(universityObjectives).values(snap.universityObjectives);
      if (snap.analyticsDashboards?.length) await tx.insert(analyticsDashboards).values(snap.analyticsDashboards);
      if (snap.staff?.length) await tx.insert(staff).values(snap.staff);
      if (snap.universityKeyResults?.length) await tx.insert(universityKeyResults).values(snap.universityKeyResults);
      if (snap.analyticsWidgets?.length) await tx.insert(analyticsWidgets).values(snap.analyticsWidgets);
      if (snap.okrs?.length) await tx.insert(okrs).values(snap.okrs);
      if (snap.staffSpuAssignments?.length) await tx.insert(staffSpuAssignments).values(snap.staffSpuAssignments);
      if (snap.leaderBasicAssignments?.length) await tx.insert(leaderBasicAssignments).values(snap.leaderBasicAssignments);
      if (snap.quarterlyUpdates?.length) await tx.insert(quarterlyUpdates).values(snap.quarterlyUpdates);
      if (snap.okrResponsibilities?.length) await tx.insert(okrResponsibilities).values(snap.okrResponsibilities);
      if (snap.universityKeyResultProgress?.length) await tx.insert(universityKeyResultProgress).values(snap.universityKeyResultProgress);
      if (snap.universityObjectiveComments?.length) await tx.insert(universityObjectiveComments).values(snap.universityObjectiveComments);
      if (snap.universityProgressDatapoints?.length) await tx.insert(universityProgressDatapoints).values(snap.universityProgressDatapoints);
    });
  }
  async createFeedback(data: { staffId: string; message: string; pageUrl?: string | null }): Promise<import("@shared/schema").Feedback> {
    const [result] = await db.insert(feedback).values(data).returning();
    return result;
  }

  async getAllFeedback(): Promise<import("@shared/schema").FeedbackWithStaff[]> {
    const results = await db
      .select({
        id: feedback.id,
        staffId: feedback.staffId,
        message: feedback.message,
        pageUrl: feedback.pageUrl,
        submittedAt: feedback.submittedAt,
        isRead: feedback.isRead,
        staffName: staff.name,
      })
      .from(feedback)
      .leftJoin(staff, eq(feedback.staffId, staff.id))
      .orderBy(desc(feedback.submittedAt));
    return results.map(r => ({ ...r, staffName: r.staffName ?? "Unknown" }));
  }

  async markFeedbackRead(id: string): Promise<import("@shared/schema").Feedback> {
    const [result] = await db.update(feedback).set({ isRead: true }).where(eq(feedback.id, id)).returning();
    return result;
  }

  async getUnreadFeedbackCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.isRead, false));
    return result?.count ?? 0;
  }

  async createAppRating(data: { staffId: string; rating: string; pageUrl?: string | null; context?: string | null }): Promise<import("@shared/schema").AppRating> {
    const [result] = await db.insert(appRatings).values(data).returning();
    return result;
  }

  async getAllAppRatings(): Promise<import("@shared/schema").AppRatingWithStaff[]> {
    const results = await db
      .select({
        id: appRatings.id,
        staffId: appRatings.staffId,
        rating: appRatings.rating,
        pageUrl: appRatings.pageUrl,
        context: appRatings.context,
        submittedAt: appRatings.submittedAt,
        staffName: staff.name,
      })
      .from(appRatings)
      .leftJoin(staff, eq(appRatings.staffId, staff.id))
      .orderBy(desc(appRatings.submittedAt));
    return results.map(r => ({ ...r, staffName: r.staffName ?? "Unknown" }));
  }

  async createActivityLog(data: InsertActivityLog): Promise<ActivityLogEntry> {
    const [created] = await db.insert(activityLog).values(data).returning();
    return created;
  }

  async getActivityLogs(filters: { staffId?: string; limit?: number }): Promise<ActivityLogEntry[]> {
    const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);
    const where = filters.staffId ? eq(activityLog.staffId, filters.staffId) : undefined;
    const q = db.select().from(activityLog).orderBy(desc(activityLog.occurredAt)).limit(limit);
    const results = where ? await q.where(where) : await q;
    return results;
  }

  async getInactiveStaff(days: number): Promise<InactiveStaffEntry[]> {
    const safeDays = Math.max(1, Math.min(days, 365));
    const threshold = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const lastByStaff = await db
      .select({
        staffId: activityLog.staffId,
        lastAt: sql<Date>`MAX(${activityLog.occurredAt})`.as("last_at"),
      })
      .from(activityLog)
      .groupBy(activityLog.staffId);

    const lastMap = new Map<string, Date>();
    for (const row of lastByStaff) {
      if (row.staffId && row.lastAt) lastMap.set(row.staffId, new Date(row.lastAt as any));
    }

    const allStaff = await this.getAllStaffWithDetails();
    const inactive: InactiveStaffEntry[] = [];
    for (const s of allStaff) {
      const last = lastMap.get(s.id) ?? null;
      if (!last || last < threshold) {
        inactive.push({ ...s, lastActivityAt: last });
      }
    }
    inactive.sort((a, b) => {
      const aT = a.lastActivityAt ? a.lastActivityAt.getTime() : 0;
      const bT = b.lastActivityAt ? b.lastActivityAt.getTime() : 0;
      return aT - bT;
    });
    return inactive;
  }
}

export const storage = new DatabaseStorage();

// ─── Startup seed ──────────────────────────────────────────────────────────────
// Ensures the three core super-admin accounts always exist in every database
// (Replit dev, Railway production, fresh deployments, etc.).
// Uses email as the stable unique key — safe to run on every startup.

const SEED_SUPER_ADMINS: Array<{
  name: string;
  email: string;
  spuName: string;
}> = [
  { name: "Amanda Harris",   email: "amanda.harris@macu.edu",  spuName: "Strategic Initiatives"   },
  { name: "Phil Greenwald",  email: "phil@macu.edu",          spuName: "Office of the President" },
  { name: "Garrett Finnell", email: "garrett.finnell@macu.edu", spuName: "Information Technology"  },
];

async function getOrCreateSpu(name: string): Promise<string> {
  const [existing] = await db.select({ id: spus.id }).from(spus).where(eq(spus.name, name));
  if (existing) return existing.id;
  const [created] = await db.insert(spus).values({ name }).returning({ id: spus.id });
  return created.id;
}

export async function seedDatabase(): Promise<void> {
  try {
    for (const admin of SEED_SUPER_ADMINS) {
      const spuId = await getOrCreateSpu(admin.spuName);

      // Upsert by email — update name/role/spuId if the record already exists
      // so corrections in this list are applied automatically on next deploy.
      await db
        .insert(staff)
        .values({
          name: admin.name,
          email: admin.email,
          role: "super_admin",
          spuId,
        })
        .onConflictDoUpdate({
          target: staff.email,
          set: {
            name: admin.name,
            role: "super_admin",
            spuId,
          },
        });
    }
    console.log("[seed] Super-admin accounts verified/created.");
  } catch (err) {
    console.error("[seed] Failed to seed super-admin accounts:", err);
  }
}
