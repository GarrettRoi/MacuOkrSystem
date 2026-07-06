---
name: Plan year period tagging
description: How OKR periods are tagged (Plan Year + Fiscal Quarter) vs how they are stored
---

# Plan year period tagging

OKRs and quarterly_updates store the period as `(quarter: text, year: int)` where
`year` is the **calendar year** the quarter falls in. The UI presents periods as
Plan Year + Fiscal Quarter. Labels include month ranges and both relevant years:
plan years show two years (e.g. `Year 1 (24-25)`) and quarter tags include the
fiscal month range (`Q1 Jun-Aug, 24`, `Q3 Dec-Feb, 24/25` — Q3 crosses calendar
years). Derived from the configured strategic plan start year
(`/api/settings/strategic-plan-start-year`, default 2024). The fiscal year runs
June–May (Year 1 = Jun startYear – May startYear+1). Month ranges live in
`QUARTER_MONTHS` in `shared/schema.ts`; quarter Select dropdowns render the tag
directly (do NOT re-append `q.label` months or labels double up).

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
  `getPlanningYear(quarter, year, startYear)`, labels via `formatPlanYearLabel`,
  quarter ticks via `formatQuarterTagForPlanYear`.
- Plan-year dropdown OPTIONS are NOT hardcoded (the old `PLANNING_YEARS=[1,2,3,4]`
  wrongly showed a phantom Year 4). They come from `GET /api/planning-years` via
  the `usePlanningYears()` hook, which returns two lists: `submission` (plan years
  whose PRIMARY/start calendar year is configured in the admin Years tab) and
  `viewing` (`submission` ∪ any plan year that still has stored data). Use
  `submission` for NEW writes (submit-okr, quarterly-update selectors) and
  `viewing` for every view/filter/export/edit dropdown. `PLANNING_YEARS` const
  still exists in schema.ts but must not drive dropdowns.
- **Why:** future plan years without a configured Year must not be selectable, but
  historical plan years with data must stay visible in filters. A Q3/Q4 rollover
  year (e.g. Q3 2027 = plan year 3 when start=2024) is a valid data year, not a
  primary — deriving from `getPlanningYear` handles this automatically.
- **Guarding writes:** the dropdown alone is not enough — submit-okr also seeds a
  default plan year from clamped fiscal math, so it must snap that default onto
  the `submission` list once it loads AND reject on submit if the chosen year is
  not in `submission`. quarterly-update needs no such guard: its plan-year selector
  only filters existing OKRs and the submitted period comes from the chosen OKR.
- Invalidate `["/api/planning-years"]` whenever the Years tab changes (add/delete
  year) or the strategic plan start year changes, alongside their own keys.
- Server `computeAnalyticsData` rolls `okr_count_by_year` up by plan year and tags
  per-quarter series with `formatQuarterTag` when a calendar year is in scope.
- Deliberately left as literal calendar years: the university-achievement objective
  drilldown filter and raw CSV import/matching diagnostics — these reconcile
  against source data.
- Deep links must recompute the plan-year label once the async start-year setting
  loads (don't hardcode 2024). Anything reading that setting must use the snake_case
  key `strategic_plan_start_year` — a camelCase variant silently defaults to 2024.
