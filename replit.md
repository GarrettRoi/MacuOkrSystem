# MACU OKR Tracking System

## Overview

The MACU OKR Tracking System is a web application for Mid-America Christian University to manage Objectives and Key Results (OKRs). It allows staff to submit OKRs, provide quarterly progress updates, and visualize performance through dashboards. Key capabilities include a password-protected interface, staff selection, comprehensive data visualization, and administrative tools for organizational structure management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend uses React with TypeScript, Vite for bundling, and Wouter for routing. UI components are built with shadcn/ui on Radix UI, following a "New York" style variant and Material Design principles. Styling is managed with Tailwind CSS. State management utilizes TanStack Query for server state and React Hook Form with Zod for form management. Data visualization is handled by Recharts.

### Backend

The backend is built with Node.js and Express.js, using TypeScript. It provides a RESTful API for managing OKRs, staff, departments, and quarterly updates. A storage abstraction layer `IStorage` is defined for flexible data persistence.

### Data Storage

PostgreSQL is used as the database, accessed via Drizzle ORM and Neon Database's serverless driver. The schema includes tables for `departments`, `sub_departments`, `staff`, `okrs`, `quarterly_updates`, and `okr_responsibilities`. OKRs are SPU-centric (belong to departments) rather than individual users, allowing for collaborative tracking. Data validation uses Zod schemas generated from Drizzle.

### Core Features

- **SPU Selection**: Staff can submit OKRs for various departments/sub-departments, distinguishing between their primary assignment and the OKR's submission SPU.
- **Multi-SPU Assignments**: Leaders and super admins can be assigned to manage multiple SPUs beyond their primary assignment. This is managed via the Admin panel's staff management section (gear icon).
- **Authentication & Authorization**: A dual password-based system provides Admin and Staff access levels, with role-based access control (super_admin, leader, basic). Optionally, OneLogin OIDC SSO can be enabled — staff are matched by email address and logged in automatically. SSO is toggled in the Admin Settings tab. An "Admin Login" escape hatch at the bottom of the login page allows admin password login when SSO is active. SSO credentials can be provided via DB settings or environment variables (`SSO_ISSUER_URL`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`). Callback URL: `/api/auth/sso/callback`. Email lookup is case-insensitive. Session `isAdmin` is derived from `role === "super_admin"` (not the `is_admin` DB column).
- **Session Storage**: Sessions are stored in PostgreSQL via `connect-pg-simple` (table: `"session"`). This ensures sessions survive server restarts and work correctly across deployments. The `session` table is created automatically on startup. Cookie: 7-day maxAge, `sameSite: 'lax'`, `secure: true` in production.
- **Key Pages**:
    - **Submit OKR**: Form for creating OKRs with multi-select for university strategic objectives and key results (stored as JSON arrays in text columns), plus dynamic key results.
    - **Quarterly Update**: Interface for updating OKR progress with individual key result scoring and notes.
    - **Dashboard**: Analytical view with summary metrics, departmental performance, and status distribution.
    - **University Achievement**: Multi-tab page with Dashboard (SPU progress cards — clicking an SPU card expands to show sub-units and individual OKRs in a drilldown table), Objective Results (university strategic objective selector with aligned OKR table, filterable by year/quarter/SPU), Analytics (year-over-year trends), and Strategic Advancement (multi-year line chart).
    - **Employee Progress**: Detailed, filterable spreadsheet-style view of OKR progress per employee, showing objective statements, strategic alignments, responsible parties, and progress percentages.
    - **Admin**: Management interface for staff, departments, and sub-departments.
    - **Export**: CSV data export functionality.
    - **CSV Import (OKRs)**: 3-step import flow (upload → preview/edit → confirm) for OKR submission spreadsheets. Automatic duplicate detection checks against existing DB OKRs (by resolved staff+SPU+quarter+year+OKR#) and within-CSV duplicates. Duplicates are highlighted amber, auto-deselected, and marked with "DUP" badge. Server-side dedup guard in confirm endpoint as a safety net. Backend endpoints: POST `/api/import/csv/preview` and `/api/import/csv/confirm`.
    - **CSV Import (Scores)**: Separate 3-step import flow for OKR score/quarterly update spreadsheets. Matches scores to existing OKRs by SPU, sub-unit, quarter, year, and OKR number using fuzzy matching. Parses KR scores (1-4) plus overflow KR column. Preview shows matched OKR details (objective statement, key results, staff) and nearby candidate OKRs for unmatched rows. Manual OKR linking via search dialog with filters (SPU auto-set from score row, quarter, year, text search). Automatic duplicate detection checks against existing quarterly updates (by okrId+quarter+year) and within-CSV duplicates; also rechecks on manual linking. Server-side dedup guard in confirm endpoint. Unmatched rows (no auto-matched OKR) are saved to `unmatched_scores` table instead of discarded. Backend endpoints: POST `/api/import/scores/preview`, `/api/import/scores/confirm`, and GET `/api/okrs/search`.
    - **Pending Matches**: Dedicated tab in Data Management for manually matching saved unmatched scores to OKRs. Split-panel UI: left side lists pending scores (filterable by SPU, quarter, year) with KR score summaries and Dismiss option; right side is an OKR browser with search and filters (SPU auto-populated from selected score). Selecting a score and clicking "Match" creates the quarterly update and removes the score from the pending queue. Backend endpoints: GET `/api/unmatched-scores`, POST `/api/unmatched-scores/:id/match`, DELETE `/api/unmatched-scores/:id`. Schema: `unmatched_scores` table stores pending scores with status "pending"/"matched"/"dismissed".
- **Strategic Planning Year Tracking**: Configurable start year (stored in `appSettings` table) maps calendar quarters to planning years (Year 1-4). Logic: Q1/Q2 of calendar year maps to `calendarYear - startYear + 1`; Q3/Q4 maps to `calendarYear - startYear`. Planning year filter available on all data pages (dashboard, my-okrs, university-achievement, data, employee-progress, export, trends). Utility functions `getPlanningYear()`, `getPlanningYearLabel()`, `getCalendarYearsForPlanningYear()` in `shared/schema.ts`. API: GET/PUT `/api/settings/strategic-plan-start-year`. Admin UI for configuring start year in Settings tab.
- **Strategic Advancement Dashboard** (Admin → Strategic Planning tab, super admin only): Sliders (0–100%) and number inputs for each university key result's progress percentage; auto-saves on slider release or input blur. Comment textareas per objective auto-save on blur. "Update Last Updated Date" button stamps the current date. All changes immediately reflected on the Strategic Advancement tab of University Achievement.
- **Time-Series Progress Chart** (Admin → Strategic Planning tab, super admin only): Below the slider section, a "Time-Series Progress Chart" card allows admins to: (1) set a start and end quarter/year for the chart range via "Save Range" button; (2) enter a grid of progress percentages (0–100) where rows = quarters in the range and columns = all active key results (color-coded by objective label); (3) click "Save Chart Data" to persist all values. Empty cells remove any existing data point for that period. API: `GET/PUT /api/strategic-advancement/chart/range`, `POST /api/strategic-advancement/chart/datapoints`. Schema: `university_progress_datapoints` table (id, keyResultId, quarter, year, progressPercent). Range stored in `app_settings` key `strategic_chart_range` as JSON.
- **Strategic Advancement Tab** (University Achievement): Replaced the progress-bar view with a multi-year line chart. When chart data is configured, shows: (1) an item-selector panel where users can toggle any university objective (shown as average of its KR values) or any individual key result as a separate line; (2) a Recharts LineChart with X-axis = quarter labels, Y-axis = 0–100%, distinct colored lines per selected item (objectives = solid thicker, KRs = dashed thinner), tooltip with percentages, and a 100% reference line; (3) comment cards per objective (if comments were entered). When no chart data is configured, shows a placeholder message. Data fetched from `GET /api/strategic-advancement/chart`. Utility functions `generateQuarterPeriods()` and `CHART_COLORS` exported from `client/src/lib/utils.ts`.
- **CSV Import in Admin (SPUs & Objectives)**: After initial setup, admins can bulk-import additional SPUs/sub-units/staff via "Import CSV" button in the SPUs & Sub-Units tab, and import university objectives via "Import CSV" button in the Strategic Planning tab. Both reuse the setup wizard backend endpoints (`/api/setup/preview/spu-staff`, `/api/setup/confirm/spu-staff`, `/api/setup/preview/objectives`, `/api/setup/confirm/objectives`) with a 3-step dialog (upload → preview → confirm). Existing records are not removed.
- **Initial Setup Wizard**: A multi-step setup wizard (`/setup` page via `client/src/pages/setup.tsx`) is shown to new deployments before staff selection. Walks admins through: Step 1 — SPU & Staff import (CSV with headers: SPU Name, Sub-Unit Name, SPU Admin Name, Sub-Unit Team Members); Step 2 — University Objectives import (CSV with headers: Objective Number, Objective Title, Key Result Number, Key Result Description, Applicable Years). Each step shows a format example, has a template CSV download button (headers only), and a 2-phase upload→preview→confirm flow. Setup completion tracked via `app_settings` key `setup_completed`. Auto-detection fallback: if flag is absent but SPUs exist, treats system as already set up. Backend endpoints: `GET /api/setup/status`, `POST /api/setup/preview/spu-staff`, `POST /api/setup/confirm/spu-staff`, `POST /api/setup/preview/objectives`, `POST /api/setup/confirm/objectives`, `POST /api/setup/complete`, `POST /api/setup/reset`, `GET /api/setup/example-csv/:type`.
- **System Reset**: Super admin only button in Admin → Settings tab, behind two confirmation dialogs. Calls `POST /api/setup/reset` which deletes all organizational data (staff, SPUs, sub-units, OKRs, quarterly updates, unmatched scores, edit logs, university objectives) and resets the `setup_completed` flag. System settings (passwords, SSO, strategic plan year) are preserved. After reset, session is destroyed and the user is redirected to the setup wizard on next login.

## External Dependencies

### UI Component Libraries
- Radix UI
- shadcn/ui
- Lucide React
- cmdk
- Recharts
- embla-carousel-react
- vaul

### Form and Validation
- React Hook Form
- Zod
- drizzle-zod

### Database and ORM
- Drizzle ORM
- @neondatabase/serverless
- drizzle-kit

### Styling
- Tailwind CSS
- autoprefixer
- class-variance-authority
- clsx
- tailwind-merge

### State Management
- @tanstack/react-query

### Utilities
- date-fns
- wouter

### Development Tools
- Vite
- TypeScript
- tsx
- esbuild

### Fonts
- Google Fonts CDN (Inter, Roboto)

## Production Deployment (Railway)

The app is deployed on Railway via GitHub auto-deploy. Key details:

- **Project ID**: `a1d40d61-f4b4-4eb7-880f-67ee21462fe0` (env var: `RAILWAY_PROJECT_ID`)
- **Environment ID**: `601d064a-7b1d-49c3-8f38-055d46a574c4` (env var: `RAILWAY_PROD_ENV_ID`)
- **Service ID** (app): `69f7017e-0109-47c2-a113-07393e1eab6a` (env var: `RAILWAY_PROD_SERVICE_ID`)
- **DB Proxy**: `ballast.proxy.rlwy.net:16917` (env var: `RAILWAY_PROD_DB_PROXY`)
- **Railway API Token**: Stored by user; ask user for `RAILWAY_API_TOKEN` if needed for debugging sessions

### Schema Sync Strategy

Railway does NOT run `db:push` — schema is managed entirely by `runStartupMigrations()` in `server/index.ts`. This function runs on every boot and:
1. Creates any missing tables (`CREATE TABLE IF NOT EXISTS`)
2. Adds any missing columns (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`)
3. Each statement runs independently so one failure never blocks the rest

**When adding a new table or column to `shared/schema.ts`**, always add a corresponding entry to `runStartupMigrations()` in `server/index.ts` so it propagates to Railway automatically on the next deploy.

### Debugging Production

Use the Railway API token + proxy DB URL to connect directly:
```javascript
// In code_execution notebook:
const resp = await fetch('https://backboard.railway.app/graphql/v2', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${RAILWAY_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `query { variables(projectId: "...", environmentId: "...", serviceId: "...") }` })
});
// Use DATABASE_URL from response with proxy host to connect via pg Client
```