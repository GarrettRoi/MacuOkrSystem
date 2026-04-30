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
-   **Role-Scoped Admin Tabs**: The Admin page's "Staff Management" and "SPUs & Sub-Units" tabs are rendered only for `super_admin`; leaders default to the "My Team" tab and never see those management dashboards. From My Team, leaders use the "Add Team Member" dialog to create a basic user by name + email (auto-scoped to their primary SPU, with optional sub-unit selection); the server validates that leaders can only create users in SPUs they manage and that the chosen sub-unit belongs to that SPU. Created users automatically get a `leader_basic_assignment` so they appear in the leader's My Team list and remain visible in super_admin Staff Management. Leaders can also use the "Add Sub-Unit" button on the My Team header to create new sub-units inside SPUs they manage (primary + assigned); the dialog's parent-SPU dropdown is filtered to those managed SPUs, and `POST /api/sub-units` enforces this server-side. Editing, deleting, promoting, or moving sub-units remains restricted to admins/super_admins.
-   **Sub-Unit-Scoped OKR Visibility**: Basic users with a `subUnitId` only see, submit, and score OKRs for that sub-unit. The OKR submission form locks both SPU and sub-unit selectors for these users, the quarterly update screen filters by sub-unit (including the My OKRs deep-link), and `POST /api/okrs` and `POST /api/quarterly-updates` enforce role-based authorization server-side (anonymous requests are rejected; basic users are pinned to their SPU/sub-unit; leaders are pinned to their primary + assigned SPUs).
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