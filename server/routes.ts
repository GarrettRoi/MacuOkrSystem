import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertStaffSchema,
  insertSpuSchema,
  insertSubUnitSchema,
  insertOkrSchema,
  insertQuarterlyUpdateSchema,
} from "@shared/schema";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
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
        if (staff && staff.department) {
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
      
      if (!staff.department) {
        return res.status(400).json({ error: "Staff member has invalid department data" });
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

  app.post("/api/okrs", async (req, res) => {
    try {
      const parsed = insertOkrSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const okr = await storage.createOkr(parsed.data);
      res.status(201).json(okr);
    } catch (error) {
      res.status(500).json({ error: "Failed to create OKR" });
    }
  });

  app.delete("/api/okrs/:id", async (req, res) => {
    try {
      await storage.deleteOkr(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete OKR" });
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
      
      const update = await storage.createQuarterlyUpdate(parsed.data);
      res.status(201).json(update);
    } catch (error) {
      res.status(500).json({ error: "Failed to create quarterly update" });
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
        "Primary SPU",
        "Sub-Unit",
        "OKR Title",
        "Description",
        "Quarter",
        "Year",
        "Target %",
        "Current %",
        "Status",
        "Created Date",
        "Latest Update Notes",
        "Latest Update Date",
      ].join(","));
      
      for (const okr of okrs) {
        const okrUpdates = updates.filter((u) => u.okrId === okr.id);
        const latestUpdate = okrUpdates.sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        )[0];
        
        const row = [
          `"${okr.staff.name}"`,
          `"${okr.staff.email}"`,
          `"${okr.staff.spu.name}"`,
          `"${okr.staff.subUnit?.name || "N/A"}"`,
          `"${okr.title.replace(/"/g, '""')}"`,
          `"${okr.description.replace(/"/g, '""')}"`,
          okr.quarter,
          okr.year,
          okr.targetValue,
          okr.currentValue,
          okr.status,
          new Date(okr.createdAt).toISOString().split("T")[0],
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

  const httpServer = createServer(app);
  return httpServer;
}
