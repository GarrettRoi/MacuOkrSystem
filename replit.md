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
- **Authentication & Authorization**: A dual password-based system provides Admin and Staff access levels, with role-based access control (super_admin, leader, basic).
- **Key Pages**:
    - **Submit OKR**: Form for creating OKRs, including alignment with university objectives and dynamic key results.
    - **Quarterly Update**: Interface for updating OKR progress with individual key result scoring and notes.
    - **Dashboard**: Analytical view with summary metrics, departmental performance, and status distribution.
    - **Employee Progress**: Detailed, filterable spreadsheet-style view of OKR progress per employee, showing objective statements, strategic alignments, responsible parties, and progress percentages.
    - **Admin**: Management interface for staff, departments, and sub-departments.
    - **Export**: CSV data export functionality.

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