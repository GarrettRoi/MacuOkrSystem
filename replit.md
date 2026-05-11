# MACU OKR Tracking System

## Overview

The MACU OKR Tracking System is a web application designed for Mid-America Christian University to streamline the management of Objectives and Key Results (OKRs). It facilitates OKR submission, quarterly progress updates, and performance visualization through interactive dashboards. The system aims to provide a secure, comprehensive platform for staff to track and analyze organizational performance, supporting strategic planning and accountability.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is developed with React and TypeScript, utilizing Vite for efficient bundling and Wouter for routing. UI components are built using shadcn/ui on Radix UI, adhering to a "New York" style variant and Material Design principles, with styling managed by Tailwind CSS. State management is handled by TanStack Query for server-side data and React Hook Form with Zod for form validation. Data visualization capabilities are powered by Recharts.

### Backend

The backend is constructed with Node.js and Express.js, written in TypeScript. It exposes a RESTful API to manage OKRs, staff, departments, and quarterly updates. A flexible `IStorage` abstraction layer is implemented to allow for various data persistence solutions.

### Data Storage

PostgreSQL serves as the primary database, accessed via Drizzle ORM and Neon Database's serverless driver. The database schema includes tables for `departments`, `sub_departments`, `staff`, `okrs`, `quarterly_updates`, `okr_responsibilities`, and `session` (for session management). OKRs are structured around departments (SPUs) rather than individual users to foster collaborative tracking. Data validation leverages Zod schemas generated from Drizzle.

### Core Features

-   **SPU-Centric OKRs**: OKRs are tied to departments and sub-departments, allowing for clear organizational alignment.
-   **Role-Based Access Control**: Supports Admin and Staff access levels with `super_admin`, `leader`, and `basic` roles. Optionally integrates with OneLogin OIDC SSO for authentication.
-   **Comprehensive Dashboards**: Provides analytical views including summary metrics, departmental performance, and strategic advancement tracking with multi-year line charts.
-   **OKR Management**: Functionality for submitting new OKRs, providing quarterly progress updates, and viewing detailed employee progress.
-   **CSV Import/Export**: Supports bulk import of OKRs and scores via CSV, including duplicate detection and manual linking for unmatched scores. Data can also be exported in CSV format.
-   **Strategic Planning Year Tracking**: Configurable planning year settings to align calendar quarters with strategic planning cycles.
-   **Initial Setup Wizard**: A guided setup process for new deployments to import organizational structure and university objectives.
-   **System Reset**: A super admin feature to clear organizational data and reset the system to its initial setup state.
-   **Daily Backup & Rollback System**: A `data_backups` table stores JSON snapshots of all editable data. A `node-cron` job runs at midnight daily to create automatic backups, pruning entries older than 30 days. Super admins can create manual backups and restore any snapshot via the "Backups & Restore" tab in the Data Management page. Restoration replaces all covered tables in a single transaction (in FK dependency order). API routes (`GET/POST /api/backups`, `POST /api/backups/:id/restore`) are guarded to `super_admin` only.
-   **Role-Scoped Admin Tabs**: The Admin page's "Staff Management" and "SPUs & Sub-Units" tabs are rendered only for `super_admin`; leaders default to the "My Team" tab and never see those management dashboards. From My Team, leaders use the "Add Team Member" dialog to create a basic user by name + email; when a leader manages more than one SPU the dialog shows an SPU selector limited to those managed SPUs (otherwise it stays hidden and defaults to their primary), and the sub-unit selector is filtered to the chosen SPU. The server validates that leaders can only create users in SPUs they manage and that the chosen sub-unit belongs to that SPU. Created users automatically get a `leader_basic_assignment` so they appear in the leader's My Team list and remain visible in super_admin Staff Management. Leaders can also Edit each team member's name/email/SPU/sub-unit via a slim dialog on the My Team row; `PUT /api/staff/:id` enforces that the target is a basic user already assigned to the leader, that both current and destination SPU are within the leader's managed set, and that any sub-unit belongs to that SPU — role/isAdmin can never be changed by a leader. `POST /api/leader-assignments` likewise restricts leaders to claiming basic users whose primary SPU is in their managed set. Leaders also have a dedicated "My SPUs" tab (`tab-myspus`, leaders only) that lists every SPU they manage (primary + assigned via `staff_spu_assignments`) along with the sub-units inside each, with an inline "Add Sub-Unit" button per SPU that pre-fills the parent. The same Add Sub-Unit dialog is also available from the My Team header; in both entry points the parent-SPU dropdown is filtered to the leader's managed SPUs, and `POST /api/sub-units` enforces this server-side. Editing, deleting, promoting, or moving sub-units remains restricted to admins/super_admins.
-   **Sub-Unit-Scoped OKR Visibility**: Basic users with a `subUnitId` only see, submit, and score OKRs for that sub-unit. The OKR submission form locks both SPU and sub-unit selectors for these users, the quarterly update screen filters by sub-unit (including the My OKRs deep-link), and `POST /api/okrs` and `POST /api/quarterly-updates` enforce role-based authorization server-side (anonymous requests are rejected; basic users are pinned to their SPU/sub-unit; leaders are pinned to their primary + assigned SPUs).
-   **Web Push Announcements**: Super admins can broadcast push notifications via Admin → Announcements (title + body + optional URL). VAPID keypair is generated once and persisted in `app_settings` (`vapid_public_key` / `vapid_private_key`); the VAPID `subject` is resolved per send to a current super_admin email (preferring `amanda.harris@macu.edu`, falling back to any super_admin, then to a hardcoded mailto fallback). Service worker at `client/public/sw.js` handles `push` and `notificationclick`. Bell toggle in the app header lets any authenticated staff opt in/out. Audience options: **All subscribers**, **Specific SPUs** (multi-select, with a "Select SPUs missing score" helper that fills the list from `spusMissingScore(quarter, year)`), or **SPUs missing a score this quarter** (recipients computed at send time). Recipient resolution unions a SPU's primary staff with anyone assigned via `staff_spu_assignments`. Notifications fire even when the tab is closed (standard Web Push). Schema: `push_subscriptions` (FK staff cascade, unique endpoint) and `announcements` (sender, audience metadata, recipient/success/failure counts). API: `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe` (auth required); `GET /api/announcements`, `POST /api/announcements`, `GET /api/announcements/spus-missing-score?quarter&year` (super_admin only). Dead subscriptions (HTTP 404/410) are auto-pruned on send.
-   **Genius Animation**: A brief one-time-per-session overlay flashes the word "Genius" in big red letters on the home page right after login. Toggleable by super admins under Admin → Settings (`show_genius_animation`, defaults ON). Backed by `GET/PUT /api/settings/show-genius-animation` and gated client-side via `sessionStorage` flag plus `isSuccess` of the setting query so disabled accounts never flash the overlay.

## External Dependencies

### UI Component Libraries
-   Radix UI
-   shadcn/ui
-   Lucide React
-   cmdk
-   Recharts
-   embla-carousel-react
-   vaul

### Form and Validation
-   React Hook Form
-   Zod
-   drizzle-zod

### Database and ORM
-   Drizzle ORM
-   @neondatabase/serverless
-   drizzle-kit

### Styling
-   Tailwind CSS
-   autoprefixer
-   class-variance-authority
-   clsx
-   tailwind-merge

### State Management
-   @tanstack/react-query

### Utilities
-   date-fns
-   wouter

### Development Tools
-   Vite
-   TypeScript
-   tsx
-   esbuild

### Fonts
-   Google Fonts CDN (Inter, Roboto)