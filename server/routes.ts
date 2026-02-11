import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertStaffSchema,
  insertSpuSchema,
  insertSubUnitSchema,
  insertYearSchema,
  insertOkrSchema,
  updateOkrSchema,
  insertQuarterlyUpdateSchema,
  updateQuarterlyUpdateSchema,
  insertOkrResponsibilitySchema,
  insertStaffSpuAssignmentSchema,
  insertLeaderBasicAssignmentSchema,
  USER_ROLES,
} from "@shared/schema";
import type { Okr, OkrWithDetails, EmployeeProgressRecord, UserRole } from "@shared/schema";
import { parseMultiSelectField, getPlanningYear } from "@shared/schema";
import { z } from "zod";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
}

async function requireRole(req: Request, res: Response, roles: UserRole[]): Promise<boolean> {
  const staffId = req.session.selectedStaffId;
  if (!staffId) {
    res.status(401).json({ error: "Please select a staff profile first" });
    return false;
  }
  
  const staff = await storage.getStaff(staffId);
  if (!staff) {
    res.status(401).json({ error: "Invalid staff session" });
    return false;
  }
  
  if (!roles.includes(staff.role as UserRole)) {
    res.status(403).json({ error: `Access denied. Required roles: ${roles.join(", ")}` });
    return false;
  }
  
  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { password } = req.body;
      const authResult = await storage.verifyPassword(password);
      
      if (authResult.isValid) {
        req.session.regenerate((err) => {
          if (err) {
            return res.status(500).json({ error: "Session error" });
          }
          
          req.session.isAdmin = authResult.isAdmin;
          req.session.sessionVersion = Date.now();
          delete req.session.selectedStaffId;
          delete req.session.selectedStaffName;
          
          req.session.save((err) => {
            if (err) {
              return res.status(500).json({ error: "Session save error" });
            }
            res.json({ success: true, isAdmin: authResult.isAdmin });
          });
        });
      } else {
        res.status(401).json({ error: "Invalid password" });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      if (req.session.isAdmin === undefined) {
        return res.json({ authenticated: false });
      }
      
      const sessionData: any = {
        authenticated: true,
        isAdmin: req.session.isAdmin,
        selectedStaffId: req.session.selectedStaffId,
        selectedStaffName: req.session.selectedStaffName,
      };
      
      if (req.session.selectedStaffId) {
        const staff = await storage.getStaffWithDetails(req.session.selectedStaffId);
        if (staff && staff.spu) {
          sessionData.selectedStaff = staff;
        } else {
          delete req.session.selectedStaffId;
          delete req.session.selectedStaffName;
          delete sessionData.selectedStaffId;
          delete sessionData.selectedStaffName;
        }
      }
      
      res.json(sessionData);
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve session" });
    }
  });

  app.post("/api/auth/select-staff", async (req, res) => {
    try {
      if (req.session.isAdmin === undefined) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { staffId } = req.body;
      if (!staffId) {
        return res.status(400).json({ error: "Staff ID required" });
      }
      
      const staff = await storage.getStaffWithDetails(staffId);
      if (!staff) {
        return res.status(404).json({ error: "Staff not found" });
      }
      
      if (!staff.spu) {
        return res.status(400).json({ error: "Staff member has invalid SPU data" });
      }
      
      req.session.selectedStaffId = staff.id;
      req.session.selectedStaffName = staff.name;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: "Session save error" });
        }
        res.json({ success: true, staff });
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to select staff" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
    } catch (error) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // App Settings
  app.get("/api/settings/password-login", async (_req, res) => {
    try {
      const value = await storage.getSetting("password_login_enabled");
      res.json({ enabled: value !== "false" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/settings/password-login", async (req, res) => {
    try {
      if (!req.session.selectedStaffId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const staffMember = await storage.getStaff(req.session.selectedStaffId);
      if (!staffMember || staffMember.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can change this setting" });
      }
      const schema = z.object({ enabled: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      await storage.setSetting("password_login_enabled", parsed.data.enabled ? "true" : "false");
      res.json({ success: true, enabled: parsed.data.enabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Strategic Plan Start Year
  app.get("/api/settings/strategic-plan-start-year", async (_req, res) => {
    try {
      const value = await storage.getSetting("strategic_plan_start_year");
      res.json({ startYear: value ? parseInt(value) : 2024 });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/settings/strategic-plan-start-year", async (req, res) => {
    try {
      if (!req.session.selectedStaffId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const staffMember = await storage.getStaff(req.session.selectedStaffId);
      if (!staffMember || staffMember.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can change this setting" });
      }
      const schema = z.object({ startYear: z.number().int().min(2000).max(2100) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      await storage.setSetting("strategic_plan_start_year", String(parsed.data.startYear));
      res.json({ success: true, startYear: parsed.data.startYear });
    } catch (error) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // University Strategic Planning routes
  app.get("/api/university-objectives", async (_req, res) => {
    try {
      const objectives = await storage.getAllUniversityObjectives();
      res.json(objectives);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch university objectives" });
    }
  });

  app.post("/api/university-objectives", async (req, res) => {
    try {
      if (!(await requireRole(req, res, ["super_admin"]))) return;
      const schema = z.object({
        label: z.string().min(1),
        description: z.string().min(1),
        sortOrder: z.number().int().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }
      const objective = await storage.createUniversityObjective(parsed.data);
      res.status(201).json(objective);
    } catch (error) {
      res.status(500).json({ error: "Failed to create university objective" });
    }
  });

  app.patch("/api/university-objectives/:id", async (req, res) => {
    try {
      if (!(await requireRole(req, res, ["super_admin"]))) return;
      const schema = z.object({
        label: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        sortOrder: z.number().int().optional(),
        applicableYears: z.array(z.number().int()).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }
      const objective = await storage.updateUniversityObjective(req.params.id, parsed.data);
      res.json(objective);
    } catch (error) {
      res.status(500).json({ error: "Failed to update university objective" });
    }
  });

  app.delete("/api/university-objectives/:id", async (req, res) => {
    try {
      if (!(await requireRole(req, res, ["super_admin"]))) return;
      await storage.deleteUniversityObjective(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete university objective" });
    }
  });

  app.post("/api/university-key-results", async (req, res) => {
    try {
      if (!(await requireRole(req, res, ["super_admin"]))) return;
      const schema = z.object({
        objectiveId: z.string().min(1),
        label: z.string().min(1),
        description: z.string().min(1),
        sortOrder: z.number().int().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }
      const kr = await storage.createUniversityKeyResult(parsed.data);
      res.status(201).json(kr);
    } catch (error) {
      res.status(500).json({ error: "Failed to create university key result" });
    }
  });

  app.patch("/api/university-key-results/:id", async (req, res) => {
    try {
      if (!(await requireRole(req, res, ["super_admin"]))) return;
      const schema = z.object({
        label: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        sortOrder: z.number().int().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }
      const kr = await storage.updateUniversityKeyResult(req.params.id, parsed.data);
      res.json(kr);
    } catch (error) {
      res.status(500).json({ error: "Failed to update university key result" });
    }
  });

  app.delete("/api/university-key-results/:id", async (req, res) => {
    try {
      if (!(await requireRole(req, res, ["super_admin"]))) return;
      await storage.deleteUniversityKeyResult(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete university key result" });
    }
  });

  app.post("/api/auth/enter", async (req, res) => {
    try {
      const passwordRequired = await storage.getSetting("password_login_enabled");
      if (passwordRequired !== "false") {
        return res.status(403).json({ error: "Password login is still enabled" });
      }
      const schema = z.object({ isAdmin: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      const { isAdmin } = parsed.data;
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: "Session error" });
        }
        req.session.isAdmin = !!isAdmin;
        req.session.sessionVersion = Date.now();
        delete req.session.selectedStaffId;
        delete req.session.selectedStaffName;
        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ error: "Session save error" });
          }
          res.json({ success: true, isAdmin: !!isAdmin });
        });
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/staff", async (_req, res) => {
    try {
      const staff = await storage.getAllStaffWithDetails();
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.get("/api/staff/:id", async (req, res) => {
    try {
      const staff = await storage.getStaffWithDetails(req.params.id);
      if (!staff) {
        return res.status(404).json({ error: "Staff not found" });
      }
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.post("/api/staff", requireAdmin, async (req, res) => {
    try {
      const parsed = insertStaffSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const staff = await storage.createStaff(parsed.data);
      res.status(201).json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to create staff" });
    }
  });

  app.put("/api/staff/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = insertStaffSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const updatedStaff = await storage.updateStaff(req.params.id, parsed.data);
      res.json(updatedStaff);
    } catch (error) {
      res.status(500).json({ error: "Failed to update staff" });
    }
  });

  app.delete("/api/staff/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteStaff(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff" });
    }
  });

  app.post("/api/staff/merge", requireAdmin, async (req, res) => {
    try {
      const { sourceId, targetId } = req.body;
      if (!sourceId || !targetId) {
        return res.status(400).json({ error: "Both sourceId and targetId are required" });
      }
      if (sourceId === targetId) {
        return res.status(400).json({ error: "Cannot merge a staff member with themselves" });
      }
      
      const source = await storage.getStaff(sourceId);
      const target = await storage.getStaff(targetId);
      if (!source) {
        return res.status(404).json({ error: "Source staff member not found" });
      }
      if (!target) {
        return res.status(404).json({ error: "Target staff member not found" });
      }

      const result = await storage.mergeStaff(sourceId, targetId);
      res.json({
        success: true,
        message: `Merged "${source.name}" into "${target.name}". Transferred ${result.okrsMerged} OKRs, ${result.updatesMerged} updates, and ${result.responsibilitiesMerged} responsibilities.`,
        ...result,
      });
    } catch (error) {
      console.error("Merge staff error:", error);
      res.status(500).json({ error: "Failed to merge staff accounts" });
    }
  });

  // Staff lookup by ID number or email
  app.get("/api/staff/by-id-number/:staffIdNumber", async (req, res) => {
    try {
      const staff = await storage.getStaffByIdNumber(req.params.staffIdNumber);
      if (!staff) {
        return res.status(404).json({ error: "Staff not found" });
      }
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.get("/api/staff/by-email/:email", async (req, res) => {
    try {
      const staff = await storage.getStaffByEmail(decodeURIComponent(req.params.email));
      if (!staff) {
        return res.status(404).json({ error: "Staff not found" });
      }
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  // Staff SPU Assignments
  app.get("/api/staff/:staffId/assignments", async (req, res) => {
    try {
      const assignments = await storage.getStaffSpuAssignments(req.params.staffId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SPU assignments" });
    }
  });

  app.post("/api/staff/:staffId/assignments", async (req, res) => {
    try {
      // Only super admins and leaders can assign SPUs
      if (!await requireRole(req, res, ["super_admin", "leader"])) return;
      
      const sessionStaffId = req.session.selectedStaffId!;
      const sessionStaff = await storage.getStaff(sessionStaffId);
      const targetStaffId = req.params.staffId;
      
      // Leaders can only assign SPUs to their own basic users
      if (sessionStaff?.role === "leader" && sessionStaffId !== targetStaffId) {
        const basicUsers = await storage.getBasicUsersForLeader(sessionStaffId);
        if (!basicUsers.find(u => u.id === targetStaffId)) {
          return res.status(403).json({ error: "Leaders can only manage their own basic users" });
        }
      }
      
      const parsed = insertStaffSpuAssignmentSchema.safeParse({
        ...req.body,
        staffId: targetStaffId,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const assignment = await storage.createStaffSpuAssignment(parsed.data);
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create SPU assignment" });
    }
  });

  app.delete("/api/staff/:staffId/assignments/:assignmentId", async (req, res) => {
    try {
      // Only super admins and leaders can delete assignments
      if (!await requireRole(req, res, ["super_admin", "leader"])) return;
      
      await storage.deleteStaffSpuAssignment(req.params.assignmentId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SPU assignment" });
    }
  });

  // Leader-Basic Relationships
  app.get("/api/staff/:staffId/leaders", async (req, res) => {
    try {
      const leaders = await storage.getLeadersForBasicUser(req.params.staffId);
      res.json(leaders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaders" });
    }
  });

  app.get("/api/staff/:staffId/basic-users", async (req, res) => {
    try {
      const teamMembers = await storage.getTeamMembersForLeader(req.params.staffId);
      res.json(teamMembers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.post("/api/leader-assignments", async (req, res) => {
    try {
      // Only super admins and leaders can create leader-basic assignments
      if (!await requireRole(req, res, ["super_admin", "leader"])) return;
      
      const sessionStaffId = req.session.selectedStaffId!;
      const sessionStaff = await storage.getStaff(sessionStaffId);
      
      // Leaders can only assign themselves as leader
      if (sessionStaff?.role === "leader" && req.body.leaderId !== sessionStaffId) {
        return res.status(403).json({ error: "Leaders can only assign themselves" });
      }
      
      const parsed = insertLeaderBasicAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const assignment = await storage.createLeaderBasicAssignment(parsed.data);
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create leader assignment" });
    }
  });

  app.delete("/api/leader-assignments/:leaderId/:basicId", async (req, res) => {
    try {
      // Only super admins and the leader themselves can delete assignments
      if (!await requireRole(req, res, ["super_admin", "leader"])) return;
      
      const sessionStaffId = req.session.selectedStaffId!;
      const sessionStaff = await storage.getStaff(sessionStaffId);
      
      // Leaders can only delete their own assignments
      if (sessionStaff?.role === "leader" && req.params.leaderId !== sessionStaffId) {
        return res.status(403).json({ error: "Leaders can only remove their own assignments" });
      }
      
      await storage.deleteLeaderBasicAssignment(req.params.leaderId, req.params.basicId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete leader assignment" });
    }
  });

  // Create user with role-based authorization
  app.post("/api/users/create", async (req, res) => {
    try {
      // Super admins can create any role, leaders can only create basic users
      if (!await requireRole(req, res, ["super_admin", "leader"])) return;
      
      const sessionStaffId = req.session.selectedStaffId!;
      const sessionStaff = await storage.getStaff(sessionStaffId);
      
      const { staffIdNumber, name, email, spuId, subUnitId, role } = req.body;
      
      // Leaders can only create basic users
      if (sessionStaff?.role === "leader" && role !== "basic") {
        return res.status(403).json({ error: "Leaders can only create basic users" });
      }
      
      // Check if user already exists
      if (staffIdNumber) {
        const existingByIdNumber = await storage.getStaffByIdNumber(staffIdNumber);
        if (existingByIdNumber) {
          return res.status(409).json({ 
            error: "User already exists", 
            existingUser: existingByIdNumber,
            message: "A user with this Staff ID Number already exists. Would you like to add them to your SPU instead?"
          });
        }
      }
      
      const existingByEmail = await storage.getStaffByEmail(email);
      if (existingByEmail) {
        return res.status(409).json({ 
          error: "User already exists", 
          existingUser: existingByEmail,
          message: "A user with this email already exists. Would you like to add them to your SPU instead?"
        });
      }
      
      const parsed = insertStaffSchema.safeParse({
        staffIdNumber,
        name,
        email,
        spuId,
        subUnitId: subUnitId || null,
        role: role || "basic",
        isAdmin: role === "super_admin",
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const newStaff = await storage.createStaff(parsed.data);
      
      // If a leader created this user, automatically assign leader-basic relationship
      if (sessionStaff?.role === "leader") {
        await storage.createLeaderBasicAssignment({
          leaderId: sessionStaffId,
          basicId: newStaff.id,
        });
      }
      
      res.status(201).json(newStaff);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.get("/api/spus", async (_req, res) => {
    try {
      const spus = await storage.getAllSpus();
      res.json(spus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SPUs" });
    }
  });

  app.post("/api/spus", requireAdmin, async (req, res) => {
    try {
      const parsed = insertSpuSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const spu = await storage.createSpu(parsed.data);
      res.status(201).json(spu);
    } catch (error) {
      res.status(500).json({ error: "Failed to create SPU" });
    }
  });

  app.put("/api/spus/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = insertSpuSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const updatedSpu = await storage.updateSpu(req.params.id, parsed.data);
      res.json(updatedSpu);
    } catch (error) {
      res.status(500).json({ error: "Failed to update SPU" });
    }
  });

  app.delete("/api/spus/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSpu(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SPU" });
    }
  });

  app.get("/api/sub-units", async (_req, res) => {
    try {
      const subUnits = await storage.getAllSubUnits();
      res.json(subUnits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sub-units" });
    }
  });

  app.post("/api/sub-units", requireAdmin, async (req, res) => {
    try {
      const parsed = insertSubUnitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const subUnit = await storage.createSubUnit(parsed.data);
      res.status(201).json(subUnit);
    } catch (error) {
      res.status(500).json({ error: "Failed to create sub-unit" });
    }
  });

  app.put("/api/sub-units/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = insertSubUnitSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const updatedSubUnit = await storage.updateSubUnit(req.params.id, parsed.data);
      res.json(updatedSubUnit);
    } catch (error) {
      res.status(500).json({ error: "Failed to update sub-unit" });
    }
  });

  app.delete("/api/sub-units/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSubUnit(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sub-unit" });
    }
  });

  app.get("/api/years", async (_req, res) => {
    try {
      const years = await storage.getAllYears();
      res.json(years);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch years" });
    }
  });

  app.post("/api/years", requireAdmin, async (req, res) => {
    try {
      const parsed = insertYearSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const year = await storage.createYear(parsed.data);
      res.status(201).json(year);
    } catch (error) {
      res.status(500).json({ error: "Failed to create year" });
    }
  });

  app.delete("/api/years/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteYear(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete year" });
    }
  });

  // Staff SPU Assignments - for multi-SPU leadership
  app.get("/api/spu-assignments", async (req, res) => {
    try {
      const assignments = await storage.getAllStaffSpuAssignments();
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch all SPU assignments" });
    }
  });

  app.get("/api/staff/:staffId/spu-assignments", async (req, res) => {
    try {
      const assignments = await storage.getStaffSpuAssignments(req.params.staffId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SPU assignments" });
    }
  });

  app.post("/api/staff/:staffId/spu-assignments", requireAdmin, async (req, res) => {
    try {
      const { spuId, subUnitId } = req.body;
      if (!spuId) {
        return res.status(400).json({ error: "SPU ID is required" });
      }
      const assignment = await storage.createStaffSpuAssignment({
        staffId: req.params.staffId,
        spuId,
        subUnitId: subUnitId || null,
      });
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create SPU assignment" });
    }
  });

  app.delete("/api/staff/spu-assignments/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteStaffSpuAssignment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SPU assignment" });
    }
  });

  app.get("/api/okrs", async (req, res) => {
    try {
      const okrs = await storage.getAllOkrsWithDetails();
      res.json(okrs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch OKRs" });
    }
  });

  app.get("/api/okrs/:staffId", async (req, res) => {
    try {
      const okrs = await storage.getOkrsByStaff(req.params.staffId);
      res.json(okrs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch OKRs" });
    }
  });

  // Get OKRs by SPU (for SPU-centric model)
  // Uses server-side session to validate staff belongs to requested SPU
  app.get("/api/okrs/by-spu/:spuId", async (req, res) => {
    try {
      const sessionStaffId = req.session.selectedStaffId;
      const requestedSpuId = req.params.spuId;
      
      // Require authenticated session with selected staff
      if (!sessionStaffId) {
        return res.status(401).json({ error: "Please select a staff profile first" });
      }
      
      // Validate staff belongs to requested SPU using server-side session
      const staffMember = await storage.getStaff(sessionStaffId);
      if (!staffMember) {
        return res.status(401).json({ error: "Invalid staff session" });
      }
      
      if (staffMember.spuId !== requestedSpuId) {
        return res.status(403).json({ error: "Access denied: You can only view OKRs for your own SPU" });
      }
      
      const okrs = await storage.getOkrsWithDetailsBySpu(requestedSpuId);
      res.json(okrs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SPU OKRs" });
    }
  });

  app.post("/api/okrs", async (req, res) => {
    try {
      console.log("[POST /api/okrs] Request body:", JSON.stringify(req.body, null, 2));
      const parsed = insertOkrSchema.safeParse(req.body);
      if (!parsed.success) {
        console.log("[POST /api/okrs] Validation error:", JSON.stringify(parsed.error, null, 2));
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      // Get staff name to store as submitterName (persists even if staff is deleted)
      let submitterName: string | undefined;
      if (parsed.data.staffId) {
        const staffMember = await storage.getStaff(parsed.data.staffId);
        submitterName = staffMember?.name;
      }
      
      // Auto-generate OKR number based on existing count for this SPU and year
      const existingCount = await storage.countOkrsBySpu(parsed.data.spuId, parsed.data.year);
      const okrNumber = `OKR ${existingCount + 1}`;
      
      console.log("[POST /api/okrs] Parsed data:", JSON.stringify(parsed.data, null, 2));
      const okr = await storage.createOkr({ ...parsed.data, okrNumber, submitterName });
      console.log("[POST /api/okrs] Created OKR:", JSON.stringify(okr, null, 2));
      res.status(201).json(okr);
    } catch (error) {
      console.error("[POST /api/okrs] Error:", error);
      res.status(500).json({ error: "Failed to create OKR", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/okrs/:id", requireAdmin, async (req, res) => {
    try {
      const existingOkr = await storage.getOkr(req.params.id);
      if (!existingOkr) {
        return res.status(404).json({ error: "OKR not found" });
      }
      
      const { reason, editedBy, editedByName, ...updateFields } = req.body;
      
      const parsed = updateOkrSchema.safeParse(updateFields);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const updates: Record<string, any> = {};
      const changedFields: string[] = [];
      const previousValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          const existingVal = (existingOkr as any)[key];
          if (JSON.stringify(existingVal) !== JSON.stringify(value)) {
            changedFields.push(key);
            previousValues[key] = existingVal;
            newValues[key] = value;
          }
          updates[key] = value;
        }
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const updatedOkr = await storage.updateOkr(req.params.id, updates);
      
      if (changedFields.length > 0 && reason) {
        await storage.createEditLog({
          okrId: req.params.id,
          editedBy: editedBy || null,
          editedByName: editedByName || null,
          reason,
          changedFields: JSON.stringify(changedFields),
          previousValues: JSON.stringify(previousValues),
          newValues: JSON.stringify(newValues),
        });
      }
      
      res.json(updatedOkr);
    } catch (error) {
      console.error("PUT /api/okrs/:id - Error:", error);
      res.status(500).json({ error: "Failed to update OKR", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/edit-logs", requireAdmin, async (_req, res) => {
    try {
      const logs = await storage.getAllEditLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch edit logs" });
    }
  });

  app.delete("/api/okrs/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteOkr(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete OKR" });
    }
  });

  // Aggregated API: OKRs with their quarterly updates and derived progress (admin-only)
  app.get("/api/okrs-with-updates", requireAdmin, async (_req, res) => {
    try {
      const okrs = await storage.getAllOkrsWithDetails();
      const allUpdates = await storage.getAllQuarterlyUpdates();
      
      // Aggregate OKRs with their updates and calculate derived progress
      const aggregated = okrs.map(okr => {
        const updates = allUpdates.filter(u => u.okrId === okr.id)
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        
        // Parse keyResultScores for each update
        const updatesWithParsedScores = updates.map(update => {
          let parsedScores = null;
          if (update.keyResultScores) {
            try {
              parsedScores = JSON.parse(update.keyResultScores);
            } catch (e) {
              console.error("Failed to parse keyResultScores:", e);
            }
          }
          return {
            ...update,
            keyResultScoresParsed: parsedScores,
          };
        });
        
        // Derive current progress from latest update's averageScore
        const latestUpdate = updatesWithParsedScores[0];
        const derivedProgress = latestUpdate?.averageScore ?? okr.currentValue;
        
        return {
          ...okr,
          derivedProgress,
          quarterlyUpdates: updatesWithParsedScores,
        };
      });
      
      res.json(aggregated);
    } catch (error) {
      console.error("Failed to fetch aggregated OKRs:", error);
      res.status(500).json({ error: "Failed to fetch aggregated OKRs" });
    }
  });

  app.get("/api/quarterly-updates", async (_req, res) => {
    try {
      const updates = await storage.getAllQuarterlyUpdates();
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quarterly updates" });
    }
  });

  app.post("/api/quarterly-updates", async (req, res) => {
    try {
      const parsed = insertQuarterlyUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      // Get staff name to store as scorerName (persists even if staff is deleted)
      let scorerName: string | undefined;
      if (parsed.data.staffId) {
        const staffMember = await storage.getStaff(parsed.data.staffId);
        scorerName = staffMember?.name;
      }
      
      const update = await storage.createQuarterlyUpdate({ ...parsed.data, scorerName });
      res.status(201).json(update);
    } catch (error) {
      res.status(500).json({ error: "Failed to create quarterly update" });
    }
  });

  app.put("/api/quarterly-updates/:id", requireAdmin, async (req, res) => {
    try {
      const existingUpdate = await storage.getQuarterlyUpdate(req.params.id);
      if (!existingUpdate) {
        return res.status(404).json({ error: "Quarterly update not found" });
      }
      
      const { reason, editedBy, editedByName, ...updateFields } = req.body;
      
      const parsed = updateQuarterlyUpdateSchema.safeParse(updateFields);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const updates: Record<string, any> = {};
      const changedFields: string[] = [];
      const previousValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          const existingVal = (existingUpdate as any)[key];
          if (JSON.stringify(existingVal) !== JSON.stringify(value)) {
            changedFields.push(key);
            previousValues[key] = existingVal;
            newValues[key] = value;
          }
          updates[key] = value;
        }
      }
      
      if (updates.keyResultScores && typeof updates.keyResultScores === 'string') {
        try {
          const scores = JSON.parse(updates.keyResultScores);
          if (Array.isArray(scores) && scores.length > 0) {
            const validScores = scores.every(
              (kr: any) => typeof kr.score === 'number' && kr.score >= 0 && kr.score <= 100
            );
            if (!validScores) {
              return res.status(400).json({ error: "Invalid key result scores: each score must be 0-100" });
            }
            const total = scores.reduce((sum: number, kr: any) => sum + kr.score, 0);
            updates.averageScore = Math.round(total / scores.length);
          }
        } catch (e) {
          return res.status(400).json({ error: "Invalid keyResultScores format" });
        }
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const updatedUpdate = await storage.updateQuarterlyUpdate(req.params.id, updates);
      
      if (changedFields.length > 0 && reason) {
        await storage.createEditLog({
          okrId: existingUpdate.okrId,
          editedBy: editedBy || null,
          editedByName: editedByName || null,
          reason,
          changedFields: JSON.stringify(changedFields),
          previousValues: JSON.stringify(previousValues),
          newValues: JSON.stringify(newValues),
        });
      }
      
      res.json(updatedUpdate);
    } catch (error) {
      res.status(500).json({ error: "Failed to update quarterly update" });
    }
  });

  app.get("/api/export/csv", async (req, res) => {
    try {
      const { quarter, year, planningYear } = req.query;
      let okrs = await storage.getAllOkrsWithDetails();
      
      if (quarter && quarter !== "All") {
        okrs = okrs.filter((okr) => okr.quarter === quarter);
      }
      
      if (year && year !== "All") {
        okrs = okrs.filter((okr) => String(okr.year) === year);
      }

      if (planningYear && planningYear !== "All") {
        const startYearSetting = await storage.getAppSetting("strategicPlanStartYear");
        const startYear = startYearSetting ? parseInt(startYearSetting) : 2024;
        const pyNum = parseInt(planningYear as string);
        okrs = okrs.filter((okr) => getPlanningYear(okr.quarter, okr.year, startYear) === pyNum);
      }
      
      const updates = await storage.getAllQuarterlyUpdates();
      
      const csvRows: string[] = [];
      csvRows.push([
        "Staff Name",
        "Email",
        "Staff Primary SPU",
        "Staff Sub-Unit",
        "OKR Submitted for SPU",
        "OKR Submitted for Sub-Unit",
        "Collaboration SPU",
        "Quarter",
        "Year",
        "OKR Number",
        "University Objective",
        "University Key Result",
        "Objective Statement",
        "Key Results",
        "Current %",
        "Status",
        "Created Date",
        "Latest Update Quarter",
        "Latest Update Year",
        "Latest Update Average Score",
        "Latest Update Key Result Scores (Readable)",
        "Latest Update Key Result Scores (JSON)",
        "Latest Update Additional Key Results",
        "Latest Update Notes",
        "Latest Update Date",
      ].join(","));
      
      for (const okr of okrs) {
        const okrUpdates = updates.filter((u) => u.okrId === okr.id);
        const latestUpdate = okrUpdates.sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        )[0];
        
        // Parse key result scores from latest update if available
        let keyResultScoresReadable = "N/A";
        let keyResultScoresJson = "N/A";
        if (latestUpdate?.keyResultScores) {
          try {
            const scores = JSON.parse(latestUpdate.keyResultScores);
            keyResultScoresReadable = scores.map((kr: any) => 
              `KR${kr.keyResultNumber}: ${kr.score}%`
            ).join("; ");
            keyResultScoresJson = latestUpdate.keyResultScores.replace(/"/g, '""');
          } catch (e) {
            keyResultScoresReadable = latestUpdate.keyResultScores;
            keyResultScoresJson = latestUpdate.keyResultScores;
          }
        }

        const row = [
          `"${okr.staff.name}"`,
          `"${okr.staff.email}"`,
          `"${okr.staff.spu.name}"`,
          `"${okr.staff.subUnit?.name || "N/A"}"`,
          `"${okr.spu?.name || "N/A"}"`,
          `"${okr.subUnit?.name || "N/A"}"`,
          `"${okr.collaborationSpu?.name || "Not Applicable"}"`,
          okr.quarter,
          okr.year,
          okr.okrNumber,
          `"${parseMultiSelectField(okr.universityObjective).join("; ").replace(/"/g, '""')}"`,
          `"${parseMultiSelectField(okr.universityKeyResult).join("; ").replace(/"/g, '""')}"`,
          `"${okr.objectiveStatement.replace(/"/g, '""')}"`,
          `"${okr.keyResults.replace(/"/g, '""')}"`,
          okr.currentValue,
          okr.status,
          new Date(okr.createdAt).toISOString().split("T")[0],
          latestUpdate?.quarter || "N/A",
          latestUpdate ? String(latestUpdate.year) : "N/A",
          latestUpdate?.averageScore !== null && latestUpdate?.averageScore !== undefined ? String(latestUpdate.averageScore) : "N/A",
          `"${keyResultScoresReadable}"`,
          `"${keyResultScoresJson}"`,
          latestUpdate?.additionalKeyResults ? `"${latestUpdate.additionalKeyResults.replace(/"/g, '""')}"` : "",
          latestUpdate ? `"${latestUpdate.notes.replace(/"/g, '""')}"` : "N/A",
          latestUpdate ? new Date(latestUpdate.submittedAt).toISOString().split("T")[0] : "N/A",
        ].join(",");
        
        csvRows.push(row);
      }
      
      const csv = csvRows.join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=okrs_export.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Employee Progress API
  app.get("/api/employee-progress", async (req, res) => {
    try {
      const filters = {
        year: req.query.year ? Number(req.query.year) : undefined,
        quarter: req.query.quarter as string | undefined,
        staffId: req.query.staffId as string | undefined,
        spuId: req.query.spuId as string | undefined,
        status: req.query.status as string | undefined,
      };
      
      const progressRecords = await storage.getEmployeeProgress(filters);
      res.json(progressRecords);
    } catch (error) {
      console.error("Error fetching employee progress:", error);
      res.status(500).json({ error: "Failed to fetch employee progress" });
    }
  });

  // Employee Progress Grouped API
  app.get("/api/employee-progress/grouped", async (req, res) => {
    try {
      const filters = {
        year: req.query.year ? Number(req.query.year) : undefined,
        quarter: req.query.quarter as string | undefined,
        staffId: req.query.staffId as string | undefined,
        spuId: req.query.spuId as string | undefined,
        status: req.query.status as string | undefined,
      };
      
      const progressSummaries = await storage.getEmployeeProgressGrouped(filters);
      res.json(progressSummaries);
    } catch (error) {
      console.error("Error fetching grouped employee progress:", error);
      res.status(500).json({ error: "Failed to fetch grouped employee progress" });
    }
  });

  // OKR Responsibilities API
  app.post("/api/okr-responsibilities", requireAdmin, async (req, res) => {
    try {
      const validated = insertOkrResponsibilitySchema.parse(req.body);
      const responsibility = await storage.createOkrResponsibility(validated);
      res.status(201).json(responsibility);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating responsibility:", error);
      res.status(500).json({ error: "Failed to create responsibility" });
    }
  });

  app.get("/api/okr-responsibilities/:okrId", async (req, res) => {
    try {
      const responsibilities = await storage.getOkrResponsibilities(req.params.okrId);
      res.json(responsibilities);
    } catch (error) {
      console.error("Error fetching responsibilities:", error);
      res.status(500).json({ error: "Failed to fetch responsibilities" });
    }
  });

  app.delete("/api/okr-responsibilities/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteOkrResponsibility(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting responsibility:", error);
      res.status(500).json({ error: "Failed to delete responsibility" });
    }
  });

  // CSV parsing helper
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          if (char === '\r') i++;
          currentRow.push(currentField);
          if (currentRow.length > 1 || currentRow[0] !== '') {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }
    return rows;
  };

  // Map OKR number text to format
  const mapOkrNumber = (text: string): string => {
    const normalized = text.trim().toUpperCase();
    if (normalized.includes('1ST') || normalized === '1') return 'OKR 1';
    if (normalized.includes('2ND') || normalized === '2') return 'OKR 2';
    if (normalized.includes('3RD') || normalized === '3') return 'OKR 3';
    if (normalized.includes('4TH') || normalized === '4') return 'OKR 4';
    if (normalized.includes('5TH') || normalized === '5') return 'OKR 5';
    const numMatch = normalized.match(/(\d+)/);
    if (numMatch) {
      const num = Math.min(parseInt(numMatch[1]), 5);
      if (num >= 1) return `OKR ${num}`;
    }
    return 'OKR 1';
  };

  // Parse quarter and year from text like "Q1: June 2024 - August 2024"
  const parseQuarterYear = (text: string): { quarter: string; year: number } => {
    const quarterMatch = text.match(/Q([1-4])/i);
    const yearMatch = text.match(/20\d{2}/);
    return {
      quarter: quarterMatch ? `Q${quarterMatch[1]}` : 'Q1',
      year: yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear(),
    };
  };

  // CSV Preview endpoint - parses CSV and returns structured data for review
  app.post("/api/import/csv/preview", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== 'string') {
        return res.status(400).json({ error: "CSV data is required" });
      }

      const rows = parseCSV(csvData);
      if (rows.length < 2) {
        return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const getColIndex = (patterns: string[]): number => {
        for (const pattern of patterns) {
          const idx = headers.findIndex(h => h.toLowerCase().includes(pattern.toLowerCase()));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const colTimestamp = getColIndex(['Timestamp']);
      const colEmail = getColIndex(['Email']);
      const colName = getColIndex(['Your Name', 'Name']);
      const colQuarterYear = getColIndex(['year and quarter', 'quarter']);
      const colOkrNumber = getColIndex(['numbered OKR', 'OKR number', 'Which numbered']);
      const colSpu = getColIndex(['parent SPU', 'SPU']);
      const colSubUnit = getColIndex(['sub-unit', 'sub unit', 'division']);
      const colCollabSpu = getColIndex(['collaborating', 'collaboration']);
      const colUniObjective = getColIndex(['Strategic Objective', 'University Level Strategic']);
      const colUniKeyResult = getColIndex(['University-Level Key Result', 'Key Result for your OKR']);
      const colObjectiveStmt = getColIndex(['Objective Statement', 'Write your Objective']);
      const colKR1 = getColIndex(['first Key Result', 'Key Result Statement']);
      const colKR2 = getColIndex(['second Key Result']);
      const colKR3 = getColIndex(['remaining Key Result', 'any remaining']);
      const colResponsible = getColIndex(['individuals who are working', 'responsible', 'working on this']);

      const missingColumns: string[] = [];
      if (colName === -1) missingColumns.push('Your Name');
      if (colQuarterYear === -1) missingColumns.push('Quarter/Year');
      if (colSpu === -1) missingColumns.push('Parent SPU');
      if (colOkrNumber === -1) missingColumns.push('OKR Number');

      if (missingColumns.length > 0) {
        return res.status(400).json({
          error: "Missing required columns",
          missingColumns,
          detectedHeaders: headers,
          message: `CSV is missing required columns: ${missingColumns.join(', ')}.`
        });
      }

      const previewRows: any[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const staffName = (row[colName] || '').trim();
        const quarterYearText = (row[colQuarterYear] || '').trim();
        const okrNumberText = (row[colOkrNumber] || '').trim();
        const spuText = (row[colSpu] || '').trim();
        const subUnitText = colSubUnit !== -1 ? (row[colSubUnit] || '').trim() : '';
        const collabSpuText = colCollabSpu !== -1 ? (row[colCollabSpu] || '').trim() : '';
        const uniObjective = colUniObjective !== -1 ? (row[colUniObjective] || '').trim() : '';
        const uniKeyResult = colUniKeyResult !== -1 ? (row[colUniKeyResult] || '').trim() : '';
        const objectiveStmt = colObjectiveStmt !== -1 ? (row[colObjectiveStmt] || '').trim() : '';
        const kr1Text = colKR1 !== -1 ? (row[colKR1] || '').trim() : '';
        const kr2Text = colKR2 !== -1 ? (row[colKR2] || '').trim() : '';
        const kr3Text = colKR3 !== -1 ? (row[colKR3] || '').trim() : '';
        const responsibleText = colResponsible !== -1 ? (row[colResponsible] || '').trim() : '';
        const emailText = colEmail !== -1 ? (row[colEmail] || '').trim() : '';
        const timestampText = colTimestamp !== -1 ? (row[colTimestamp] || '').trim() : '';

        if (!staffName && !spuText && !okrNumberText) {
          continue;
        }

        const { quarter, year } = parseQuarterYear(quarterYearText);
        const okrNumber = mapOkrNumber(okrNumberText);

        const rowErrors: string[] = [];
        if (!staffName) rowErrors.push('Missing staff name');
        if (!spuText) rowErrors.push('Missing SPU');
        if (!okrNumberText) rowErrors.push('Missing OKR number');
        if (!objectiveStmt) rowErrors.push('Missing objective statement');

        const cleanSubUnit = subUnitText.toLowerCase() === 'n/a' ? '' : subUnitText;

        previewRows.push({
          rowIndex: i + 2,
          staffName,
          email: emailText,
          timestamp: timestampText,
          quarter,
          year,
          okrNumber,
          spuName: spuText,
          subUnitName: cleanSubUnit,
          collaborationSpu: collabSpuText,
          universityObjective: uniObjective,
          universityKeyResult: uniKeyResult,
          objectiveStatement: objectiveStmt,
          keyResult1: kr1Text,
          keyResult2: kr2Text,
          keyResult3: kr3Text,
          responsibleParties: responsibleText,
          errors: rowErrors,
          include: rowErrors.length === 0,
        });
      }

      res.json({
        success: true,
        totalRows: dataRows.length,
        parsedRows: previewRows.length,
        skippedEmpty: dataRows.length - previewRows.length,
        detectedHeaders: headers,
        rows: previewRows,
        warnings,
      });

    } catch (error: any) {
      console.error("CSV preview error:", error);
      res.status(500).json({ error: "Failed to parse CSV", details: error.message });
    }
  });

  // CSV Import confirm endpoint - imports reviewed/corrected data
  app.post("/api/import/csv/confirm", requireAdmin, async (req, res) => {
    try {
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "No rows to import" });
      }

      const results = {
        spusCreated: 0,
        subUnitsCreated: 0,
        staffCreated: 0,
        yearsCreated: 0,
        okrsCreated: 0,
        rowsSkipped: 0,
        errors: [] as string[],
      };

      const spuCache = new Map<string, any>();
      const subUnitCache = new Map<string, any>();
      const staffCache = new Map<string, any>();
      const yearCache = new Map<number, any>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (!row.include) {
            results.rowsSkipped++;
            continue;
          }

          const { staffName, quarter, year, okrNumber, spuName, subUnitName, collaborationSpu,
                  universityObjective, universityKeyResult, objectiveStatement,
                  keyResult1, keyResult2, keyResult3, responsibleParties } = row;

          if (!staffName || !spuName || !okrNumber) {
            results.rowsSkipped++;
            results.errors.push(`Row ${row.rowIndex}: Missing required fields (name, SPU, or OKR number)`);
            continue;
          }

          if (!yearCache.has(year)) {
            const yearRecord = await storage.findOrCreateYear(year);
            yearCache.set(year, yearRecord);
            results.yearsCreated++;
          }

          const spuNames = spuName.split(',').map((s: string) => s.trim()).filter(Boolean);
          const primarySpuName = spuNames[0];

          let primarySpu;
          if (spuCache.has(primarySpuName.toLowerCase())) {
            primarySpu = spuCache.get(primarySpuName.toLowerCase());
          } else {
            const existingBefore = await storage.getSpuByName(primarySpuName);
            primarySpu = await storage.findOrCreateSpu(primarySpuName);
            spuCache.set(primarySpuName.toLowerCase(), primarySpu);
            if (!existingBefore) results.spusCreated++;
          }

          let subUnit = null;
          if (subUnitName) {
            const cacheKey = `${primarySpuName.toLowerCase()}:${subUnitName.toLowerCase()}`;
            if (subUnitCache.has(cacheKey)) {
              subUnit = subUnitCache.get(cacheKey);
            } else {
              const existingBefore = await storage.getSubUnitByNameAndSpu(subUnitName, primarySpu.id);
              subUnit = await storage.findOrCreateSubUnit(subUnitName, primarySpu.id);
              subUnitCache.set(cacheKey, subUnit);
              if (!existingBefore) results.subUnitsCreated++;
            }
          }

          let collabSpu = null;
          if (collaborationSpu) {
            if (spuCache.has(collaborationSpu.toLowerCase())) {
              collabSpu = spuCache.get(collaborationSpu.toLowerCase());
            } else {
              const existingBefore = await storage.getSpuByName(collaborationSpu);
              collabSpu = await storage.findOrCreateSpu(collaborationSpu);
              spuCache.set(collaborationSpu.toLowerCase(), collabSpu);
              if (!existingBefore) results.spusCreated++;
            }
          }

          let staffRecord;
          if (staffCache.has(staffName.toLowerCase())) {
            staffRecord = staffCache.get(staffName.toLowerCase());
          } else {
            const existingBefore = await storage.getStaffByName(staffName);
            staffRecord = await storage.findOrCreateStaff(staffName, primarySpu.id, subUnit?.id);
            staffCache.set(staffName.toLowerCase(), staffRecord);
            if (!existingBefore) results.staffCreated++;
          }

          const keyResultsArray: { description: string; percentage: number }[] = [];
          if (keyResult1) keyResultsArray.push({ description: keyResult1, percentage: 100 });
          if (keyResult2) keyResultsArray.push({ description: keyResult2, percentage: 100 });
          if (keyResult3) keyResultsArray.push({ description: keyResult3, percentage: 100 });

          if (keyResultsArray.length === 0) {
            keyResultsArray.push({ description: 'Key Result 1', percentage: 100 });
          }

          const perKr = Math.floor(100 / keyResultsArray.length);
          keyResultsArray.forEach((kr, idx) => {
            kr.percentage = idx === keyResultsArray.length - 1 ? 100 - perKr * (keyResultsArray.length - 1) : perKr;
          });

          const okr = await storage.createOkr({
            staffId: staffRecord.id,
            spuId: primarySpu.id,
            subUnitId: subUnit?.id || null,
            okrNumber,
            quarter,
            year,
            collaborationSpuId: collabSpu?.id || null,
            universityObjective: universityObjective || '',
            universityKeyResult: universityKeyResult || '',
            objectiveStatement: objectiveStatement || `Imported OKR`,
            keyResults: JSON.stringify(keyResultsArray),
          });
          results.okrsCreated++;

        } catch (rowError: any) {
          results.errors.push(`Row ${row.rowIndex}: ${rowError.message}`);
        }
      }

      const errorCount = results.errors.length;
      let message = `Import completed: ${results.okrsCreated} OKRs created, ${results.staffCreated} new staff, ${results.spusCreated} new SPUs, ${results.subUnitsCreated} new sub-units.`;
      if (results.rowsSkipped > 0) message += ` ${results.rowsSkipped} rows skipped.`;
      if (errorCount > 0) message += ` ${errorCount} error(s).`;

      res.json({ success: true, results, message });

    } catch (error: any) {
      console.error("CSV import error:", error);
      res.status(500).json({ error: "Failed to import CSV", details: error.message });
    }
  });

  // Score Import Preview endpoint - parses score CSV and matches to existing OKRs
  app.post("/api/import/scores/preview", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== 'string') {
        return res.status(400).json({ error: "CSV data is required" });
      }

      const rows = parseCSV(csvData);
      if (rows.length < 2) {
        return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const getColIndex = (patterns: string[]): number => {
        for (const pattern of patterns) {
          const idx = headers.findIndex(h => h.toLowerCase().includes(pattern.toLowerCase()));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const colTimestamp = getColIndex(['Timestamp']);
      const colName = getColIndex(['Your Name', 'Name']);
      const colQuarterYear = getColIndex(['year and quarter', 'quarter you will score']);
      const colSpu = getColIndex(['parent SPU', 'SPU']);
      const colSubUnit = getColIndex(['sub-unit', 'sub unit', 'division']);
      const colCollabSpu = getColIndex(['collaborated', 'collaboration']);
      const colKeyResultLetters = getColIndex(['Key Result letters']);
      const colOkrNumber = getColIndex(['numbered OKR', 'OKR are you scoring']);
      const colKR1 = getColIndex(['Key Result 1']);
      const colKR2 = getColIndex(['Key Result 2']);
      const colKR3 = getColIndex(['Key Result 3']);
      const colKR4 = getColIndex(['Key Result 4']);
      const colOverflowKR = getColIndex(['more than 4 Key Results']);
      const colAverage = getColIndex(['Average score']);
      const colNotes = getColIndex(['summarize', 'outcomes']);

      const missingColumns: string[] = [];
      if (colName === -1) missingColumns.push('Your Name');
      if (colQuarterYear === -1) missingColumns.push('Quarter/Year');
      if (colSpu === -1) missingColumns.push('Parent SPU');
      if (colOkrNumber === -1) missingColumns.push('OKR Number');

      if (missingColumns.length > 0) {
        return res.status(400).json({
          error: "Missing required columns",
          missingColumns,
          detectedHeaders: headers,
          message: `CSV is missing required columns: ${missingColumns.join(', ')}.`
        });
      }

      const allOkrs = await storage.getAllOkrs();
      const allSpus = await storage.getAllSpus();
      const allSubUnits = await storage.getAllSubUnits();

      const spuNameMap = new Map<string, string>();
      for (const spu of allSpus) {
        spuNameMap.set(spu.name.toLowerCase().trim(), spu.id);
      }

      const subUnitMap = new Map<string, { id: string; spuId: string }>();
      for (const su of allSubUnits) {
        subUnitMap.set(`${su.spuId}:${su.name.toLowerCase().trim()}`, { id: su.id, spuId: su.spuId });
      }

      const fuzzyMatchSpu = (csvName: string): string | null => {
        const lower = csvName.toLowerCase().trim();
        if (spuNameMap.has(lower)) return spuNameMap.get(lower)!;
        const spuEntries = Array.from(spuNameMap.entries());
        for (const [name, id] of spuEntries) {
          if (name.includes(lower) || lower.includes(name)) return id;
        }
        const csvWords = lower.split(/[\s,]+/).filter(w => w.length > 2);
        for (const [name, id] of spuEntries) {
          const matchCount = csvWords.filter(w => name.includes(w)).length;
          if (matchCount >= Math.max(1, csvWords.length * 0.5)) return id;
        }
        return null;
      };

      const fuzzyMatchSubUnit = (csvName: string, spuId: string): string | null => {
        const lower = csvName.toLowerCase().trim();
        const key = `${spuId}:${lower}`;
        if (subUnitMap.has(key)) return subUnitMap.get(key)!.id;
        const subEntries = Array.from(subUnitMap.entries());
        for (const [mapKey, val] of subEntries) {
          if (!mapKey.startsWith(`${spuId}:`)) continue;
          const name = mapKey.split(':')[1];
          if (name.includes(lower) || lower.includes(name)) return val.id;
        }
        return null;
      };

      const parseOverflowKR = (text: string): Array<{ krNumber: number; score: number }> => {
        if (!text || !text.trim()) return [];
        const results: Array<{ krNumber: number; score: number }> = [];
        const patterns = text.match(/KR\s*(\d+)\s*[:\-=]\s*(\d+)/gi);
        if (patterns) {
          for (const match of patterns) {
            const parts = match.match(/KR\s*(\d+)\s*[:\-=]\s*(\d+)/i);
            if (parts) {
              results.push({ krNumber: parseInt(parts[1]), score: Math.min(100, Math.max(0, parseInt(parts[2]))) });
            }
          }
        }
        return results;
      };

      const parseAverageScore = (text: string): number | null => {
        if (!text || !text.trim()) return null;
        const cleaned = text.replace('%', '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : Math.round(num);
      };

      const previewRows: any[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const scorerName = (row[colName] || '').trim();
        const quarterYearText = (row[colQuarterYear] || '').trim();
        const okrNumberText = (row[colOkrNumber] || '').trim();
        const spuText = (row[colSpu] || '').trim();
        const subUnitText = colSubUnit !== -1 ? (row[colSubUnit] || '').trim() : '';
        const timestampText = colTimestamp !== -1 ? (row[colTimestamp] || '').trim() : '';
        const keyResultLetters = colKeyResultLetters !== -1 ? (row[colKeyResultLetters] || '').trim() : '';
        const kr1Score = colKR1 !== -1 ? (row[colKR1] || '').trim() : '';
        const kr2Score = colKR2 !== -1 ? (row[colKR2] || '').trim() : '';
        const kr3Score = colKR3 !== -1 ? (row[colKR3] || '').trim() : '';
        const kr4Score = colKR4 !== -1 ? (row[colKR4] || '').trim() : '';
        const overflowKRText = colOverflowKR !== -1 ? (row[colOverflowKR] || '').trim() : '';
        const averageText = colAverage !== -1 ? (row[colAverage] || '').trim() : '';
        const notesText = colNotes !== -1 ? (row[colNotes] || '').trim() : '';

        if (!scorerName && !spuText && !okrNumberText) continue;

        const { quarter, year } = parseQuarterYear(quarterYearText);
        const okrNumber = mapOkrNumber(okrNumberText);

        const spuNames = spuText.split(',').map((s: string) => s.trim()).filter(Boolean);
        const primarySpuName = spuNames[0] || spuText;
        const matchedSpuId = fuzzyMatchSpu(primarySpuName);
        const cleanSubUnit = subUnitText.toLowerCase() === 'n/a' ? '' : subUnitText;
        const matchedSubUnitId = cleanSubUnit && matchedSpuId ? fuzzyMatchSubUnit(cleanSubUnit, matchedSpuId) : null;

        const krScores: Array<{ krNumber: number; score: number }> = [];
        if (kr1Score && !isNaN(parseInt(kr1Score))) krScores.push({ krNumber: 1, score: Math.min(100, Math.max(0, parseInt(kr1Score))) });
        if (kr2Score && !isNaN(parseInt(kr2Score))) krScores.push({ krNumber: 2, score: Math.min(100, Math.max(0, parseInt(kr2Score))) });
        if (kr3Score && !isNaN(parseInt(kr3Score))) krScores.push({ krNumber: 3, score: Math.min(100, Math.max(0, parseInt(kr3Score))) });
        if (kr4Score && !isNaN(parseInt(kr4Score))) krScores.push({ krNumber: 4, score: Math.min(100, Math.max(0, parseInt(kr4Score))) });
        const overflowScores = parseOverflowKR(overflowKRText);
        krScores.push(...overflowScores);

        const averageScore = parseAverageScore(averageText);
        const computedAverage = krScores.length > 0
          ? Math.round(krScores.reduce((sum, kr) => sum + kr.score, 0) / krScores.length)
          : averageScore;

        let matchedOkrId: string | null = null;
        let matchedOkrInfo: string = '';
        const rowErrors: string[] = [];
        const rowWarnings: string[] = [];

        if (!matchedSpuId) {
          rowErrors.push(`SPU not found: "${primarySpuName}"`);
        } else {
          const candidates = allOkrs.filter(o =>
            o.spuId === matchedSpuId &&
            o.quarter === quarter &&
            o.year === year &&
            o.okrNumber === okrNumber
          );

          if (matchedSubUnitId) {
            const subMatches = candidates.filter(o => o.subUnitId === matchedSubUnitId);
            if (subMatches.length === 1) {
              matchedOkrId = subMatches[0].id;
              matchedOkrInfo = `Matched by SPU + Sub-unit + Quarter + OKR#`;
            } else if (subMatches.length > 1) {
              matchedOkrId = subMatches[0].id;
              matchedOkrInfo = `Multiple matches (${subMatches.length}), using first`;
              rowWarnings.push(`Multiple OKR matches found`);
            }
          }

          if (!matchedOkrId) {
            if (candidates.length === 1) {
              matchedOkrId = candidates[0].id;
              matchedOkrInfo = `Matched by SPU + Quarter + OKR#`;
            } else if (candidates.length > 1) {
              matchedOkrId = candidates[0].id;
              matchedOkrInfo = `Multiple matches (${candidates.length}), using first`;
              rowWarnings.push(`Multiple OKR matches found`);
            } else {
              rowErrors.push(`No matching OKR found for ${okrNumber} in ${quarter} ${year}`);
            }
          }
        }

        if (!scorerName) rowErrors.push('Missing scorer name');
        if (krScores.length === 0 && averageScore === null) rowErrors.push('No scores found');

        previewRows.push({
          rowIndex: i + 2,
          scorerName,
          timestamp: timestampText,
          quarter,
          year,
          okrNumber,
          spuName: spuText,
          subUnitName: cleanSubUnit,
          keyResultLetters,
          krScores,
          overflowKRText,
          averageScore: computedAverage ?? averageScore,
          notes: notesText,
          matchedOkrId,
          matchedOkrInfo,
          errors: rowErrors,
          warnings: rowWarnings,
          include: rowErrors.length === 0 && matchedOkrId !== null,
        });
      }

      res.json({
        success: true,
        totalRows: dataRows.length,
        parsedRows: previewRows.length,
        skippedEmpty: dataRows.length - previewRows.length,
        matchedRows: previewRows.filter(r => r.matchedOkrId !== null).length,
        unmatchedRows: previewRows.filter(r => r.matchedOkrId === null).length,
        detectedHeaders: headers,
        rows: previewRows,
      });

    } catch (error: any) {
      console.error("Score import preview error:", error);
      res.status(500).json({ error: "Failed to parse score CSV", details: error.message });
    }
  });

  // Score Import confirm endpoint - creates quarterly updates for matched OKRs
  app.post("/api/import/scores/confirm", requireAdmin, async (req, res) => {
    try {
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "No rows to import" });
      }

      const allStaff = await storage.getAllStaff();
      const staffByName = new Map<string, any>();
      for (const s of allStaff) {
        staffByName.set(s.name.toLowerCase().trim(), s);
      }

      const fuzzyMatchStaff = (name: string): any | null => {
        const lower = name.toLowerCase().trim();
        if (staffByName.has(lower)) return staffByName.get(lower);
        const staffEntries = Array.from(staffByName.entries());
        for (const [staffName, staffObj] of staffEntries) {
          if (staffName.includes(lower) || lower.includes(staffName)) return staffObj;
        }
        const nameParts = lower.split(/\s+/);
        if (nameParts.length >= 2) {
          for (const [staffName, staffObj] of staffEntries) {
            const staffParts = staffName.split(/\s+/);
            if (staffParts.length >= 2 && nameParts[nameParts.length - 1] === staffParts[staffParts.length - 1] && nameParts[0] === staffParts[0]) {
              return staffObj;
            }
          }
        }
        return null;
      };

      const results = {
        scoresCreated: 0,
        rowsSkipped: 0,
        errors: [] as string[],
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (!row.include || !row.matchedOkrId) {
            results.rowsSkipped++;
            continue;
          }

          const matchedStaff = fuzzyMatchStaff(row.scorerName);
          const keyResultScoresJson = row.krScores && row.krScores.length > 0
            ? JSON.stringify(row.krScores.map((kr: any) => ({
                keyResultNumber: kr.krNumber,
                description: `Key Result ${kr.krNumber}`,
                score: kr.score,
              })))
            : null;

          await storage.createQuarterlyUpdate({
            okrId: row.matchedOkrId,
            staffId: matchedStaff?.id || null,
            scorerName: row.scorerName,
            quarter: row.quarter,
            year: row.year,
            progress: row.averageScore ?? 0,
            keyResultScores: keyResultScoresJson,
            averageScore: row.averageScore ?? 0,
            additionalKeyResults: row.overflowKRText || null,
            notes: row.notes || '',
          });
          results.scoresCreated++;

        } catch (rowError: any) {
          results.errors.push(`Row ${row.rowIndex}: ${rowError.message}`);
        }
      }

      const errorCount = results.errors.length;
      let message = `Score import completed: ${results.scoresCreated} quarterly updates created.`;
      if (results.rowsSkipped > 0) message += ` ${results.rowsSkipped} rows skipped.`;
      if (errorCount > 0) message += ` ${errorCount} error(s).`;

      res.json({ success: true, results, message });

    } catch (error: any) {
      console.error("Score import error:", error);
      res.status(500).json({ error: "Failed to import scores", details: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
