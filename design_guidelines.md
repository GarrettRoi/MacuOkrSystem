# MACU OKR System Design Guidelines

## Design Approach
**Selected Approach:** Design System - Material Design adapted for institutional use

**Rationale:** This is a data-intensive productivity tool requiring clear hierarchy, efficient form design, and robust data visualization. Material Design provides excellent patterns for forms, tables, dashboards, and charts while maintaining professional institutional aesthetics.

## Core Design Principles
1. **Clarity First:** Information hierarchy prioritizes comprehension over decoration
2. **Institutional Trust:** Professional, authoritative aesthetic appropriate for university context
3. **Efficiency-Focused:** Minimize clicks, maximize information density where appropriate
4. **Data Transparency:** Charts and progress indicators as primary visual elements

---

## Typography System

**Primary Font:** Inter or Roboto via Google Fonts CDN
**Secondary Font:** (same family, different weights)

**Hierarchy:**
- Page Titles: text-3xl font-bold (department dashboards, main views)
- Section Headers: text-2xl font-semibold (form sections, card headers)
- Subsections: text-xl font-medium (table headers, chart titles)
- Body Text: text-base font-normal (form labels, content)
- Small Text: text-sm (helper text, metadata)
- Micro Text: text-xs (timestamps, footnotes)

---

## Layout System

**Spacing Units:** Use Tailwind spacing primitives of **4, 6, 8, 12, 16** (e.g., p-4, gap-6, mb-8, py-12, mt-16)

**Container Strategy:**
- Max width: max-w-7xl for main content areas
- Form containers: max-w-3xl for optimal readability
- Dashboard cards: Full width with responsive grid

**Grid Patterns:**
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Data tables: Full width, responsive horizontal scroll on mobile
- Forms: Single column with logical grouping

---

## Component Library

### Navigation
- **Top Bar:** Fixed header with MACU logo, navigation links, user indicator (selected staff name)
- **Main Nav:** Horizontal tabs (Submit OKR | Quarterly Update | Dashboard | Admin | Export)
- **Breadcrumbs:** For deep navigation in admin/dashboard views

### Forms (Critical Component)
- **Card-based containers** with elevated shadow (shadow-lg)
- **Input groups:** Grouped related fields with pb-6 spacing between groups
- **Auto-populated fields:** Visually distinct (disabled state, light background)
- **Dropdown selectors:** For staff, department, quarter selection with search capability
- **Text areas:** Generous height for OKR descriptions (min-h-32)
- **Submit buttons:** Primary action, right-aligned, size lg
- **Helper text:** Below inputs using text-sm text-gray-600

### Dashboard Components
- **Progress Cards:** Individual staff/department cards showing completion percentage
- **Progress Bars:** Horizontal bars with percentage labels and status colors
- **Data Tables:** Striped rows, sortable columns, sticky headers
- **Chart Containers:** Elevated cards with chart title and legend
- **Filter Panel:** Sidebar or top bar with quarter/department filters

### Data Visualization
- Use Chart.js or Recharts for:
  - Horizontal bar charts (completion by department)
  - Donut charts (overall progress)
  - List views with embedded progress indicators
- **Visual Priority:** Charts should be prominent, using card elevation and ample spacing (p-8)

### Admin Interface
- **CRUD Tables:** Inline editing for staff/department management
- **Action Buttons:** Icon buttons for edit/delete with tooltips
- **Add Forms:** Modal or inline form for adding new entries

### Password Gate
- **Centered card** on branded background
- **Simple input** with large submit button
- **Error messaging** for incorrect password

### Staff Selection
- **Card-based selection grid** OR **searchable dropdown**
- Display: Name, Department, Email
- Visual confirmation on selection

---

## Page-Specific Layouts

### Password Entry (Landing)
- Centered single card (max-w-md)
- MACU logo/title at top
- Minimal, focused interface

### Staff Selection
- Card layout OR dropdown modal
- Clear visual hierarchy of staff information

### OKR Submission Form
- Single column, max-w-3xl
- Sections: Staff Info (auto-filled) → OKR Details → Timeline/Quarter
- Progress indicator if multi-step

### Quarterly Update Form
- Similar to submission form
- Shows original OKR context at top
- Update fields clearly separated from original data

### Dashboard (Primary View)
- **Top metrics row:** Total OKRs, Completion rate, Pending updates (grid-cols-3)
- **Filter section:** Quarter selector, department filter (sticky top)
- **Main content area:** 
  - Tab views: By Department | By Staff | By Quarter
  - Cards or table view toggle
  - Visual progress indicators prominent

### Admin Panel
- **Sidebar navigation:** Staff Management | Departments | Sub-departments
- **Main area:** Editable tables with inline actions

### Export View
- Simple interface with date range selector, format options, large export button

---

## Accessibility & Interaction
- All forms must have proper labels and aria-attributes
- Focus states clearly visible on all interactive elements
- Keyboard navigation support for tables and forms
- Error states and validation messaging must be immediate and clear

---

## Animations
**Use sparingly:**
- Smooth transitions on hover states (transition-colors duration-200)
- Loading states for data fetches
- Modal/dropdown appear animations (fade in)
- NO scroll-triggered or decorative animations

---

## Images
**Minimal image use** - this is a data-focused application:
- **MACU Logo:** Header/navigation and password entry page
- **No hero images** - go directly to functional interface
- **Optional:** Empty state illustrations for blank dashboards/forms