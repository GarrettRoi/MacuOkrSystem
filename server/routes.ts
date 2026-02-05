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
      const basicUsers = await storage.getBasicUsersForLeader(req.params.staffId);
      res.json(basicUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch basic users" });
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
      
      // Auto-generate OKR number based on existing count for this SPU
      const existingCount = await storage.countOkrsBySpu(parsed.data.spuId);
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
      // Check if OKR exists
      const existingOkr = await storage.getOkr(req.params.id);
      if (!existingOkr) {
        return res.status(404).json({ error: "OKR not found" });
      }
      
      // Validate using dedicated update schema (already allows partial updates)
      const parsed = updateOkrSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      // Filter out undefined values to prevent overwriting existing data
      const updates: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          updates[key] = value;
        }
      }
      
      // Reject empty updates
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      console.log("PUT /api/okrs/:id - Updates:", updates);
      const updatedOkr = await storage.updateOkr(req.params.id, updates);
      res.json(updatedOkr);
    } catch (error) {
      console.error("PUT /api/okrs/:id - Error:", error);
      res.status(500).json({ error: "Failed to update OKR", details: error instanceof Error ? error.message : String(error) });
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
      // Check if update exists
      const existingUpdate = await storage.getQuarterlyUpdate(req.params.id);
      if (!existingUpdate) {
        return res.status(404).json({ error: "Quarterly update not found" });
      }
      
      // Validate using dedicated update schema
      const parsed = updateQuarterlyUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      // Filter out undefined values to prevent overwriting existing data
      const updates: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          updates[key] = value;
        }
      }
      
      // Auto-calculate averageScore from keyResultScores if provided
      if (updates.keyResultScores && typeof updates.keyResultScores === 'string') {
        try {
          const scores = JSON.parse(updates.keyResultScores);
          if (Array.isArray(scores) && scores.length > 0) {
            // Validate each score object has required fields
            const validScores = scores.every(
              (kr) => typeof kr.score === 'number' && kr.score >= 0 && kr.score <= 100
            );
            if (!validScores) {
              return res.status(400).json({ error: "Invalid key result scores: each score must be 0-100" });
            }
            // Calculate average
            const total = scores.reduce((sum: number, kr: any) => sum + kr.score, 0);
            updates.averageScore = Math.round(total / scores.length);
          }
        } catch (e) {
          console.error("Failed to parse or calculate average score:", e);
          return res.status(400).json({ error: "Invalid keyResultScores format" });
        }
      }
      
      // Reject empty updates
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const updatedUpdate = await storage.updateQuarterlyUpdate(req.params.id, updates);
      res.json(updatedUpdate);
    } catch (error) {
      res.status(500).json({ error: "Failed to update quarterly update" });
    }
  });

  app.get("/api/export/csv", async (req, res) => {
    try {
      const { quarter, year } = req.query;
      let okrs = await storage.getAllOkrsWithDetails();
      
      if (quarter && quarter !== "All") {
        okrs = okrs.filter((okr) => okr.quarter === quarter);
      }
      
      if (year && year !== "All") {
        okrs = okrs.filter((okr) => String(okr.year) === year);
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
          `"${okr.universityObjective.replace(/"/g, '""')}"`,
          `"${okr.universityKeyResult.replace(/"/g, '""')}"`,
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

  // CSV Import endpoint
  app.post("/api/import/csv", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== 'string') {
        return res.status(400).json({ error: "CSV data is required" });
      }

      // Parse CSV - handle multiline fields properly
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
        
        // Push last field and row
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField);
          rows.push(currentRow);
        }

        return rows;
      };

      const rows = parseCSV(csvData);
      if (rows.length < 2) {
        return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      // Map columns by header name with fallback patterns
      const getColIndex = (patterns: string[]): number => {
        for (const pattern of patterns) {
          const idx = headers.findIndex(h => h.toLowerCase().includes(pattern.toLowerCase()));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const colName = getColIndex(['Your Name', 'Name']);
      const colQuarterYear = getColIndex(['year and quarter', 'quarter', 'period']);
      const colSpu = getColIndex(['parent SPU', 'SPU', 'Department', 'School']);
      const colSubUnit = getColIndex(['sub-unit', 'sub unit', 'division']);
      const colCollabSpu = getColIndex(['collaborated', 'collaboration']);
      const colKeyResultLetters = getColIndex(['Key Result letters', 'Key Result letter', 'KR letter']);
      const colOkrNumber = getColIndex(['numbered OKR', 'OKR number', 'Which OKR']);
      const colKR1 = getColIndex(['Key Result 1', 'KR1', 'KR 1']);
      const colKR2 = getColIndex(['Key Result 2', 'KR2', 'KR 2']);
      const colKR3 = getColIndex(['Key Result 3', 'KR3', 'KR 3']);
      const colKR4 = getColIndex(['Key Result 4', 'KR4', 'KR 4']);
      const colAdditionalKRs = getColIndex(['more than 4', 'additional', 'extra KR']);
      const colAvgScore = getColIndex(['Average score', 'Average', 'Score']);
      const colNotes = getColIndex(['summarize', 'outcomes', 'notes', 'summary']);

      // Validate required columns
      const missingColumns: string[] = [];
      if (colName === -1) missingColumns.push('Name (Your Name)');
      if (colQuarterYear === -1) missingColumns.push('Quarter/Year');
      if (colSpu === -1) missingColumns.push('SPU/Department');
      if (colOkrNumber === -1) missingColumns.push('OKR Number');

      if (missingColumns.length > 0) {
        return res.status(400).json({ 
          error: "Missing required columns", 
          missingColumns,
          message: `CSV is missing required columns: ${missingColumns.join(', ')}. Please ensure your CSV has columns for staff name, quarter/year, SPU, and OKR number.`
        });
      }

      const results = {
        spusCreated: 0,
        subUnitsCreated: 0,
        staffCreated: 0,
        yearsCreated: 0,
        okrsCreated: 0,
        updatesCreated: 0,
        rowsSkipped: 0,
        warnings: [] as string[],
        errors: [] as string[],
      };

      // Cache for created/found entities
      const spuCache = new Map<string, any>();
      const subUnitCache = new Map<string, any>();
      const staffCache = new Map<string, any>();
      const yearCache = new Map<number, any>();

      // Map OKR number text to format
      const mapOkrNumber = (text: string, rowNum: number): { okrNumber: string; warning?: string } => {
        const normalized = text.trim().toUpperCase();
        if (normalized.includes('1ST') || normalized === '1') return { okrNumber: 'OKR 1' };
        if (normalized.includes('2ND') || normalized === '2') return { okrNumber: 'OKR 2' };
        if (normalized.includes('3RD') || normalized === '3') return { okrNumber: 'OKR 3' };
        if (normalized.includes('4TH') || normalized === '4') return { okrNumber: 'OKR 4' };
        if (normalized.includes('5TH') || normalized === '5') return { okrNumber: 'OKR 5' };
        if (normalized.includes('6TH') || normalized === '6') {
          return { okrNumber: 'OKR 5', warning: `Row ${rowNum}: OKR number "6TH" mapped to "OKR 5" (max is 5)` };
        }
        // Try to extract number directly
        const numMatch = normalized.match(/(\d+)/);
        if (numMatch) {
          const num = parseInt(numMatch[1]);
          if (num >= 1 && num <= 5) return { okrNumber: `OKR ${num}` };
          if (num > 5) return { okrNumber: 'OKR 5', warning: `Row ${rowNum}: OKR number "${num}" mapped to "OKR 5" (max is 5)` };
        }
        return { okrNumber: 'OKR 1', warning: `Row ${rowNum}: Unrecognized OKR number "${text}" defaulted to "OKR 1"` };
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

      // Map key result letter to university objective and key result
      const mapKeyResultLetter = (letters: string): { objective: string; keyResult: string } => {
        const firstLetter = letters.split(',')[0].trim();
        const objNum = parseInt(firstLetter.charAt(0)) || 1;
        const krLetter = firstLetter.charAt(2)?.toUpperCase() || 'A';
        
        const objectives = [
          "Objective 1: We will humbly CREATE transformative opportunities for the holistic growth of students, faculty, staff, alums, and our community from a Christ-centered, biblical worldview and Wesleyan perspective.",
          "Objective 2: We will joyfully COLLABORATE to align our organizational structures, facilities, and resources effectively and efficiently to achieve sustainability and future expansion.",
          "Objective 3: We will boldly INNOVATE to provide relevant, attainable, dynamic opportunities for learning and growth.",
        ];
        
        const keyResults: Record<string, string> = {
          '1.A': "KR 1.A : Wisdom. Identify and develop metrics for measuring wisdom and increase the associated results for each stakeholder group within defined periods.",
          '1.B': "KR 1.B : Stature. Ensure a minimum of 20 annual wellness programs, diversifying department engagement in creating mental and physical health initiatives serving all stakeholders to at least 30% in 2025, 50% in 2026, and 80% by May 31 2027.",
          '1.C': "KR 1.C : Favor with God. Increase spiritual formation metrics by 2% annually.",
          '1.D': "KR 1.D : Favor with man. Double the number of interpersonal training opportunities in 3 years.",
          '2.A': "KR 2.A: Stewardship of resources: Implement a resource utilization audit with at least 75% of identified opportunities acted upon.",
          '2.B': "KR 2.B: Technology. Replace 50% of manual processes with technology.",
          '2.C': "KR 2.C: Processes and procedures. Evaluate and refine 100% of current processes and procedures for optimization and efficiency.",
          '2.D': "KR 2.D: People and departments. Increase student and employee satisfaction scores by 2% annually.",
          '3.A': "KR 3.A: Strategic Partnerships. Establish 1-2 partnerships per SPU per year.",
          '3.B': "KR 3.B: Relevant program offerings. Create 9-12 new academic, co-curricular, or administrative program offerings.",
          '3.C': "KR 3:C: Engage with cutting edge technology. Incorporate technology into academic, co-curricular, and administrative programs.",
          '3.D': "KR 3.D: New and expanded financial resources. Increase alternative revenue funding for learning and growth by 10% annually.",
        };

        const krKey = `${objNum}.${krLetter}`;
        
        return {
          objective: objectives[Math.min(objNum - 1, 2)] || objectives[0],
          keyResult: keyResults[krKey] || keyResults['1.A'],
        };
      };

      // Process each row
      for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
        const row = dataRows[rowIdx];
        try {
          const staffName = (row[colName] || '').trim();
          const quarterYearText = row[colQuarterYear] || '';
          const spuNames = (row[colSpu] || '').split(',').map(s => s.trim()).filter(Boolean);
          const subUnitName = (row[colSubUnit] || '').trim();
          const collabSpuName = (row[colCollabSpu] || '').trim();
          const keyResultLetters = (row[colKeyResultLetters] || '').trim();
          const okrNumberText = (row[colOkrNumber] || '').trim();
          const kr1Score = parseFloat(row[colKR1]) || 0;
          const kr2Score = parseFloat(row[colKR2]) || 0;
          const kr3Score = parseFloat(row[colKR3]) || 0;
          const kr4Score = parseFloat(row[colKR4]) || 0;
          const additionalKRs = (row[colAdditionalKRs] || '').trim();
          const avgScoreText = (row[colAvgScore] || '').replace('%', '').trim();
          const notes = (row[colNotes] || '').trim();

          if (!staffName || !spuNames.length || !okrNumberText) {
            results.rowsSkipped++;
            continue; // Skip incomplete rows
          }

          const { quarter, year } = parseQuarterYear(quarterYearText);
          const { okrNumber, warning: okrWarning } = mapOkrNumber(okrNumberText, rowIdx + 2);
          if (okrWarning) {
            results.warnings.push(okrWarning);
          }
          const primarySpuName = spuNames[0];

          // Find or create year
          if (!yearCache.has(year)) {
            const yearRecord = await storage.findOrCreateYear(year);
            yearCache.set(year, yearRecord);
            if (!await storage.getYearByValue(year)) results.yearsCreated++;
          }

          // Find or create primary SPU
          let primarySpu;
          if (spuCache.has(primarySpuName.toLowerCase())) {
            primarySpu = spuCache.get(primarySpuName.toLowerCase());
          } else {
            const existingBefore = await storage.getSpuByName(primarySpuName);
            primarySpu = await storage.findOrCreateSpu(primarySpuName);
            spuCache.set(primarySpuName.toLowerCase(), primarySpu);
            if (!existingBefore) results.spusCreated++;
          }

          // Find or create sub-unit if provided
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

          // Find or create collaboration SPU
          let collabSpu = null;
          if (collabSpuName) {
            if (spuCache.has(collabSpuName.toLowerCase())) {
              collabSpu = spuCache.get(collabSpuName.toLowerCase());
            } else {
              const existingBefore = await storage.getSpuByName(collabSpuName);
              collabSpu = await storage.findOrCreateSpu(collabSpuName);
              spuCache.set(collabSpuName.toLowerCase(), collabSpu);
              if (!existingBefore) results.spusCreated++;
            }
          }

          // Find or create staff
          let staffRecord;
          if (staffCache.has(staffName.toLowerCase())) {
            staffRecord = staffCache.get(staffName.toLowerCase());
          } else {
            const existingBefore = await storage.getStaffByName(staffName);
            staffRecord = await storage.findOrCreateStaff(staffName, primarySpu.id, subUnit?.id);
            staffCache.set(staffName.toLowerCase(), staffRecord);
            if (!existingBefore) results.staffCreated++;
          }

          // Get university objective and key result from letter code
          const { objective, keyResult } = mapKeyResultLetter(keyResultLetters);

          // Build key results array from scores
          const keyResultsArray: { description: string; percentage: number }[] = [];
          const scores = [kr1Score, kr2Score, kr3Score, kr4Score].filter(s => s > 0 || row[colKR1 + keyResultsArray.length]);
          
          // Create key results based on provided scores
          if (kr1Score !== undefined && row[colKR1] !== undefined && row[colKR1] !== '') {
            keyResultsArray.push({ description: "Key Result 1", percentage: 25 });
          }
          if (kr2Score !== undefined && row[colKR2] !== undefined && row[colKR2] !== '') {
            keyResultsArray.push({ description: "Key Result 2", percentage: 25 });
          }
          if (kr3Score !== undefined && row[colKR3] !== undefined && row[colKR3] !== '') {
            keyResultsArray.push({ description: "Key Result 3", percentage: 25 });
          }
          if (kr4Score !== undefined && row[colKR4] !== undefined && row[colKR4] !== '') {
            keyResultsArray.push({ description: "Key Result 4", percentage: 25 });
          }

          // If no key results parsed, create at least one
          if (keyResultsArray.length === 0) {
            keyResultsArray.push({ description: "Key Result 1", percentage: 100 });
          }

          // Normalize percentages to sum to 100
          const totalPercentage = keyResultsArray.reduce((sum, kr) => sum + kr.percentage, 0);
          if (totalPercentage !== 100) {
            keyResultsArray.forEach(kr => {
              kr.percentage = Math.round((kr.percentage / totalPercentage) * 100);
            });
            // Adjust last to ensure exactly 100
            const newTotal = keyResultsArray.reduce((sum, kr) => sum + kr.percentage, 0);
            if (newTotal !== 100 && keyResultsArray.length > 0) {
              keyResultsArray[keyResultsArray.length - 1].percentage += 100 - newTotal;
            }
          }

          // Create OKR
          const okr = await storage.createOkr({
            staffId: staffRecord.id,
            spuId: primarySpu.id,
            subUnitId: subUnit?.id || null,
            okrNumber,
            quarter,
            year,
            collaborationSpuId: collabSpu?.id || null,
            universityObjective: objective,
            universityKeyResult: keyResult,
            objectiveStatement: notes.substring(0, 500) || `Imported OKR for ${keyResultLetters}`,
            keyResults: JSON.stringify(keyResultsArray),
          });
          results.okrsCreated++;

          // Create quarterly update with scores
          const keyResultScores = [];
          if (kr1Score !== undefined && (kr1Score > 0 || row[colKR1] !== '')) {
            keyResultScores.push({ keyResultNumber: 1, description: "Key Result 1", score: kr1Score || 0 });
          }
          if (kr2Score !== undefined && (kr2Score > 0 || row[colKR2] !== '')) {
            keyResultScores.push({ keyResultNumber: 2, description: "Key Result 2", score: kr2Score || 0 });
          }
          if (kr3Score !== undefined && (kr3Score > 0 || row[colKR3] !== '')) {
            keyResultScores.push({ keyResultNumber: 3, description: "Key Result 3", score: kr3Score || 0 });
          }
          if (kr4Score !== undefined && (kr4Score > 0 || row[colKR4] !== '')) {
            keyResultScores.push({ keyResultNumber: 4, description: "Key Result 4", score: kr4Score || 0 });
          }

          if (keyResultScores.length === 0) {
            keyResultScores.push({ keyResultNumber: 1, description: "Key Result 1", score: parseFloat(avgScoreText) || 0 });
          }

          const avgScore = keyResultScores.length > 0 
            ? Math.round(keyResultScores.reduce((sum, kr) => sum + kr.score, 0) / keyResultScores.length)
            : parseFloat(avgScoreText) || 0;

          await storage.createQuarterlyUpdate({
            okrId: okr.id,
            staffId: staffRecord.id,
            quarter,
            year,
            progress: avgScore,
            keyResultScores: JSON.stringify(keyResultScores),
            averageScore: avgScore,
            additionalKeyResults: additionalKRs || null,
            notes: notes || 'Imported from CSV',
          });
          results.updatesCreated++;

        } catch (rowError: any) {
          results.errors.push(`Row ${rowIdx + 2}: ${rowError.message}`);
        }
      }

      const warningCount = results.warnings.length;
      const errorCount = results.errors.length;
      let message = `Import completed: ${results.okrsCreated} OKRs, ${results.updatesCreated} updates, ${results.staffCreated} staff, ${results.spusCreated} SPUs, ${results.subUnitsCreated} sub-units, ${results.yearsCreated} years created.`;
      if (results.rowsSkipped > 0) message += ` (${results.rowsSkipped} rows skipped)`;
      if (warningCount > 0) message += ` (${warningCount} warnings)`;
      if (errorCount > 0) message += ` (${errorCount} errors)`;
      
      res.json({
        success: true,
        results,
        message,
      });

    } catch (error: any) {
      console.error("CSV import error:", error);
      res.status(500).json({ error: "Failed to import CSV", details: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
