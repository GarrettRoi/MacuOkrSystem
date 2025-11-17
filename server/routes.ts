import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertStaffSchema,
  insertDepartmentSchema,
  insertSubDepartmentSchema,
  insertOkrSchema,
  insertQuarterlyUpdateSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { password } = req.body;
      const isValid = await storage.verifyPassword(password);
      
      if (isValid) {
        res.json({ success: true });
      } else {
        res.status(401).json({ error: "Invalid password" });
      }
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

  app.post("/api/staff", async (req, res) => {
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

  app.delete("/api/staff/:id", async (req, res) => {
    try {
      await storage.deleteStaff(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff" });
    }
  });

  app.get("/api/departments", async (_req, res) => {
    try {
      const departments = await storage.getAllDepartments();
      res.json(departments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const parsed = insertDepartmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const department = await storage.createDepartment(parsed.data);
      res.status(201).json(department);
    } catch (error) {
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.delete("/api/departments/:id", async (req, res) => {
    try {
      await storage.deleteDepartment(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  app.get("/api/sub-departments", async (_req, res) => {
    try {
      const subDepartments = await storage.getAllSubDepartments();
      res.json(subDepartments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sub-departments" });
    }
  });

  app.post("/api/sub-departments", async (req, res) => {
    try {
      const parsed = insertSubDepartmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error });
      }
      
      const subDepartment = await storage.createSubDepartment(parsed.data);
      res.status(201).json(subDepartment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create sub-department" });
    }
  });

  app.delete("/api/sub-departments/:id", async (req, res) => {
    try {
      await storage.deleteSubDepartment(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sub-department" });
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
        "Department",
        "Sub-Department",
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
          `"${okr.staff.department.name}"`,
          `"${okr.staff.subDepartment?.name || "N/A"}"`,
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
