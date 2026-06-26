---
name: Plan year period tagging
description: How OKR periods are tagged (Plan Year + Fiscal Quarter) vs how they are stored
---

# Plan year period tagging

OKRs and quarterly_updates store the period as `(quarter: text, year: int)` where
`year` is the **calendar year** the quarter falls in. The UI presents periods as
Plan Year + Fiscal Quarter (e.g. `Year 1 (24)`, `Q3 (24/25)`), derived from the
configured strategic plan start year (`/api/settings/strategic-plan-start-year`,
default 2024). The fiscal year runs June–May (Year 1 = Jun startYear – May startYear+1).

**Rule:** plan year is presentation/derivation only — never migrate the DB to store it.

**Why:** changing storage would break existing rows and all server contracts
(`POST /api/okrs`, `POST /api/quarterly-updates` take `quarter, year`).

**How to apply:**
- Helpers live in `shared/schema.ts`: `getCalendarYearForQuarter` (Q1/Q2 -> start;
  Q3/Q4 -> start+1) and `getPlanningYear` (the inverse) MUST stay exact inverses,
  or derived calendar years won't match stored data.
- Forms (submit-okr, quarterly-update, my-okrs) pick Plan Year + Fiscal Quarter,
  then derive the calendar `year` client-side before POSTing.
- Display surfaces use `formatPeriodLabel` / `formatQuarterTag` /
  `formatPlanYearLabel`. Deliberately left as literal calendar years:
  calendar-year comparison charts (trends year-over-year, university-achievement
  comparisons) and raw CSV import/matching diagnostics in data.tsx.
- Deep links into quarterly-update must recompute the plan-year label once the
  async start-year setting loads (don't hardcode 2024), so non-2024 configs tag right.
