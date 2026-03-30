import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, sql, asc, and as drizzleAnd } from "drizzle-orm";
import * as oidcClient from "openid-client";
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
  spus,
  subUnits,
  staff,
  staffSpuAssignments,
  leaderBasicAssignments,
  okrs,
  okrResponsibilities,
  quarterlyUpdates,
  unmatchedScores,
  editLogs,
  universityObjectives,
  universityKeyResults,
  analyticsDashboards,
  analyticsWidgets,
} from "@shared/schema";
import type { Okr, OkrWithDetails, EmployeeProgressRecord, UserRole, AnalyticsData } from "@shared/schema";
import { parseMultiSelectField, getPlanningYear } from "@shared/schema";
import { z } from "zod";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
}

// Returns true for sub-unit values that mean "whole SPU / no sub-unit" so
// we never create junk sub-unit records from these CSV values.
function isPlaceholderSubUnit(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return (
    lower === '' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === 'none' ||
    lower.includes('not applic') ||
    lower.includes('non-applic') ||
    lower.includes('entire spu') ||
    lower.includes('entire unit') ||
    lower.includes('whole spu') ||
    lower.includes('whole unit') ||
    lower.includes('not applicable')
  );
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
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

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

  // SSO Settings
  app.get("/api/settings/sso", async (_req, res) => {
    try {
      const enabled = await storage.getSetting("sso_enabled");
      const issuer = await storage.getSetting("sso_issuer_url");
      const clientId = await storage.getSetting("sso_client_id");
      const hasClientSecret = !!(await storage.getSetting("sso_client_secret")) || !!process.env.SSO_CLIENT_SECRET;
      res.json({
        enabled: enabled === "true",
        issuerUrl: issuer || process.env.SSO_ISSUER_URL || "",
        clientId: clientId || process.env.SSO_CLIENT_ID || "",
        hasClientSecret,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SSO settings" });
    }
  });

  app.put("/api/settings/sso", async (req, res) => {
    try {
      if (!req.session.selectedStaffId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const staffMember = await storage.getStaff(req.session.selectedStaffId);
      if (!staffMember || staffMember.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can change this setting" });
      }
      const schema = z.object({
        enabled: z.boolean(),
        issuerUrl: z.string().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      await storage.setSetting("sso_enabled", parsed.data.enabled ? "true" : "false");
      if (parsed.data.issuerUrl !== undefined) {
        await storage.setSetting("sso_issuer_url", parsed.data.issuerUrl);
      }
      if (parsed.data.clientId !== undefined) {
        await storage.setSetting("sso_client_id", parsed.data.clientId);
      }
      if (parsed.data.clientSecret !== undefined && parsed.data.clientSecret !== "") {
        await storage.setSetting("sso_client_secret", parsed.data.clientSecret);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update SSO settings" });
    }
  });

  // OIDC SSO Auth Routes
  async function getSsoConfig() {
    const issuerUrl = (await storage.getSetting("sso_issuer_url")) || process.env.SSO_ISSUER_URL || "";
    const clientId = (await storage.getSetting("sso_client_id")) || process.env.SSO_CLIENT_ID || "";
    const clientSecret = (await storage.getSetting("sso_client_secret")) || process.env.SSO_CLIENT_SECRET || "";
    return { issuerUrl, clientId, clientSecret };
  }

  app.get("/api/auth/sso/login", async (req, res) => {
    try {
      const ssoEnabled = await storage.getSetting("sso_enabled");
      if (ssoEnabled !== "true") {
        return res.status(403).json({ error: "SSO is not enabled" });
      }

      const { issuerUrl, clientId, clientSecret } = await getSsoConfig();
      if (!issuerUrl || !clientId) {
        return res.status(500).json({ error: "SSO is not fully configured" });
      }

      const config = await oidcClient.discovery(new URL(issuerUrl), clientId, clientSecret || undefined);
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/sso/callback`;

      const codeVerifier = oidcClient.randomPKCECodeVerifier();
      const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);
      const state = oidcClient.randomPKCECodeVerifier();

      req.session.ssoState = state;
      req.session.ssoCodeVerifier = codeVerifier;

      const authUrl = oidcClient.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: "openid email profile",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
      });

      await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
      res.json({ redirectUrl: authUrl.href });
    } catch (error: any) {
      console.error("SSO login error:", error);
      res.status(500).json({ error: "Failed to initiate SSO login" });
    }
  });

  app.get("/api/auth/sso/callback", async (req, res) => {
    try {
      const { error: oauthError, state } = req.query;

      if (oauthError) {
        return res.redirect(`/?sso_error=${encodeURIComponent(String(oauthError))}`);
      }

      if (state !== req.session.ssoState) {
        return res.redirect("/?sso_error=invalid_state");
      }

      const { issuerUrl, clientId, clientSecret } = await getSsoConfig();
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/sso/callback`;

      const config = await oidcClient.discovery(new URL(issuerUrl), clientId, clientSecret || undefined);

      const callbackUrl = new URL(req.url, `${req.protocol}://${req.get("host")}`);
      const tokenResponse = await oidcClient.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: req.session.ssoCodeVerifier,
        expectedState: req.session.ssoState,
        redirectUri,
      } as any);

      const claims = tokenResponse.claims();
      const email = (claims?.email as string | undefined)?.toLowerCase().trim();

      delete req.session.ssoState;
      delete req.session.ssoCodeVerifier;

      if (!email) {
        return res.redirect("/?sso_error=no_email");
      }

      const staffMember = await storage.getStaffByEmail(email);
      if (!staffMember) {
        return res.redirect(`/?sso_error=no_account&email=${encodeURIComponent(email)}`);
      }

      req.session.regenerate((err) => {
        if (err) return res.redirect("/?sso_error=session_error");
        req.session.isAdmin = staffMember.isAdmin;
        req.session.selectedStaffId = staffMember.id;
        req.session.selectedStaffName = staffMember.name;
        req.session.sessionVersion = Date.now();
        req.session.save((err2) => {
          if (err2) return res.redirect("/?sso_error=session_error");
          res.redirect("/");
        });
      });
    } catch (error: any) {
      console.error("SSO callback error:", error);
      res.redirect(`/?sso_error=callback_failed`);
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

  app.post("/api/university-objectives", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        label: z.string().min(1),
        description: z.string().min(1),
        sortOrder: z.number().int().optional(),
        applicableYears: z.array(z.number().int()).optional(),
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

  app.patch("/api/university-objectives/:id", requireAdmin, async (req, res) => {
    try {
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

  app.delete("/api/university-objectives/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUniversityObjective(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete university objective" });
    }
  });

  app.post("/api/university-key-results", requireAdmin, async (req, res) => {
    try {
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

  app.patch("/api/university-key-results/:id", requireAdmin, async (req, res) => {
    try {
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

  app.delete("/api/university-key-results/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUniversityKeyResult(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete university key result" });
    }
  });

  // Strategic Advancement Progress & Comments
  app.get("/api/strategic-advancement", async (_req, res) => {
    try {
      const data = await storage.getStrategicAdvancementData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch strategic advancement data" });
    }
  });

  app.put("/api/strategic-advancement/progress/:keyResultId", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({ progressPercent: z.number().int().min(0).max(100) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "progressPercent must be 0–100" });
      await storage.setKeyResultProgress(req.params.keyResultId, parsed.data.progressPercent);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  app.put("/api/strategic-advancement/comment/:objectiveId", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({ comment: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid comment" });
      await storage.setObjectiveComment(req.params.objectiveId, parsed.data.comment);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  app.post("/api/strategic-advancement/update-date", requireAdmin, async (req, res) => {
    try {
      const now = new Date().toISOString();
      await storage.setSetting("strategic_advancement_updated_at", now);
      res.json({ success: true, updatedAt: now });
    } catch (error) {
      res.status(500).json({ error: "Failed to update date" });
    }
  });

  // ── Analytics ─────────────────────────────────────────────────────────────

  async function computeAnalyticsData(
    source: string,
    filters: { quarter?: string; year?: number; spuId?: string },
  ): Promise<AnalyticsData> {
    const { quarter, year, spuId } = filters;

    const buildOkrWhere = () => {
      const parts: string[] = [];
      if (quarter) parts.push(`o.quarter = '${quarter.replace(/'/g, "''")}'`);
      if (year) parts.push(`o.year = ${year}`);
      if (spuId) parts.push(`o.spu_id = '${spuId.replace(/'/g, "''")}'`);
      return parts.length ? `AND ${parts.join(" AND ")}` : "";
    };

    const buildQuWhere = () => {
      const parts: string[] = [];
      if (quarter) parts.push(`o.quarter = '${quarter.replace(/'/g, "''")}'`);
      if (year) parts.push(`o.year = ${year}`);
      if (spuId) parts.push(`o.spu_id = '${spuId.replace(/'/g, "''")}'`);
      return parts.length ? `AND ${parts.join(" AND ")}` : "";
    };

    const simpleRows = async (rawSql: string) => {
      const result = await db.execute(sql.raw(rawSql));
      return (result as any).rows as { label: string; value: number }[];
    };

    switch (source) {
      case "okr_count_by_spu": {
        const rows = await simpleRows(`
          SELECT s.name AS label, COUNT(o.id)::int AS value
          FROM okrs o JOIN spus s ON o.spu_id = s.id
          WHERE 1=1 ${buildOkrWhere()}
          GROUP BY s.name ORDER BY value DESC`);
        return { type: "series", data: rows };
      }
      case "okr_count_by_quarter": {
        const rows = await simpleRows(`
          SELECT o.quarter AS label, COUNT(*)::int AS value
          FROM okrs o WHERE 1=1 ${buildOkrWhere()}
          GROUP BY o.quarter ORDER BY o.quarter`);
        return { type: "series", data: rows };
      }
      case "okr_count_by_year": {
        const rows = await simpleRows(`
          SELECT o.year::text AS label, COUNT(*)::int AS value
          FROM okrs o WHERE 1=1 ${spuId ? `AND o.spu_id='${spuId.replace(/'/g,"''")}'` : ""}
          GROUP BY o.year ORDER BY o.year`);
        return { type: "series", data: rows };
      }
      case "okr_count_by_status": {
        const rows = await simpleRows(`
          SELECT COALESCE(o.status, 'No Status') AS label, COUNT(*)::int AS value
          FROM okrs o WHERE 1=1 ${buildOkrWhere()}
          GROUP BY o.status ORDER BY value DESC`);
        return { type: "series", data: rows };
      }
      case "avg_score_by_spu": {
        const rows = await simpleRows(`
          SELECT s.name AS label, ROUND(AVG(qu.average_score))::int AS value
          FROM quarterly_updates qu
          JOIN okrs o ON qu.okr_id = o.id
          JOIN spus s ON o.spu_id = s.id
          WHERE qu.average_score IS NOT NULL AND qu.is_primary_score = true ${buildQuWhere()}
          GROUP BY s.name ORDER BY value DESC`);
        return { type: "series", data: rows };
      }
      case "avg_score_by_quarter": {
        const rows = await simpleRows(`
          SELECT qu.quarter AS label, ROUND(AVG(qu.average_score))::int AS value
          FROM quarterly_updates qu
          JOIN okrs o ON qu.okr_id = o.id
          WHERE qu.average_score IS NOT NULL AND qu.is_primary_score = true ${buildQuWhere()}
          GROUP BY qu.quarter ORDER BY qu.quarter`);
        return { type: "series", data: rows };
      }
      case "score_distribution": {
        const rows = await simpleRows(`
          SELECT qu.average_score::text AS label, COUNT(*)::int AS value
          FROM quarterly_updates qu
          JOIN okrs o ON qu.okr_id = o.id
          WHERE qu.average_score IS NOT NULL AND qu.is_primary_score = true ${buildQuWhere()}
          GROUP BY qu.average_score ORDER BY qu.average_score`);
        const labeled = rows.map(r => ({ label: `Score ${r.label}`, value: r.value }));
        return { type: "series", data: labeled };
      }
      case "staff_count_by_spu": {
        const rows = await simpleRows(`
          SELECT s.name AS label, COUNT(st.id)::int AS value
          FROM staff st JOIN spus s ON st.spu_id = s.id
          GROUP BY s.name ORDER BY value DESC`);
        return { type: "series", data: rows };
      }
      case "completion_rate_by_spu": {
        const allOkrs = await db.execute(sql.raw(`
          SELECT o.id, o.spu_id, s.name AS spu_name
          FROM okrs o JOIN spus s ON o.spu_id = s.id
          WHERE 1=1 ${buildOkrWhere()}`));
        const hasUpdate = await db.execute(sql.raw(`
          SELECT DISTINCT qu.okr_id FROM quarterly_updates qu
          JOIN okrs o ON qu.okr_id = o.id
          WHERE qu.is_primary_score = true ${buildQuWhere()}`));
        const updatedIds = new Set((hasUpdate as any).rows.map((r: any) => r.okr_id));
        const spuMap: Record<string, { total: number; complete: number }> = {};
        for (const row of (allOkrs as any).rows as any[]) {
          if (!spuMap[row.spu_name]) spuMap[row.spu_name] = { total: 0, complete: 0 };
          spuMap[row.spu_name].total++;
          if (updatedIds.has(row.id)) spuMap[row.spu_name].complete++;
        }
        const data = Object.entries(spuMap)
          .map(([label, { total, complete }]) => ({ label, value: total > 0 ? Math.round((complete / total) * 100) : 0 }))
          .sort((a, b) => b.value - a.value);
        return { type: "series", data };
      }
      case "okrs_by_university_objective": {
        const okrRows = await db.execute(sql.raw(`
          SELECT o.university_objective FROM okrs o WHERE 1=1 ${buildOkrWhere()}`));
        const objCount: Record<string, number> = {};
        for (const row of (okrRows as any).rows as any[]) {
          if (!row.university_objective) continue;
          try {
            const parsed = JSON.parse(row.university_objective);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              const key = String(item).trim();
              if (key) objCount[key] = (objCount[key] || 0) + 1;
            }
          } catch { /* not JSON */ }
        }
        const data = Object.entries(objCount)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 20);
        return { type: "series", data };
      }
      case "okr_progress_distribution": {
        const rows = await simpleRows(`
          SELECT
            CASE
              WHEN qu.progress <= 25 THEN '0–25%'
              WHEN qu.progress <= 50 THEN '26–50%'
              WHEN qu.progress <= 75 THEN '51–75%'
              ELSE '76–100%'
            END AS label,
            COUNT(*)::int AS value
          FROM quarterly_updates qu
          JOIN okrs o ON qu.okr_id = o.id
          WHERE qu.is_primary_score = true ${buildQuWhere()}
          GROUP BY 1 ORDER BY MIN(qu.progress)`);
        return { type: "series", data: rows };
      }
      case "total_okr_count": {
        const rows = await simpleRows(`SELECT COUNT(*)::int AS value, 'Total OKRs' AS label FROM okrs o WHERE 1=1 ${buildOkrWhere()}`);
        return { type: "metric", data: [], metricValue: rows[0]?.value ?? 0, metricLabel: "Total OKRs" };
      }
      case "total_staff_count": {
        const rows = await simpleRows(`SELECT COUNT(*)::int AS value, 'Total Staff' AS label FROM staff`);
        return { type: "metric", data: [], metricValue: rows[0]?.value ?? 0, metricLabel: "Total Staff" };
      }
      case "avg_overall_score": {
        const rows = await simpleRows(`
          SELECT ROUND(AVG(qu.average_score))::int AS value, 'Avg Score' AS label
          FROM quarterly_updates qu JOIN okrs o ON qu.okr_id = o.id
          WHERE qu.average_score IS NOT NULL AND qu.is_primary_score = true ${buildQuWhere()}`);
        return { type: "metric", data: [], metricValue: rows[0]?.value ?? 0, metricLabel: "Average Score (1–4)" };
      }
      case "total_spu_count": {
        const rows = await simpleRows(`SELECT COUNT(*)::int AS value, 'Total SPUs' AS label FROM spus`);
        return { type: "metric", data: [], metricValue: rows[0]?.value ?? 0, metricLabel: "Total SPUs" };
      }
      default:
        return { type: "series", data: [] };
    }
  }

  app.get("/api/analytics/data", async (req, res) => {
    try {
      const source = String(req.query.source || "");
      const quarter = req.query.quarter ? String(req.query.quarter) : undefined;
      const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
      const spuId = req.query.spuId ? String(req.query.spuId) : undefined;
      if (!source) return res.status(400).json({ error: "source is required" });
      const data = await computeAnalyticsData(source, { quarter, year, spuId });
      res.json(data);
    } catch (error) {
      console.error("Analytics data error:", error);
      res.status(500).json({ error: "Failed to compute analytics data" });
    }
  });

  app.get("/api/analytics/dashboards", async (req, res) => {
    try {
      const session = (req as any).session;
      const isAdminSession = session?.isAdmin === true;
      const dashboards = isAdminSession
        ? await storage.getAllAnalyticsDashboards()
        : await storage.getPublishedAnalyticsDashboards();
      res.json(dashboards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboards" });
    }
  });

  app.post("/api/analytics/dashboards", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().default(""),
        sortOrder: z.number().int().default(0),
        isPublished: z.boolean().default(false),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
      const dashboard = await storage.createAnalyticsDashboard(parsed.data);
      res.status(201).json(dashboard);
    } catch (error) {
      res.status(500).json({ error: "Failed to create dashboard" });
    }
  });

  app.patch("/api/analytics/dashboards/:id", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        sortOrder: z.number().int().optional(),
        isPublished: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
      const dashboard = await storage.updateAnalyticsDashboard(req.params.id, parsed.data);
      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ error: "Failed to update dashboard" });
    }
  });

  app.delete("/api/analytics/dashboards/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAnalyticsDashboard(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete dashboard" });
    }
  });

  app.post("/api/analytics/widgets", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        dashboardId: z.string().min(1),
        title: z.string().min(1),
        chartType: z.string().min(1),
        dataSource: z.string().min(1),
        config: z.string().default("{}"),
        sortOrder: z.number().int().default(0),
        width: z.enum(["full", "half"]).default("full"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
      const widget = await storage.createAnalyticsWidget(parsed.data);
      res.status(201).json(widget);
    } catch (error) {
      res.status(500).json({ error: "Failed to create widget" });
    }
  });

  app.patch("/api/analytics/widgets/:id", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1).optional(),
        chartType: z.string().min(1).optional(),
        dataSource: z.string().min(1).optional(),
        config: z.string().optional(),
        sortOrder: z.number().int().optional(),
        width: z.enum(["full", "half"]).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
      const widget = await storage.updateAnalyticsWidget(req.params.id, parsed.data);
      res.json(widget);
    } catch (error) {
      res.status(500).json({ error: "Failed to update widget" });
    }
  });

  app.delete("/api/analytics/widgets/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAnalyticsWidget(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete widget" });
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

  app.post("/api/spus/merge", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({ sourceId: z.string(), targetId: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Both sourceId and targetId are required" });
      }
      const { sourceId, targetId } = parsed.data;
      if (sourceId === targetId) {
        return res.status(400).json({ error: "Cannot merge an SPU with itself" });
      }
      const source = await storage.getSpu(sourceId);
      const target = await storage.getSpu(targetId);
      if (!source) return res.status(404).json({ error: "Source SPU not found" });
      if (!target) return res.status(404).json({ error: "Target SPU not found" });

      const result = await storage.mergeSpus(sourceId, targetId);
      res.json({
        success: true,
        message: `Merged "${source.name}" into "${target.name}". Moved ${result.staffMoved} staff, ${result.okrsMoved} OKRs, ${result.subUnitsMoved} sub-units, and ${result.assignmentsMoved} assignments.`,
        ...result,
      });
    } catch (error) {
      console.error("Merge SPU error:", error);
      res.status(500).json({ error: "Failed to merge SPUs" });
    }
  });

  app.post("/api/spus/:id/convert-to-subunit", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({ targetSpuId: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "targetSpuId is required" });
      }
      const sourceId = req.params.id;
      const { targetSpuId } = parsed.data;
      if (sourceId === targetSpuId) {
        return res.status(400).json({ error: "Cannot convert an SPU to a sub-unit of itself" });
      }
      const source = await storage.getSpu(sourceId);
      const target = await storage.getSpu(targetSpuId);
      if (!source) return res.status(404).json({ error: "Source SPU not found" });
      if (!target) return res.status(404).json({ error: "Target SPU not found" });

      const result = await storage.convertSpuToSubUnit(sourceId, targetSpuId);
      res.json({
        success: true,
        message: `Converted "${source.name}" to a sub-unit under "${target.name}". Reassigned ${result.staffMoved} staff, ${result.okrsMoved} OKRs, moved ${result.subUnitsMoved} child sub-units.`,
        ...result,
      });
    } catch (error) {
      console.error("Convert SPU to sub-unit error:", error);
      res.status(500).json({ error: "Failed to convert SPU to sub-unit" });
    }
  });

  app.post("/api/sub-units/:id/promote-to-spu", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({ subUnitIdsToMove: z.array(z.string()).optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      const subUnitId = req.params.id;
      const subUnit = await storage.getSubUnit(subUnitId);
      if (!subUnit) return res.status(404).json({ error: "Sub-unit not found" });

      const result = await storage.promoteSubUnitToSpu(subUnitId, parsed.data.subUnitIdsToMove || []);
      res.json({
        success: true,
        message: `Promoted "${subUnit.name}" to a full SPU. Reassigned ${result.staffMoved} staff, ${result.okrsMoved} OKRs, moved ${result.subUnitsMoved} sub-units.`,
        ...result,
      });
    } catch (error) {
      console.error("Promote sub-unit to SPU error:", error);
      res.status(500).json({ error: "Failed to promote sub-unit to SPU" });
    }
  });

  app.post("/api/sub-units/:id/move", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({ targetSpuId: z.string().min(1) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      const subUnitId = req.params.id;
      const subUnit = await storage.getSubUnit(subUnitId);
      if (!subUnit) return res.status(404).json({ error: "Sub-unit not found" });

      const result = await storage.moveSubUnit(subUnitId, parsed.data.targetSpuId);
      res.json({
        success: true,
        message: `Moved "${subUnit.name}" to new SPU. Reassigned ${result.staffMoved} staff, ${result.okrsMoved} OKRs, ${result.assignmentsMoved} assignments.`,
        ...result,
      });
    } catch (error: any) {
      console.error("Move sub-unit error:", error);
      const status = error?.statusCode || 500;
      res.status(status).json({ error: error?.message || "Failed to move sub-unit" });
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

  app.get("/api/okrs/search", requireAdmin, async (req, res) => {
    try {
      const { spuId, subUnitId, quarter, year, q } = req.query;
      let okrs = await storage.getAllOkrsWithDetails();

      if (spuId && spuId !== "all") {
        okrs = okrs.filter(o => o.spuId === spuId);
      }
      if (subUnitId && subUnitId !== "all") {
        okrs = okrs.filter(o => o.subUnitId === subUnitId);
      }
      if (quarter && quarter !== "all") {
        okrs = okrs.filter(o => o.quarter === quarter);
      }
      if (year && year !== "all") {
        okrs = okrs.filter(o => String(o.year) === year);
      }
      if (q && typeof q === 'string' && q.trim()) {
        const search = q.toLowerCase().trim();
        okrs = okrs.filter(o =>
          o.objectiveStatement.toLowerCase().includes(search) ||
          o.okrNumber.toLowerCase().includes(search) ||
          (o.keyResults && o.keyResults.toLowerCase().includes(search)) ||
          (o.spu?.name && o.spu.name.toLowerCase().includes(search)) ||
          (o.subUnit?.name && o.subUnit.name.toLowerCase().includes(search)) ||
          (o.staff && o.staff.name.toLowerCase().includes(search))
        );
      }

      const results = okrs.slice(0, 50).map(o => ({
        id: o.id,
        okrNumber: o.okrNumber,
        objectiveStatement: o.objectiveStatement,
        keyResults: o.keyResults,
        quarter: o.quarter,
        year: o.year,
        spuName: o.spu?.name || '',
        subUnitName: o.subUnit?.name || '',
        staffName: o.staff?.name || '',
      }));

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to search OKRs" });
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

  app.put("/api/okrs/:id", async (req, res) => {
    try {
      let isLeaderOnly = false;
      const sessionStaffId = req.session.selectedStaffId;

      if (!req.session.isAdmin) {
        if (!sessionStaffId) {
          return res.status(403).json({ error: "Forbidden: Admin or Leader access required" });
        }
        const sessionStaff = await storage.getStaff(sessionStaffId);
        if (!sessionStaff || sessionStaff.role !== "leader") {
          return res.status(403).json({ error: "Forbidden: Admin or Leader access required" });
        }
        isLeaderOnly = true;
      }

      const existingOkr = await storage.getOkr(req.params.id);
      if (!existingOkr) {
        return res.status(404).json({ error: "OKR not found" });
      }

      if (isLeaderOnly && existingOkr.staffId !== sessionStaffId) {
        return res.status(403).json({ error: "Forbidden: You can only edit your own OKRs" });
      }
      
      const { reason, editedBy, editedByName, ...updateFields } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: "A reason for editing is required" });
      }
      
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
      
      if (changedFields.length > 0) {
        let auditStaffId = sessionStaffId || null;
        let auditStaffName = editedByName || null;
        if (sessionStaffId) {
          const auditStaff = await storage.getStaff(sessionStaffId);
          if (auditStaff) {
            auditStaffId = auditStaff.id;
            auditStaffName = auditStaff.name;
          }
        }
        await storage.createEditLog({
          okrId: req.params.id,
          editedBy: auditStaffId,
          editedByName: auditStaffName,
          reason: reason.trim(),
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
      const okr = await storage.getOkr(req.params.id);
      if (!okr) {
        return res.status(404).json({ error: "OKR not found" });
      }

      const reason = req.body?.reason || "No reason provided";
      const deletedBy = req.body?.deletedBy || null;
      const deletedByName = req.body?.deletedByName || "Admin";

      const allStaff = await storage.getAllStaff();
      const allSpus = await storage.getAllSpus();
      const staffName = allStaff.find(s => s.id === okr.staffId)?.name || "Unknown";
      const spuName = allSpus.find(s => s.id === okr.spuId)?.name || "Unknown";

      const updates = await storage.getQuarterlyUpdatesByOkr(req.params.id);

      const previousValues: Record<string, any> = {
        staffName,
        spuName,
        okrNumber: okr.okrNumber,
        quarter: okr.quarter,
        year: okr.year,
        objectiveStatement: okr.objectiveStatement,
        keyResults: okr.keyResults,
        universityObjective: okr.universityObjective,
        universityKeyResult: okr.universityKeyResult,
        quarterlyUpdatesCount: updates.length,
      };

      await storage.createEditLog({
        okrId: null,
        editedBy: deletedBy,
        editedByName: deletedByName,
        actionType: "delete",
        reason,
        changedFields: JSON.stringify(Object.keys(previousValues)),
        previousValues: JSON.stringify(previousValues),
        newValues: JSON.stringify({}),
      });

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
        
        const primaryUpdates = updatesWithParsedScores.filter(u => u.isPrimaryScore !== false);
        const latestUpdate = primaryUpdates[0] || updatesWithParsedScores[0];
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

  app.put("/api/quarterly-updates/:id/set-primary", requireAdmin, async (req, res) => {
    try {
      const update = await storage.getQuarterlyUpdate(req.params.id);
      if (!update) {
        return res.status(404).json({ error: "Quarterly update not found" });
      }

      const allUpdates = await storage.getQuarterlyUpdatesByOkr(update.okrId);
      const sameQuarterUpdates = allUpdates.filter(
        u => u.quarter === update.quarter && u.year === update.year
      );

      for (const u of sameQuarterUpdates) {
        if (u.id === update.id) {
          await storage.updateQuarterlyUpdate(u.id, { isPrimaryScore: true });
        } else {
          await storage.updateQuarterlyUpdate(u.id, { isPrimaryScore: false });
        }
      }

      res.json({ success: true, primaryId: update.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to set primary score" });
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
        const startYearSetting = await storage.getSetting("strategicPlanStartYear");
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
        const primaryOkrUpdates = okrUpdates.filter(u => u.isPrimaryScore !== false);
        const latestUpdate = (primaryOkrUpdates.length > 0 ? primaryOkrUpdates : okrUpdates).sort(
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

  // Parse TSV (tab-separated values) — used for OKR form response exports
  const parseTSV = (text: string): string[][] => {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const rows: string[][] = [];
    for (const line of lines) {
      if (line.trim() === '') continue;
      rows.push(line.split('\t'));
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

  // TSV Import Preview endpoint — parses form-response TSV and returns structured data for review
  // NOTE: Imports must use TSV (tab-separated values) format, not CSV.
  app.post("/api/import/csv/preview", requireAdmin, async (req, res) => {
    try {
      const rawData: string = req.body.tsvData || req.body.csvData;
      if (!rawData || typeof rawData !== 'string') {
        return res.status(400).json({ error: "TSV data is required" });
      }

      // Detect format: use TSV parser if the first line contains tabs, else fall back to CSV
      const firstLine = rawData.split('\n')[0] || '';
      const rows = firstLine.includes('\t') ? parseTSV(rawData) : parseCSV(rawData);

      if (rows.length < 2) {
        return res.status(400).json({ error: "File must have at least a header row and one data row" });
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

      // Column mapping — matches the TSV form response export format
      const colTimestamp    = getColIndex(['Timestamp']);
      const colEmail        = getColIndex(['Email']);
      const colName         = getColIndex(['Your Name', 'Name']);
      const colQuarterYear  = getColIndex(['year and quarter', 'quarter']);
      const colOkrNumber    = getColIndex(['numbered OKR', 'OKR number', 'Which numbered']);
      const colSpu          = getColIndex(['parent SPU', 'SPU']);
      const colSubUnit      = getColIndex(['sub-unit', 'sub unit', 'division']);
      const colCollabSpu    = getColIndex(['collaborating', 'collaboration']);
      const colUniObjective = getColIndex(['Strategic Objective', 'University Level Strategic']);
      const colUniKeyResult = getColIndex(['University-Level Key Result', 'Key Result for your OKR']);
      const colObjectiveStmt= getColIndex(['Objective Statement', 'Write your Objective']);
      const colKR1          = getColIndex(['first Key Result', 'Write your first']);
      const colKR2          = getColIndex(['second Key Result']);
      const colKR3          = getColIndex(['third Key Result', 'third key result']);
      const colKR4          = getColIndex(['fourth Key Result']);
      const colKR5          = getColIndex(['fifth Key Result']);
      const colKR6          = getColIndex(['sixth Key Result']);
      const colScoreKR1     = getColIndex(['Score: KR1', 'Score KR1', 'score.*kr1']);
      const colScoreKR2     = getColIndex(['Score: KR2', 'Score KR2']);
      const colScoreKR3     = getColIndex(['Score: KR3', 'Score KR3']);
      const colScoreKR4     = getColIndex(['Score: KR4', 'Score KR4']);
      const colScoreKR5     = getColIndex(['Score: KR5', 'Score KR5']);
      const colScoreKR6     = getColIndex(['Score: KR6', 'Score KR6']);
      const colComments     = getColIndex(['Comments', 'comments']);

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
          message: `File is missing required columns: ${missingColumns.join(', ')}. Make sure you are uploading the TSV export from the OKR submission form.`
        });
      }

      const previewRows: any[] = [];
      const warnings: string[] = [];

      const existingOkrs = await storage.getAllOkrsWithDetails();
      const allSpus = await storage.getAllSpus();
      const allStaff = await storage.getAllStaff();

      const spuNameToId = new Map<string, string>();
      for (const spu of allSpus) {
        spuNameToId.set(spu.name.toLowerCase().trim(), spu.id);
      }
      const staffNameToId = new Map<string, string>();
      for (const s of allStaff) {
        staffNameToId.set(s.name.toLowerCase().trim(), s.id);
      }

      const fuzzyMatchName = (name: string, nameMap: Map<string, string>): string | null => {
        const lower = name.toLowerCase().trim();
        if (nameMap.has(lower)) return nameMap.get(lower)!;
        const entries = Array.from(nameMap.entries());
        for (const [key, id] of entries) {
          if (key.includes(lower) || lower.includes(key)) return id;
        }
        return null;
      };

      const existingTimestamps = new Set<string>();
      const existingOkrKeys = new Set<string>();
      const existingOkrNameKeys = new Set<string>();
      const staffIdToName = new Map<string, string>();
      const spuIdToName = new Map<string, string>();
      for (const s of allStaff) staffIdToName.set(s.id, s.name.toLowerCase().trim());
      for (const s of allSpus) spuIdToName.set(s.id, s.name.toLowerCase().trim());
      for (const okr of existingOkrs) {
        if (okr.submissionTimestamp) {
          const sName = staffIdToName.get(okr.staffId || '') || '';
          const spuName = spuIdToName.get(okr.spuId) || '';
          existingTimestamps.add(`${okr.submissionTimestamp.trim()}|${sName}|${spuName}|${okr.okrNumber}`);
        }
        const sName = staffIdToName.get(okr.staffId || '') || '';
        const key = `${okr.staffId}|${okr.spuId}|${okr.quarter}|${okr.year}|${okr.okrNumber}`;
        existingOkrKeys.add(key);
        const spuName = spuIdToName.get(okr.spuId) || '';
        if (sName && spuName) {
          existingOkrNameKeys.add(`name:${sName}|${spuName}|${okr.quarter}|${okr.year}|${okr.okrNumber}`);
        }
      }

      const csvSeenTimestamps = new Map<string, number>();
      const csvSeenKeys = new Map<string, number>();

      const parseScore = (val: string): number | null => {
        const n = parseFloat(val.trim());
        return isNaN(n) ? null : Math.max(0, Math.min(100, Math.round(n)));
      };

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const staffName      = (row[colName] || '').trim();
        const quarterYearText= (row[colQuarterYear] || '').trim();
        const okrNumberText  = (row[colOkrNumber] || '').trim();
        const spuText        = (row[colSpu] || '').trim();
        const subUnitText    = colSubUnit !== -1 ? (row[colSubUnit] || '').trim() : '';
        const collabSpuText  = colCollabSpu !== -1 ? (row[colCollabSpu] || '').trim() : '';
        const uniObjective   = colUniObjective !== -1 ? (row[colUniObjective] || '').trim() : '';
        const uniKeyResult   = colUniKeyResult !== -1 ? (row[colUniKeyResult] || '').trim() : '';
        const objectiveStmt  = colObjectiveStmt !== -1 ? (row[colObjectiveStmt] || '').trim() : '';
        const kr1Text        = colKR1 !== -1 ? (row[colKR1] || '').trim() : '';
        const kr2Text        = colKR2 !== -1 ? (row[colKR2] || '').trim() : '';
        const kr3Text        = colKR3 !== -1 ? (row[colKR3] || '').trim() : '';
        const kr4Text        = colKR4 !== -1 ? (row[colKR4] || '').trim() : '';
        const kr5Text        = colKR5 !== -1 ? (row[colKR5] || '').trim() : '';
        const kr6Text        = colKR6 !== -1 ? (row[colKR6] || '').trim() : '';
        const scoreKr1       = colScoreKR1 !== -1 ? parseScore(row[colScoreKR1] || '') : null;
        const scoreKr2       = colScoreKR2 !== -1 ? parseScore(row[colScoreKR2] || '') : null;
        const scoreKr3       = colScoreKR3 !== -1 ? parseScore(row[colScoreKR3] || '') : null;
        const scoreKr4       = colScoreKR4 !== -1 ? parseScore(row[colScoreKR4] || '') : null;
        const scoreKr5       = colScoreKR5 !== -1 ? parseScore(row[colScoreKR5] || '') : null;
        const scoreKr6       = colScoreKR6 !== -1 ? parseScore(row[colScoreKR6] || '') : null;
        const commentsText   = colComments !== -1 ? (row[colComments] || '').trim() : '';
        const emailText      = colEmail !== -1 ? (row[colEmail] || '').trim() : '';
        const timestampText  = colTimestamp !== -1 ? (row[colTimestamp] || '').trim() : '';

        if (!staffName && !spuText && !okrNumberText) continue;

        const { quarter, year } = parseQuarterYear(quarterYearText);
        const okrNumber = mapOkrNumber(okrNumberText);

        const rowErrors: string[] = [];
        if (!staffName) rowErrors.push('Missing staff name');
        if (!spuText) rowErrors.push('Missing SPU');
        if (!okrNumberText) rowErrors.push('Missing OKR number');
        if (!objectiveStmt) rowErrors.push('Missing objective statement');

        const cleanSubUnit = isPlaceholderSubUnit(subUnitText) ? '' : subUnitText;

        // Clean up collaboration SPU — "Not Applicable" variants → empty
        const cleanCollab = /not applicable/i.test(collabSpuText) ? '' : collabSpuText;

        let isDuplicate = false;
        let duplicateType: string | null = null;

        const spuNames = spuText.split(',').map((s: string) => s.trim()).filter(Boolean);
        const primarySpuText = (spuNames[0] || spuText).toLowerCase().trim();

        if (timestampText) {
          const tsKey = `${timestampText.trim()}|${staffName.toLowerCase().trim()}|${primarySpuText}|${okrNumber}`;
          if (existingTimestamps.has(tsKey)) {
            isDuplicate = true; duplicateType = 'existing';
            rowErrors.push('Duplicate: This OKR already exists in the database');
          } else if (csvSeenTimestamps.has(tsKey)) {
            isDuplicate = true; duplicateType = 'csv';
            rowErrors.push(`Duplicate: Same OKR as row ${csvSeenTimestamps.get(tsKey)} in this file`);
          }
          csvSeenTimestamps.set(tsKey, i + 2);
        }

        if (!isDuplicate && !timestampText) {
          const resolvedStaffId = fuzzyMatchName(staffName, staffNameToId);
          const resolvedSpuId = fuzzyMatchName(spuNames[0] || spuText, spuNameToId);
          const nameKey = `name:${staffName.toLowerCase().trim()}|${primarySpuText}|${quarter}|${year}|${okrNumber}`;

          if (resolvedStaffId && resolvedSpuId) {
            const idKey = `${resolvedStaffId}|${resolvedSpuId}|${quarter}|${year}|${okrNumber}`;
            if (existingOkrKeys.has(idKey)) {
              isDuplicate = true; duplicateType = 'existing';
              rowErrors.push('Duplicate: This OKR already exists in the database');
            } else if (csvSeenKeys.has(idKey)) {
              isDuplicate = true; duplicateType = 'csv';
              rowErrors.push(`Duplicate: Same as row ${csvSeenKeys.get(idKey)} in this file`);
            }
            csvSeenKeys.set(idKey, i + 2);
          } else {
            if (existingOkrNameKeys.has(nameKey)) {
              isDuplicate = true; duplicateType = 'existing';
              rowErrors.push('Duplicate: This OKR already exists in the database');
            } else if (csvSeenKeys.has(nameKey)) {
              isDuplicate = true; duplicateType = 'csv';
              rowErrors.push(`Duplicate: Same as row ${csvSeenKeys.get(nameKey)} in this file`);
            }
            csvSeenKeys.set(nameKey, i + 2);
          }
        }

        // Calculate average score from present KR scores
        const allScores = [scoreKr1, scoreKr2, scoreKr3, scoreKr4, scoreKr5, scoreKr6];
        const presentScores = allScores.filter((s): s is number => s !== null);
        const averageScore = presentScores.length > 0
          ? Math.round(presentScores.reduce((a, b) => a + b, 0) / presentScores.length)
          : null;
        const hasScores = presentScores.length > 0;

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
          collaborationSpu: cleanCollab,
          universityObjective: uniObjective,
          universityKeyResult: uniKeyResult,
          objectiveStatement: objectiveStmt,
          keyResult1: kr1Text,
          keyResult2: kr2Text,
          keyResult3: kr3Text,
          keyResult4: kr4Text,
          keyResult5: kr5Text,
          keyResult6: kr6Text,
          scoreKr1,
          scoreKr2,
          scoreKr3,
          scoreKr4,
          scoreKr5,
          scoreKr6,
          averageScore,
          hasScores,
          comments: commentsText,
          errors: rowErrors,
          include: rowErrors.length === 0 && !isDuplicate,
          isDuplicate,
          duplicateType,
        });
      }

      const duplicateCount = previewRows.filter(r => r.isDuplicate).length;

      res.json({
        success: true,
        totalRows: dataRows.length,
        parsedRows: previewRows.length,
        skippedEmpty: dataRows.length - previewRows.length,
        duplicateRows: duplicateCount,
        detectedHeaders: headers,
        rows: previewRows,
        warnings,
      });

    } catch (error: any) {
      console.error("TSV preview error:", error);
      res.status(500).json({ error: "Failed to parse file", details: error.message });
    }
  });

  // TSV Import confirm endpoint — imports reviewed data and optionally creates quarterly updates from embedded scores
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
        updatesCreated: 0,
        rowsSkipped: 0,
        duplicatesSkipped: 0,
        errors: [] as string[],
      };

      const existingOkrs = await storage.getAllOkrs();
      const allStaffForConfirm = await storage.getAllStaff();
      const allSpusForConfirm = await storage.getAllSpus();
      const staffIdToNameConfirm = new Map<string, string>();
      const spuIdToNameConfirm = new Map<string, string>();
      for (const s of allStaffForConfirm) staffIdToNameConfirm.set(s.id, s.name.toLowerCase().trim());
      for (const s of allSpusForConfirm) spuIdToNameConfirm.set(s.id, s.name.toLowerCase().trim());
      const existingTimestamps = new Set<string>();
      const existingOkrKeys = new Set<string>();
      for (const okr of existingOkrs) {
        if (okr.submissionTimestamp) {
          const sName = staffIdToNameConfirm.get(okr.staffId || '') || '';
          const spuName = spuIdToNameConfirm.get(okr.spuId) || '';
          existingTimestamps.add(`${okr.submissionTimestamp.trim()}|${sName}|${spuName}|${okr.okrNumber}`);
        }
        existingOkrKeys.add(`${okr.staffId}|${okr.spuId}|${okr.quarter}|${okr.year}|${okr.okrNumber}`);
      }
      const importedTimestamps = new Set<string>();
      const importedKeys = new Set<string>();

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
                  keyResult1, keyResult2, keyResult3, keyResult4, keyResult5, keyResult6,
                  scoreKr1, scoreKr2, scoreKr3, scoreKr4, scoreKr5, scoreKr6,
                  averageScore, hasScores, comments,
                  timestamp: rowTimestamp } = row;

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
          if (subUnitName && !isPlaceholderSubUnit(subUnitName)) {
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
          if (collaborationSpu && !/not applicable/i.test(collaborationSpu)) {
            // Collaboration SPU can be a comma-separated list; create/find each
            const collabNames = collaborationSpu.split(',').map((s: string) => s.trim()).filter(Boolean);
            for (const cName of collabNames) {
              if (spuCache.has(cName.toLowerCase())) {
                collabSpu = spuCache.get(cName.toLowerCase());
              } else {
                const existingBefore = await storage.getSpuByName(cName);
                collabSpu = await storage.findOrCreateSpu(cName);
                spuCache.set(cName.toLowerCase(), collabSpu);
                if (!existingBefore) results.spusCreated++;
              }
              break; // only store the first collaboration SPU reference on the OKR
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

          // Build key results array from up to 6 KR columns
          const krTexts = [keyResult1, keyResult2, keyResult3, keyResult4, keyResult5, keyResult6]
            .map((t: any) => (t || '').trim())
            .filter(Boolean);

          const keyResultsArray: { description: string; percentage: number }[] = krTexts.length > 0
            ? krTexts.map((t: string) => ({ description: t, percentage: 100 }))
            : [{ description: 'Key Result 1', percentage: 100 }];

          const perKr = Math.floor(100 / keyResultsArray.length);
          keyResultsArray.forEach((kr: any, idx: number) => {
            kr.percentage = idx === keyResultsArray.length - 1
              ? 100 - perKr * (keyResultsArray.length - 1)
              : perKr;
          });

          // Server-side duplicate guard
          let isConfirmDuplicate = false;
          if (rowTimestamp) {
            const tsKey = `${rowTimestamp.trim()}|${staffRecord.name.toLowerCase().trim()}|${primarySpu.name.toLowerCase().trim()}|${okrNumber}`;
            if (existingTimestamps.has(tsKey) || importedTimestamps.has(tsKey)) {
              isConfirmDuplicate = true;
            }
            importedTimestamps.add(tsKey);
          } else {
            const confirmDedupKey = `${staffRecord.id}|${primarySpu.id}|${quarter}|${year}|${okrNumber}`;
            if (existingOkrKeys.has(confirmDedupKey) || importedKeys.has(confirmDedupKey)) {
              isConfirmDuplicate = true;
            }
            importedKeys.add(confirmDedupKey);
          }
          if (isConfirmDuplicate) {
            results.duplicatesSkipped++;
            results.rowsSkipped++;
            continue;
          }

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
            objectiveStatement: objectiveStatement || 'Imported OKR',
            keyResults: JSON.stringify(keyResultsArray),
            submissionTimestamp: rowTimestamp || null,
          });
          results.okrsCreated++;

          // If the row has embedded scores, create a quarterly update
          if (hasScores) {
            const krScoresRaw = [scoreKr1, scoreKr2, scoreKr3, scoreKr4, scoreKr5, scoreKr6];
            // Only include scores for KRs that actually exist
            const krScoresForKrs = krScoresRaw.slice(0, keyResultsArray.length);
            const keyResultScores = JSON.stringify(krScoresForKrs);
            const presentScores = krScoresForKrs.filter((s: any): s is number => s !== null);
            const avgScore = presentScores.length > 0
              ? Math.round(presentScores.reduce((a: number, b: number) => a + b, 0) / presentScores.length)
              : 0;

            await storage.createQuarterlyUpdate({
              okrId: okr.id,
              staffId: staffRecord.id,
              scorerName: staffRecord.name,
              quarter,
              year,
              progress: avgScore,
              keyResultScores,
              averageScore: avgScore,
              additionalKeyResults: null,
              notes: comments || '',
              isPrimaryScore: true,
              isCollaborativeScore: false,
            });
            results.updatesCreated++;
          }

        } catch (rowError: any) {
          results.errors.push(`Row ${row.rowIndex}: ${rowError.message}`);
        }
      }

      const errorCount = results.errors.length;
      let message = `Import completed: ${results.okrsCreated} OKRs created`;
      if (results.updatesCreated > 0) message += `, ${results.updatesCreated} quarterly updates created`;
      message += `, ${results.staffCreated} new staff, ${results.spusCreated} new SPUs, ${results.subUnitsCreated} new sub-units.`;
      if (results.duplicatesSkipped > 0) message += ` ${results.duplicatesSkipped} duplicate(s) skipped.`;
      if (results.rowsSkipped > 0) message += ` ${results.rowsSkipped} rows skipped.`;
      if (errorCount > 0) message += ` ${errorCount} error(s).`;

      res.json({ success: true, results, message });

    } catch (error: any) {
      console.error("TSV import error:", error);
      res.status(500).json({ error: "Failed to import file", details: error.message });
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

      const allOkrsDetailed = await storage.getAllOkrsWithDetails();
      const allOkrs = allOkrsDetailed;
      const allSpus = await storage.getAllSpus();
      const allSubUnits = await storage.getAllSubUnits();
      const allStaff = await storage.getAllStaff();

      const spuNameMap = new Map<string, string>();
      for (const spu of allSpus) {
        spuNameMap.set(spu.name.toLowerCase().trim(), spu.id);
      }

      const nameStartsWith = (a: string, b: string): boolean => {
        if (a.length < 3 || b.length < 3) return false;
        return a.startsWith(b) || b.startsWith(a);
      };

      const levenshtein = (a: string, b: string): number => {
        const matrix: number[][] = [];
        for (let i = 0; i <= a.length; i++) matrix[i] = [i];
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
          for (let j = 1; j <= b.length; j++) {
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
          }
        }
        return matrix[a.length][b.length];
      };

      const fuzzyWordMatch = (a: string, b: string): boolean => {
        if (a === b) return true;
        if (nameStartsWith(a, b)) return true;
        if (a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= 1) return true;
        return false;
      };

      const fuzzyMatchStaffName = (csvName: string, okrStaffName: string): boolean => {
        if (!csvName || !okrStaffName) return false;
        const csvLower = csvName.toLowerCase().trim().replace(/[.@]/g, ' ');
        const staffLower = okrStaffName.toLowerCase().trim().replace(/[.@]/g, ' ');
        if (csvLower === staffLower) return true;
        const csvParts = csvLower.split(/[\s,]+/).filter(w => w.length > 1 && w !== 'phd' && w !== 'dr' && w !== 'jr' && w !== 'sr' && w !== 'ii' && w !== 'iii');
        const staffParts = staffLower.split(/[\s,]+/).filter(w => w.length > 1 && w !== 'phd' && w !== 'dr' && w !== 'jr' && w !== 'sr' && w !== 'ii' && w !== 'iii');
        if (csvParts.length >= 2 && staffParts.length >= 2) {
          const csvFirst = csvParts[0];
          const csvLast = csvParts[csvParts.length - 1];
          const staffFirst = staffParts[0];
          const staffLast = staffParts[staffParts.length - 1];
          if (fuzzyWordMatch(csvFirst, staffFirst) && fuzzyWordMatch(csvLast, staffLast)) return true;
          if (fuzzyWordMatch(csvLast, staffFirst) && fuzzyWordMatch(csvFirst, staffLast)) return true;
        }
        const matchCount = csvParts.filter(w => staffParts.some(sw => fuzzyWordMatch(w, sw))).length;
        if (matchCount >= Math.max(2, Math.ceil(csvParts.length * 0.6))) return true;
        return false;
      };

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
        const csvWords = lower.split(/[\s,\-]+/).filter(w => w.length > 2);
        for (const [name, id] of spuEntries) {
          const nameWords = name.split(/[\s,\-]+/).filter(w => w.length > 2);
          const matchCount = csvWords.filter(cw => nameWords.some(nw => fuzzyWordMatch(cw, nw))).length;
          if (matchCount >= Math.max(1, Math.ceil(csvWords.length * 0.6))) return id;
        }
        for (const [name, id] of spuEntries) {
          if (lower.length >= 5 && name.length >= 5 && levenshtein(lower, name) <= 2) return id;
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

      const allQuarterlyUpdates = await storage.getAllQuarterlyUpdates();
      const existingUpdateKeys = new Set<string>();
      const existingUpdateScorerMap = new Map<string, string>();
      for (const update of allQuarterlyUpdates) {
        const key = `${update.okrId}|${update.quarter}|${update.year}`;
        existingUpdateKeys.add(key);
        if (update.scorerName) {
          existingUpdateScorerMap.set(key, update.scorerName);
        }
      }

      const csvScoreSeenKeys = new Map<string, number>();

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
        const cleanSubUnit = isPlaceholderSubUnit(subUnitText) ? '' : subUnitText;
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
        let matchedOkrDetails: any = null;
        const rowErrors: string[] = [];
        const rowWarnings: string[] = [];

        const formatOkrDetails = (okr: any) => ({
          id: okr.id,
          okrNumber: okr.okrNumber,
          objectiveStatement: okr.objectiveStatement,
          keyResults: okr.keyResults,
          quarter: okr.quarter,
          year: okr.year,
          spuName: okr.spu?.name || '',
          subUnitName: okr.subUnit?.name || '',
          staffName: okr.staff?.name || '',
        });

        let candidateOkrs: any[] = [];

        if (!matchedSpuId) {
          rowErrors.push(`SPU not found: "${primarySpuName}"`);
          console.log(`[SCORE-MATCH] Row ${i+2} SPU not found: "${primarySpuName}"`);
        } else {
          const allForSpuQY = allOkrs.filter(o =>
            o.spuId === matchedSpuId &&
            o.quarter === quarter &&
            o.year === year
          );

          const okrNumCandidates = allForSpuQY.filter(o =>
            o.okrNumber === okrNumber
          );

          const krCount = krScores.filter(s => s !== null).length;

          let narrowed = okrNumCandidates;
          let matchMethod = 'SPU + Quarter + Year + OKR#';

          if (narrowed.length > 1 && matchedSubUnitId) {
            const subFiltered = narrowed.filter(o => o.subUnitId === matchedSubUnitId);
            if (subFiltered.length >= 1) {
              narrowed = subFiltered;
              matchMethod += ' + Sub-unit';
            }
          }

          if (narrowed.length > 1 && krCount > 0) {
            const krFiltered = narrowed.filter(o => {
              try {
                const okrKrs = typeof o.keyResults === 'string' ? JSON.parse(o.keyResults) : o.keyResults;
                return Array.isArray(okrKrs) && okrKrs.length === krCount;
              } catch { return false; }
            });
            if (krFiltered.length >= 1) {
              narrowed = krFiltered;
              matchMethod += ' + KR count';
            }
          }

          if (narrowed.length === 1) {
            matchedOkrId = narrowed[0].id;
            matchedOkrInfo = `Matched by ${matchMethod}`;
            matchedOkrDetails = formatOkrDetails(narrowed[0]);
          } else if (narrowed.length > 1) {
            matchedOkrId = narrowed[0].id;
            matchedOkrInfo = `${narrowed.length} candidates after ${matchMethod}, using first`;
            matchedOkrDetails = formatOkrDetails(narrowed[0]);
            rowWarnings.push(`Ambiguous: ${narrowed.length} OKRs matched ${matchMethod}`);
          } else if (allForSpuQY.length > 0) {
            const okrNum = parseInt(okrNumber.replace(/\D/g, ''));
            const sorted = [...allForSpuQY].sort((a, b) => {
              const aNum = parseInt((a.okrNumber || '').replace(/\D/g, '')) || 0;
              const bNum = parseInt((b.okrNumber || '').replace(/\D/g, '')) || 0;
              return aNum - bNum;
            });
            if (!isNaN(okrNum) && okrNum >= 1 && okrNum <= sorted.length) {
              const idx = okrNum - 1;
              matchedOkrId = sorted[idx].id;
              matchedOkrInfo = `Matched by SPU + Quarter + Year (OKR# ${okrNumber} → position ${okrNum} of ${sorted.length}: ${sorted[idx].okrNumber})`;
              matchedOkrDetails = formatOkrDetails(sorted[idx]);
              if (sorted[idx].okrNumber !== okrNumber) {
                rowWarnings.push(`OKR# remapped: CSV "${okrNumber}" → DB "${sorted[idx].okrNumber}" (by position in SPU)`);
              }
            } else {
              const spuMatch = allSpus.find(s => s.id === matchedSpuId);
              console.log(`[SCORE-MATCH] Row ${i+2} NO MATCH: scorer="${scorerName}" spu="${primarySpuName}"→"${spuMatch?.name}" q=${quarter} y=${year} okr#=${okrNumber} | SPU+Q+Y has ${allForSpuQY.length} OKRs (position ${okrNum} out of range), okr#s=[${allForSpuQY.map(o=>`${o.okrNumber}(${o.staff?.name||'?'})`).join(', ')}]`);
              rowErrors.push(`No matching OKR: ${okrNumber} in ${quarter} ${year} (SPU has ${allForSpuQY.length} OKRs, position out of range)`);
            }
          } else {
            const spuMatch = allSpus.find(s => s.id === matchedSpuId);
            console.log(`[SCORE-MATCH] Row ${i+2} NO MATCH: scorer="${scorerName}" spu="${primarySpuName}"→"${spuMatch?.name}" q=${quarter} y=${year} okr#=${okrNumber} | SPU+Q+Y has 0 OKRs`);
            rowErrors.push(`No OKRs found for this SPU in ${quarter} ${year}`);
          }

          candidateOkrs = allForSpuQY.map(formatOkrDetails);
        }

        if (!scorerName) rowErrors.push('Missing scorer name');
        if (krScores.length === 0 && averageScore === null) rowErrors.push('No scores found');

        let isDuplicate = false;
        let duplicateType: string | null = null;
        let duplicateOfRow: number | null = null;
        let isCollaborativeScore = false;

        if (matchedOkrId) {
          const scoreKey = `${matchedOkrId}|${quarter}|${year}`;
          if (existingUpdateKeys.has(scoreKey)) {
            const existingScorer = existingUpdateScorerMap.get(scoreKey);
            const scorersDiffer = existingScorer && scorerName && 
              existingScorer.toLowerCase().trim() !== scorerName.toLowerCase().trim();
            if (scorersDiffer) {
              isCollaborativeScore = true;
              rowWarnings.push(`Collaborative score: Different scorer "${scorerName}" vs existing "${existingScorer}" for same OKR. Will be saved as secondary (non-primary) score.`);
            } else {
              isDuplicate = true;
              duplicateType = 'existing';
              rowErrors.push('Duplicate: A score for this OKR already exists in the database for this period');
            }
          } else if (csvScoreSeenKeys.has(scoreKey)) {
            const prevRowIdx = csvScoreSeenKeys.get(scoreKey)!;
            const prevRow = previewRows.find(r => r.rowIndex === prevRowIdx);
            const prevScorer = prevRow?.scorerName || '';
            const scorersDiffer = prevScorer && scorerName && 
              prevScorer.toLowerCase().trim() !== scorerName.toLowerCase().trim();
            if (scorersDiffer) {
              isCollaborativeScore = true;
              duplicateOfRow = prevRowIdx;
              rowWarnings.push(`Collaborative score: Different scorer "${scorerName}" vs row ${prevRowIdx} scorer "${prevScorer}" for same OKR. Will be saved as secondary (non-primary) score.`);
            } else {
              isDuplicate = true;
              duplicateType = 'csv';
              duplicateOfRow = prevRowIdx;
              rowErrors.push(`Duplicate: Same OKR score as row ${duplicateOfRow} in this file`);
            }
          }
          csvScoreSeenKeys.set(scoreKey, i + 2);
        }

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
          matchedOkrDetails,
          candidateOkrs,
          errors: rowErrors,
          warnings: rowWarnings,
          include: rowErrors.length === 0 && matchedOkrId !== null && !isDuplicate,
          isDuplicate,
          duplicateType,
          duplicateOfRow,
          isCollaborativeScore,
        });
      }

      const duplicateCount = previewRows.filter(r => r.isDuplicate).length;
      const matchedCount = previewRows.filter(r => r.matchedOkrId !== null).length;
      const unmatchedCount = previewRows.filter(r => r.matchedOkrId === null).length;
      const spuNotFoundCount = previewRows.filter(r => r.errors?.some((e: string) => e.includes('SPU not found'))).length;
      const noOkrFoundCount = previewRows.filter(r => r.errors?.some((e: string) => e.includes('No matching OKR'))).length;
      const existingDupCount = previewRows.filter(r => r.duplicateType === 'existing').length;
      const csvDupCount = previewRows.filter(r => r.duplicateType === 'csv').length;
      console.log(`[SCORE-SUMMARY] Total: ${previewRows.length}, Matched: ${matchedCount}, Unmatched: ${unmatchedCount}, SPU-not-found: ${spuNotFoundCount}, No-OKR-found: ${noOkrFoundCount}, Duplicates: ${duplicateCount} (existing: ${existingDupCount}, csv-internal: ${csvDupCount})`);
      const q3_2025 = previewRows.filter(r => r.quarter === 'Q3' && r.year === 2025);
      console.log(`[SCORE-SUMMARY] Q3 2025: total=${q3_2025.length}, matched=${q3_2025.filter((r: any) => r.matchedOkrId).length}, dups=${q3_2025.filter((r: any) => r.isDuplicate).length} (existing=${q3_2025.filter((r: any) => r.duplicateType === 'existing').length}, csv=${q3_2025.filter((r: any) => r.duplicateType === 'csv').length})`);

      res.json({
        success: true,
        totalRows: dataRows.length,
        parsedRows: previewRows.length,
        skippedEmpty: dataRows.length - previewRows.length,
        matchedRows: matchedCount,
        unmatchedRows: unmatchedCount,
        duplicateRows: duplicateCount,
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
        duplicatesSkipped: 0,
        unmatchedSaved: 0,
        errors: [] as string[],
      };

      const allQuarterlyUpdates = await storage.getAllQuarterlyUpdates();
      const existingScoreKeys = new Set<string>();
      for (const update of allQuarterlyUpdates) {
        existingScoreKeys.add(`${update.okrId}|${update.quarter}|${update.year}`);
      }
      const importedScoreKeys = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (!row.matchedOkrId) {
            // Only save non-duplicate unmatched rows to the pending queue
            if (!row.isDuplicate) {
              await storage.createUnmatchedScore({
                spuName: row.spuName || null,
                subUnitName: row.subUnitName || null,
                quarter: row.quarter,
                year: row.year,
                okrNumber: row.okrNumber || null,
                scorerName: row.scorerName || null,
                krScores: row.krScores && row.krScores.length > 0
                  ? JSON.stringify(row.krScores.map((kr: any) => ({ keyResultNumber: kr.krNumber, score: kr.score })))
                  : null,
                notes: row.notes || null,
                averageScore: row.averageScore ?? null,
                overflowKrText: row.overflowKRText || null,
                isCollaborativeScore: row.isCollaborativeScore === true,
                rawData: JSON.stringify(row),
                status: "pending",
                matchedOkrId: null,
                matchedAt: null,
              });
              results.unmatchedSaved++;
            } else {
              results.rowsSkipped++;
            }
            continue;
          }

          if (!row.include) {
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

          const scoreDedupKey = `${row.matchedOkrId}|${row.quarter}|${row.year}`;
          const isCollab = row.isCollaborativeScore === true;
          
          if (!isCollab && (existingScoreKeys.has(scoreDedupKey) || importedScoreKeys.has(scoreDedupKey))) {
            results.duplicatesSkipped++;
            results.rowsSkipped++;
            continue;
          }

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
            isPrimaryScore: !isCollab,
            isCollaborativeScore: isCollab,
          });
          importedScoreKeys.add(scoreDedupKey);
          results.scoresCreated++;

        } catch (rowError: any) {
          results.errors.push(`Row ${row.rowIndex}: ${rowError.message}`);
        }
      }

      const errorCount = results.errors.length;
      let message = `Score import completed: ${results.scoresCreated} quarterly updates created.`;
      if (results.unmatchedSaved > 0) message += ` ${results.unmatchedSaved} unmatched score(s) saved for manual matching.`;
      if (results.duplicatesSkipped > 0) message += ` ${results.duplicatesSkipped} duplicate(s) skipped.`;
      if (results.rowsSkipped > 0) message += ` ${results.rowsSkipped} rows skipped.`;
      if (errorCount > 0) message += ` ${errorCount} error(s).`;

      res.json({ success: true, results, message });

    } catch (error: any) {
      console.error("Score import error:", error);
      res.status(500).json({ error: "Failed to import scores", details: error.message });
    }
  });

  // ── Unmatched Scores endpoints ──────────────────────────────────────────────

  app.get("/api/unmatched-scores", requireAdmin, async (req, res) => {
    try {
      const scores = await storage.getPendingUnmatchedScores();
      res.json(scores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/unmatched-scores/:id/match", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { okrId, scorerName } = req.body;
      if (!okrId) return res.status(400).json({ error: "okrId is required" });

      const pendingScores = await storage.getPendingUnmatchedScores();
      const pending = pendingScores.find(s => s.id === id);
      if (!pending) return res.status(404).json({ error: "Unmatched score not found" });

      const allQuarterlyUpdates = await storage.getAllQuarterlyUpdates();
      const existingKey = `${okrId}|${pending.quarter}|${pending.year}`;
      const isDuplicate = allQuarterlyUpdates.some(u =>
        u.okrId === okrId && u.quarter === pending.quarter && u.year === pending.year && u.isPrimaryScore
      );
      if (isDuplicate && !pending.isCollaborativeScore) {
        return res.status(409).json({ error: "A primary score already exists for this OKR in this quarter/year" });
      }

      const allStaff = await storage.getAllStaff();
      const resolvedScorerName = scorerName || pending.scorerName || "";
      const matchedStaff = allStaff.find(s =>
        s.name.toLowerCase().trim() === resolvedScorerName.toLowerCase().trim()
      ) || null;

      let krScores = null;
      try {
        if (pending.krScores) {
          const parsed = JSON.parse(pending.krScores);
          krScores = JSON.stringify(parsed.map((kr: any) => ({
            keyResultNumber: kr.keyResultNumber,
            description: `Key Result ${kr.keyResultNumber}`,
            score: kr.score,
          })));
        }
      } catch {}

      await storage.createQuarterlyUpdate({
        okrId,
        staffId: matchedStaff?.id || null,
        scorerName: resolvedScorerName,
        quarter: pending.quarter,
        year: pending.year,
        progress: pending.averageScore ?? 0,
        keyResultScores: krScores,
        averageScore: pending.averageScore ?? 0,
        additionalKeyResults: pending.overflowKrText || null,
        notes: pending.notes || '',
        isPrimaryScore: !pending.isCollaborativeScore,
        isCollaborativeScore: pending.isCollaborativeScore ?? false,
      });

      await storage.matchUnmatchedScore(id, okrId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/unmatched-scores/:id", requireAdmin, async (req, res) => {
    try {
      const { action } = req.query;
      if (action === "dismiss") {
        const reason = req.body?.reason || "No reason provided";
        const score = await storage.getUnmatchedScore(req.params.id);
        await storage.dismissUnmatchedScore(req.params.id);
        await storage.createEditLog({
          okrId: null,
          editedBy: null,
          editedByName: "Admin",
          actionType: "delete",
          reason,
          changedFields: JSON.stringify(["status"]),
          previousValues: JSON.stringify({
            type: "unmatched_score",
            id: req.params.id,
            spuName: score?.spuName,
            subUnitName: score?.subUnitName,
            quarter: score?.quarter,
            year: score?.year,
            okrNumber: score?.okrNumber,
            status: "pending",
          }),
          newValues: JSON.stringify({ status: "dismissed" }),
        });
      } else {
        await storage.deleteUnmatchedScore(req.params.id);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Setup / Initial Load endpoints ───────────────────────────────────────

  app.get("/api/setup/status", async (req, res) => {
    const val = await storage.getSetting("setup_completed");
    if (val === "true") return res.json({ completed: true });
    if (val === "false") return res.json({ completed: false });
    // Flag not yet set — auto-detect based on whether SPUs exist
    // (handles existing deployments or fresh installs with seeded data)
    const existingSpus = await storage.getAllSpus();
    if (existingSpus.length > 0) {
      await storage.setSetting("setup_completed", "true");
      return res.json({ completed: true });
    }
    return res.json({ completed: false });
  });

  // Example CSV downloads — headers only, no test data
  app.get("/api/setup/example-csv/:type", (req, res) => {
    const { type } = req.params;
    let filename = "";
    let content = "";
    if (type === "spu-staff") {
      filename = "spu-staff-import-template.csv";
      content = "SPU Name,Sub-Unit Name,SPU Admin Name,Sub-Unit Team Members\n";
    } else if (type === "objectives") {
      filename = "university-objectives-template.csv";
      content = "Objective Number,Objective Title,Key Result Number,Key Result Description,Applicable Years\n";
    } else {
      return res.status(404).json({ error: "Unknown template type" });
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  });

  // Preview SPU + Staff CSV
  app.post("/api/setup/preview/spu-staff", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData) return res.status(400).json({ error: "CSV data is required" });

      const rows = parseCSV(csvData);
      if (rows.length < 2) return res.status(400).json({ error: "CSV must have a header row and at least one data row" });

      const headers = rows[0].map((h: string) => h.trim().toLowerCase());
      const colSpuName = headers.indexOf("spu name");
      const colSubUnit = headers.indexOf("sub-unit name");
      const colAdmin = headers.indexOf("spu admin name");
      const colMembers = headers.indexOf("sub-unit team members");

      const missing: string[] = [];
      if (colSpuName < 0) missing.push("SPU Name");
      if (colAdmin < 0) missing.push("SPU Admin Name");
      if (colMembers < 0) missing.push("Sub-Unit Team Members");
      if (missing.length > 0) return res.status(400).json({ error: `Missing required columns: ${missing.join(", ")}` });

      interface SpuEntry {
        name: string; admin: string;
        subUnits: Map<string, { name: string; members: string[] }>;
        directMembers: string[];
      }
      const spuMap = new Map<string, SpuEntry>();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        const spuName = (row[colSpuName] || "").trim();
        if (!spuName) continue;
        const subUnitName = colSubUnit >= 0 ? (row[colSubUnit] || "").trim() : "";
        const adminName = (row[colAdmin] || "").trim();
        const memberStr = (row[colMembers] || "").trim();
        const members = memberStr ? memberStr.split(";").map((m: string) => m.trim()).filter(Boolean) : [];

        if (!spuMap.has(spuName)) spuMap.set(spuName, { name: spuName, admin: "", subUnits: new Map(), directMembers: [] });
        const spu = spuMap.get(spuName)!;
        if (adminName && !spu.admin) spu.admin = adminName;

        const isPlaceholder = isPlaceholderSubUnit(subUnitName);
        if (!isPlaceholder && subUnitName) {
          if (!spu.subUnits.has(subUnitName)) spu.subUnits.set(subUnitName, { name: subUnitName, members: [] });
          spu.subUnits.get(subUnitName)!.members.push(...members);
        } else {
          spu.directMembers.push(...members);
        }
      }

      const allStaffNames = new Set<string>();
      const spuList = Array.from(spuMap.values()).map(spu => {
        if (spu.admin) allStaffNames.add(spu.admin);
        const subUnitList = Array.from(spu.subUnits.values()).map(su => {
          su.members.forEach((m: string) => allStaffNames.add(m));
          return { name: su.name, memberCount: su.members.length, members: su.members };
        });
        spu.directMembers.forEach((m: string) => allStaffNames.add(m));
        return { name: spu.name, admin: spu.admin, subUnits: subUnitList, directMemberCount: spu.directMembers.length, directMembers: spu.directMembers };
      });

      res.json({
        spus: spuList,
        totals: { spus: spuMap.size, subUnits: spuList.reduce((n, s) => n + s.subUnits.length, 0), staff: allStaffNames.size },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Confirm SPU + Staff CSV — actually creates the records
  app.post("/api/setup/confirm/spu-staff", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData) return res.status(400).json({ error: "CSV data is required" });

      const rows = parseCSV(csvData);
      const headers = rows[0].map((h: string) => h.trim().toLowerCase());
      const colSpuName = headers.indexOf("spu name");
      const colSubUnit = headers.indexOf("sub-unit name");
      const colAdmin = headers.indexOf("spu admin name");
      const colMembers = headers.indexOf("sub-unit team members");

      // Load existing SPUs and staff to avoid duplicates
      const existingSpus = await storage.getAllSpus();
      const existingStaff = await storage.getAllStaff();
      const spuByName = new Map(existingSpus.map(s => [s.name.toLowerCase(), s]));
      const staffByEmail = new Map(existingStaff.map(s => [s.email.toLowerCase(), s]));
      const staffByName = new Map(existingStaff.map(s => [s.name.toLowerCase(), s]));

      const created = { spus: 0, subUnits: 0, staff: 0 };
      const subUnitByKey = new Map<string, any>();

      const getOrCreateSpu = async (name: string) => {
        const key = name.toLowerCase();
        if (spuByName.has(key)) return spuByName.get(key)!;
        const spu = await storage.createSpu({ name });
        spuByName.set(key, spu);
        created.spus++;
        return spu;
      };

      const getOrCreateSubUnit = async (name: string, spuId: string) => {
        const key = `${spuId}:${name.toLowerCase()}`;
        if (subUnitByKey.has(key)) return subUnitByKey.get(key)!;
        const allSubUnitsForSpu = await db.select().from(subUnits).where(eq(subUnits.spuId, spuId));
        const existing = allSubUnitsForSpu.find(su => su.name.toLowerCase() === name.toLowerCase());
        if (existing) { subUnitByKey.set(key, existing); return existing; }
        const su = await storage.createSubUnit({ name, spuId });
        subUnitByKey.set(key, su);
        created.subUnits++;
        return su;
      };

      const getOrCreateStaff = async (name: string, role: "super_admin" | "leader" | "basic", spuId: string, subUnitId: string | null) => {
        const nameKey = name.toLowerCase();
        if (staffByName.has(nameKey)) return staffByName.get(nameKey)!;
        const emailBase = name.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".");
        let email = `${emailBase}@macu.edu`;
        let suffix = 1;
        while (staffByEmail.has(email.toLowerCase())) { email = `${emailBase}${suffix}@macu.edu`; suffix++; }
        const staffMember = await storage.createStaff({ name, email, spuId, subUnitId, role, isAdmin: false });
        staffByName.set(nameKey, staffMember);
        staffByEmail.set(email.toLowerCase(), staffMember);
        created.staff++;
        return staffMember;
      };

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        const spuName = (row[colSpuName] || "").trim();
        if (!spuName) continue;
        const subUnitName = colSubUnit >= 0 ? (row[colSubUnit] || "").trim() : "";
        const adminName = (row[colAdmin] || "").trim();
        const memberStr = (row[colMembers] || "").trim();
        const members = memberStr ? memberStr.split(";").map((m: string) => m.trim()).filter(Boolean) : [];

        const spu = await getOrCreateSpu(spuName);
        const isPlaceholder = isPlaceholderSubUnit(subUnitName);
        const subUnit = (!isPlaceholder && subUnitName) ? await getOrCreateSubUnit(subUnitName, spu.id) : null;

        if (adminName) await getOrCreateStaff(adminName, "leader", spu.id, null);
        for (const memberName of members) {
          await getOrCreateStaff(memberName, "basic", spu.id, subUnit?.id ?? null);
        }
      }

      res.json({ success: true, created });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Preview University Objectives CSV
  app.post("/api/setup/preview/objectives", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData) return res.status(400).json({ error: "CSV data is required" });

      const rows = parseCSV(csvData);
      if (rows.length < 2) return res.status(400).json({ error: "CSV must have a header row and at least one data row" });

      const headers = rows[0].map((h: string) => h.trim().toLowerCase());
      const colObjNum = headers.indexOf("objective number");
      const colObjTitle = headers.indexOf("objective title");
      const colKrNum = headers.indexOf("key result number");
      const colKrDesc = headers.indexOf("key result description");
      const colYears = headers.indexOf("applicable years");

      const missing: string[] = [];
      if (colObjNum < 0) missing.push("Objective Number");
      if (colObjTitle < 0) missing.push("Objective Title");
      if (colKrNum < 0) missing.push("Key Result Number");
      if (colKrDesc < 0) missing.push("Key Result Description");
      if (missing.length > 0) return res.status(400).json({ error: `Missing required columns: ${missing.join(", ")}` });

      interface ObjEntry { number: string; title: string; keyResults: { number: string; description: string }[]; years: number[] }
      const objMap = new Map<string, ObjEntry>();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        const objNum = (row[colObjNum] || "").trim();
        const objTitle = (row[colObjTitle] || "").trim();
        const krNum = (row[colKrNum] || "").trim();
        const krDesc = (row[colKrDesc] || "").trim();
        const yearsStr = colYears >= 0 ? (row[colYears] || "").trim() : "";
        if (!objNum || !objTitle) continue;

        const years = yearsStr ? yearsStr.split(";").map((y: string) => parseInt(y.trim())).filter((y: number) => !isNaN(y)) : [];

        if (!objMap.has(objNum)) objMap.set(objNum, { number: objNum, title: objTitle, keyResults: [], years });
        const obj = objMap.get(objNum)!;
        if (krNum && krDesc) obj.keyResults.push({ number: krNum, description: krDesc });
      }

      res.json({
        objectives: Array.from(objMap.values()),
        totals: { objectives: objMap.size, keyResults: Array.from(objMap.values()).reduce((n, o) => n + o.keyResults.length, 0) },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Confirm University Objectives CSV — creates records
  app.post("/api/setup/confirm/objectives", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData) return res.status(400).json({ error: "CSV data is required" });

      const rows = parseCSV(csvData);
      const headers = rows[0].map((h: string) => h.trim().toLowerCase());
      const colObjNum = headers.indexOf("objective number");
      const colObjTitle = headers.indexOf("objective title");
      const colKrNum = headers.indexOf("key result number");
      const colKrDesc = headers.indexOf("key result description");
      const colYears = headers.indexOf("applicable years");

      interface ObjEntry { number: string; title: string; keyResults: { number: string; description: string; sortOrder: number }[]; years: number[]; sortOrder: number }
      const objMap = new Map<string, ObjEntry>();
      let objOrder = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        const objNum = (row[colObjNum] || "").trim();
        const objTitle = (row[colObjTitle] || "").trim();
        const krNum = (row[colKrNum] || "").trim();
        const krDesc = (row[colKrDesc] || "").trim();
        const yearsStr = colYears >= 0 ? (row[colYears] || "").trim() : "";
        if (!objNum || !objTitle) continue;
        const years = yearsStr ? yearsStr.split(";").map((y: string) => parseInt(y.trim())).filter((y: number) => !isNaN(y)) : [];
        if (!objMap.has(objNum)) { objMap.set(objNum, { number: objNum, title: objTitle, keyResults: [], years, sortOrder: objOrder++ }); }
        const obj = objMap.get(objNum)!;
        if (krNum && krDesc) obj.keyResults.push({ number: krNum, description: krDesc, sortOrder: obj.keyResults.length });
      }

      const created = { objectives: 0, keyResults: 0 };
      for (const obj of Array.from(objMap.values())) {
        const label = `${obj.number}: ${obj.title}`;
        const newObj = await storage.createUniversityObjective({
          label, description: obj.title, sortOrder: obj.sortOrder, applicableYears: obj.years, isActive: true,
        });
        created.objectives++;
        for (const kr of obj.keyResults) {
          await storage.createUniversityKeyResult({
            objectiveId: newObj.id, label: `KR ${obj.number}.${kr.number}`, description: kr.description, sortOrder: kr.sortOrder,
          });
          created.keyResults++;
        }
      }

      res.json({ success: true, created });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Mark setup as complete
  app.post("/api/setup/complete", requireAdmin, async (req, res) => {
    await storage.setSetting("setup_completed", "true");
    res.json({ success: true });
  });

  // System Reset — requires super_admin role, clears all organizational data
  app.post("/api/setup/reset", requireAdmin, async (req, res) => {
    const staffId = (req.session as any).staffId;
    if (staffId) {
      const staffMember = await storage.getStaff(staffId);
      if (!staffMember || staffMember.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can perform a system reset" });
      }
    } else if (!(req.session as any).isAdmin) {
      return res.status(403).json({ error: "Only super admins can perform a system reset" });
    }

    // Delete all transactional and organizational data in dependency order
    await db.delete(editLogs);
    await db.delete(okrResponsibilities);
    await db.delete(quarterlyUpdates);
    await db.delete(unmatchedScores);
    await db.delete(okrs);
    await db.delete(leaderBasicAssignments);
    await db.delete(staffSpuAssignments);
    await db.delete(staff);
    await db.delete(universityKeyResults);
    await db.delete(universityObjectives);
    await db.delete(subUnits);
    await db.delete(spus);

    await storage.setSetting("setup_completed", "false");

    // Destroy the current session so the admin is re-authenticated fresh
    req.session.destroy(() => {});
    res.json({ success: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
