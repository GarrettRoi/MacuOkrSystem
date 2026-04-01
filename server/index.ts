import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./storage";
import { pool } from "./db";

async function runStartupMigrations() {
  const client = await pool.connect();
  try {
    // Safely add columns that may be missing in older or external databases.
    // Each statement uses IF NOT EXISTS so it is safe to run repeatedly.
    const migrations = [
      `ALTER TABLE staff ADD COLUMN IF NOT EXISTS hashed_password TEXT`,
      `ALTER TABLE invite_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMP`,
    ];
    for (const sql of migrations) {
      await client.query(sql);
    }
    log("startup migrations: OK");
  } catch (err: any) {
    console.error("startup migration error:", err.message);
  } finally {
    client.release();
  }
}

const app = express();

// Trust Railway/Heroku/Render proxy so secure session cookies work behind HTTPS load balancers
app.set('trust proxy', 1);

declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
    selectedStaffId?: string;
    selectedStaffName?: string;
    sessionVersion?: number;
    ssoState?: string;
    ssoCodeVerifier?: string;
  }
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run schema migrations before anything else so every environment
  // (Replit, Railway, Render, etc.) stays in sync automatically.
  await runStartupMigrations();

  const server = await registerRoutes(app);

  // Seed core super-admin accounts on every startup
  await seedDatabase();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
