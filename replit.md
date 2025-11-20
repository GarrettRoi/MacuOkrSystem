# MACU OKR Tracking System

## Overview

The MACU OKR Tracking System is a web application designed for Mid-America Christian University to manage Objectives and Key Results (OKRs). The system enables staff members to submit OKRs, provide quarterly updates on progress, and visualize performance across departments. It features a password-protected interface with staff selection, comprehensive dashboards with data visualization, and administrative tools for managing organizational structure.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**Routing**: Wouter for client-side routing, providing a lightweight alternative to React Router.

**UI Component Library**: shadcn/ui components built on Radix UI primitives, following the "New York" style variant. This provides a comprehensive set of accessible, customizable components including forms, dialogs, tables, cards, and navigation elements.

**Design System**: Material Design adapted for institutional use, emphasizing clarity, data transparency, and efficiency. Typography uses Inter/Roboto fonts from Google Fonts. The color scheme uses HSL-based CSS variables for theming, with support for light mode (dark mode infrastructure present but not actively used).

**State Management**: 
- TanStack Query (React Query) for server state management, data fetching, and caching
- React Hook Form with Zod for form state and validation
- Local component state with React hooks for UI state

**Styling**: Tailwind CSS with custom configuration, including extended border radius, color system using CSS variables, and custom spacing units (4, 6, 8, 12, 16).

**Data Visualization**: Recharts library for rendering charts (bar charts, pie charts) in the dashboard.

### Backend Architecture

**Runtime**: Node.js with Express.js framework.

**Language**: TypeScript with ES modules.

**API Design**: RESTful API pattern with JSON request/response format. Routes are organized in `/api` namespace:
- Authentication: `/api/auth/verify`
- Staff management: `/api/staff`, `/api/staff/:id`
- Departments: `/api/departments`
- Sub-departments: `/api/sub-departments`
- OKRs: `/api/okrs`
- Quarterly updates: `/api/quarterly-updates`
- Data export: `/api/export/csv`

**Server Architecture**: 
- Single entry point (`server/index.ts`)
- Route registration pattern with separate routes file
- Request logging middleware for API endpoints
- Vite middleware integration for development hot module replacement
- Raw body capture for request verification

**Storage Abstraction**: IStorage interface pattern defined in `server/storage.ts`, allowing for flexible data persistence implementation. The interface defines methods for CRUD operations on all entities (staff, departments, sub-departments, OKRs, quarterly updates) plus password verification.

### Data Storage Solutions

**ORM**: Drizzle ORM for type-safe database operations.

**Database**: PostgreSQL (configured via `drizzle.config.ts`), using Neon Database serverless driver (`@neondatabase/serverless`).

**Schema Design**:
- **departments**: ID, name (unique)
- **sub_departments**: ID, name, departmentId (foreign key with cascade delete)
- **staff**: ID, name, email (unique), departmentId, optional subDepartmentId, isAdmin (boolean, default false)
- **okrs**: ID, staffId (foreign key with cascade delete), okrNumber, quarter, year, collaborationSpuId (optional), universityObjective, universityKeyResult, objectiveStatement, keyResults (JSON text), currentValue, status, createdAt timestamp. Legacy optional fields: title, description, targetValue
- **quarterly_updates**: ID, okrId (foreign key with cascade delete), staffId, quarter, year, progress, notes, submittedAt timestamp

**OKR Structure**:
- **okrNumber**: One of "OKR 1" through "OKR 5"
- **universityObjective**: One of 5 strategic objectives (CONNECT, ENCOURAGE, INNOVATE, WITNESS, HONOR)
- **universityKeyResult**: Selected from predefined university-level key results
- **objectiveStatement**: Free-text description of the OKR objective (min 20 characters)
- **keyResults**: JSON array of {description, percentage} objects where percentages sum to 100% (±0.01 tolerance)
- **collaborationSpuId**: Optional reference to another SPU for collaborative OKRs

**Data Validation**: Zod schemas generated from Drizzle table definitions using `drizzle-zod`, ensuring type safety between database schema and API validation.

**Migrations**: Drizzle Kit for schema migrations, output to `./migrations` directory.

### Authentication and Authorization

**Authentication Mechanism**: Dual password-based authentication system with two access levels:
- Admin password (`admin14:12`): Grants full system access including admin panel
- Staff password (`staff14:12`): Grants limited access, excludes admin features

Password verification endpoint at `/api/auth/verify` returns authentication result with `isAdmin` flag.

**Session Management**: After password verification, users select their staff profile. No traditional session/token system - selected staff and access level persist in client state.

**Authorization Model**: Role-based access control with two tiers:
- **Admin Access**: Full access to all features including admin panel, user management, and system settings
- **Staff Access**: Access to core OKR features (submit, update, view dashboard, trends, export) but restricted from admin panel

**Access Control Implementation**:
- Frontend: Conditional rendering of admin features based on `isAdmin` state
- Backend: Password-based role determination (`admin14:12` vs `staff14:12`)
- Database: Staff table includes `isAdmin` boolean field for administrative record-keeping
- UI Indicators: Admin badge displayed in header for users with admin access

### Page Architecture

**Password Gate**: Initial authentication screen requiring shared password.

**Staff Selection**: Searchable list of all staff members for profile selection.

**Home**: Dashboard showing available actions (submit OKR, quarterly update, view dashboard, admin, export).

**Submit OKR**: Form for creating new OKRs with OKR number selection, quarter/year selection, collaboration SPU (optional), university-level strategic objective, university-level key result, objective statement, and dynamic key results with percentage allocation. Supports decimal percentages with 0.01 tolerance for floating-point precision.

**Quarterly Update**: Interface for updating progress on existing OKRs with notes and progress percentage.

**Dashboard**: Analytics view with filtering by quarter/year, displaying:
- Summary metrics (total OKRs, average progress, active staff, OKRs needing updates)
- Department performance bar chart
- Status distribution pie chart
- OKRs needing attention list

**Admin**: Management interface for creating/deleting staff, departments, and sub-departments with tabbed organization.

**Export**: CSV data export functionality with quarter/year filtering.

## External Dependencies

### UI Component Libraries
- **Radix UI**: Comprehensive suite of unstyled, accessible component primitives (@radix-ui/react-*)
- **shadcn/ui**: Pre-styled components built on Radix UI following design system guidelines
- **Lucide React**: Icon library for consistent iconography
- **cmdk**: Command menu component
- **Recharts**: Declarative charting library for data visualization
- **embla-carousel-react**: Carousel/slider component
- **vaul**: Drawer component library

### Form and Validation
- **React Hook Form**: Performant form state management
- **@hookform/resolvers**: Validation resolver for React Hook Form
- **Zod**: TypeScript-first schema validation
- **drizzle-zod**: Zod schema generation from Drizzle schemas

### Database and ORM
- **Drizzle ORM**: TypeScript ORM for type-safe database queries
- **@neondatabase/serverless**: PostgreSQL serverless driver for Neon Database
- **drizzle-kit**: Migration and schema management toolkit

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **tailwindcss**: Core framework
- **autoprefixer**: PostCSS plugin for vendor prefixes
- **class-variance-authority**: Utility for managing component variants
- **clsx**: Utility for constructing className strings
- **tailwind-merge**: Utility for merging Tailwind classes

### State Management
- **@tanstack/react-query**: Async state management and data fetching

### Utilities
- **date-fns**: Date manipulation and formatting
- **wouter**: Lightweight routing library

### Development Tools
- **Vite**: Build tool and dev server
- **TypeScript**: Type-safe JavaScript
- **tsx**: TypeScript execution engine
- **esbuild**: JavaScript bundler for production builds
- **@replit/vite-plugin-***: Replit-specific development plugins (runtime error modal, cartographer, dev banner)

### Fonts
- **Google Fonts CDN**: Inter and Roboto font families loaded via CDN

### Environment
- **DATABASE_URL**: Environment variable for PostgreSQL connection string (required)