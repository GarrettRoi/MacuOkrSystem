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
- The plan-year<->calendar-year derivation and its inverse (in `shared/schema.ts`)
  MUST stay exact inverses, or derived calendar years won't match stored rows.
- Forms pick Plan Year + Fiscal Quarter, then derive the calendar `year`
  client-side before POSTing; filters/exports filter by plan year + quarter, not
  a standalone calendar year.
- Comparison charts (standalone trends page + university-achievement Dashboard/
  Trends tabs) compare plan year vs plan year: bucket OKRs with
  `getPlanningYear(quarter, year, startYear)`, options from `PLANNING_YEARS`,
  labels via `formatPlanYearLabel`, quarter ticks via `formatQuarterTagForPlanYear`.
- Server `computeAnalyticsData` rolls `okr_count_by_year` up by plan year and tags
  per-quarter series with `formatQuarterTag` when a calendar year is in scope.
- Deliberately left as literal calendar years: the university-achievement objective
  drilldown filter and raw CSV import/matching diagnostics — these reconcile
  against source data.
- Deep links must recompute the plan-year label once the async start-year setting
  loads (don't hardcode 2024). Anything reading that setting must use the snake_case
  key `strategic_plan_start_year` — a camelCase variant silently defaults to 2024.
