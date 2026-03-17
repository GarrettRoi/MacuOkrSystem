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
- **Authentication & Authorization**: A dual password-based system provides Admin and Staff access levels, with role-based access control (super_admin, leader, basic). Optionally, OneLogin OIDC SSO can be enabled — staff are matched by email address and logged in automatically. SSO is toggled in the Admin Settings tab. An "Admin Login" escape hatch at the bottom of the login page allows admin password login when SSO is active. SSO credentials can be provided via DB settings or environment variables (`SSO_ISSUER_URL`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`). Callback URL: `/api/auth/sso/callback`.
- **Key Pages**:
    - **Submit OKR**: Form for creating OKRs with multi-select for university strategic objectives and key results (stored as JSON arrays in text columns), plus dynamic key results.
    - **Quarterly Update**: Interface for updating OKR progress with individual key result scoring and notes.
    - **Dashboard**: Analytical view with summary metrics, departmental performance, and status distribution.
    - **Employee Progress**: Detailed, filterable spreadsheet-style view of OKR progress per employee, showing objective statements, strategic alignments, responsible parties, and progress percentages.
    - **Admin**: Management interface for staff, departments, and sub-departments.
    - **Export**: CSV data export functionality.
    - **CSV Import (OKRs)**: 3-step import flow (upload → preview/edit → confirm) for OKR submission spreadsheets. Automatic duplicate detection checks against existing DB OKRs (by resolved staff+SPU+quarter+year+OKR#) and within-CSV duplicates. Duplicates are highlighted amber, auto-deselected, and marked with "DUP" badge. Server-side dedup guard in confirm endpoint as a safety net. Backend endpoints: POST `/api/import/csv/preview` and `/api/import/csv/confirm`.
    - **CSV Import (Scores)**: Separate 3-step import flow for OKR score/quarterly update spreadsheets. Matches scores to existing OKRs by SPU, sub-unit, quarter, year, and OKR number using fuzzy matching. Parses KR scores (1-4) plus overflow KR column. Preview shows matched OKR details (objective statement, key results, staff) and nearby candidate OKRs for unmatched rows. Manual OKR linking via search dialog with filters (SPU auto-set from score row, quarter, year, text search). Automatic duplicate detection checks against existing quarterly updates (by okrId+quarter+year) and within-CSV duplicates; also rechecks on manual linking. Server-side dedup guard in confirm endpoint. Unmatched rows (no auto-matched OKR) are saved to `unmatched_scores` table instead of discarded. Backend endpoints: POST `/api/import/scores/preview`, `/api/import/scores/confirm`, and GET `/api/okrs/search`.
    - **Pending Matches**: Dedicated tab in Data Management for manually matching saved unmatched scores to OKRs. Split-panel UI: left side lists pending scores (filterable by SPU, quarter, year) with KR score summaries and Dismiss option; right side is an OKR browser with search and filters (SPU auto-populated from selected score). Selecting a score and clicking "Match" creates the quarterly update and removes the score from the pending queue. Backend endpoints: GET `/api/unmatched-scores`, POST `/api/unmatched-scores/:id/match`, DELETE `/api/unmatched-scores/:id`. Schema: `unmatched_scores` table stores pending scores with status "pending"/"matched"/"dismissed".
- **Strategic Planning Year Tracking**: Configurable start year (stored in `appSettings` table) maps calendar quarters to planning years (Year 1-4). Logic: Q1/Q2 of calendar year maps to `calendarYear - startYear + 1`; Q3/Q4 maps to `calendarYear - startYear`. Planning year filter available on all data pages (dashboard, my-okrs, university-achievement, data, employee-progress, export, trends). Utility functions `getPlanningYear()`, `getPlanningYearLabel()`, `getCalendarYearsForPlanningYear()` in `shared/schema.ts`. API: GET/PUT `/api/settings/strategic-plan-start-year`. Admin UI for configuring start year in Settings tab.
- **Strategic Advancement Dashboard** (Admin → Strategic Planning tab, super admin only): Sliders (0–100%) and number inputs for each university key result's progress percentage; auto-saves on slider release or input blur. Comment textareas per objective auto-save on blur. "Update Last Updated Date" button stamps the current date. All changes immediately reflected on the Strategic Advancement tab of University Achievement.
- **Strategic Advancement Tab** (University Achievement): Displays each active university objective with its key results, progress bars, and percentage numbers. Below each objective, shows the comment paragraph entered by the admin. Date at top center shows when it was last updated (set by admin button). Data endpoints: `GET /api/strategic-advancement`, `PUT /api/strategic-advancement/progress/:keyResultId`, `PUT /api/strategic-advancement/comment/:objectiveId`, `POST /api/strategic-advancement/update-date`. Schema: `university_key_result_progress` (keyResultId PK, progressPercent) and `university_objective_comments` (objectiveId PK, comment) tables.
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