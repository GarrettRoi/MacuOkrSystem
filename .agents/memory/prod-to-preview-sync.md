---
name: Production-to-preview data sync
description: How the Railway prod DB is mirrored into the Replit preview DB, and the schema-drift + safety constraints that govern it.
---

# Railway production → Replit preview data sync

A daily job pulls all editable-data tables from the hosted Railway Postgres
(`RAILWAY_DATABASE_URL`) into this environment's DB, overwriting it. Data only —
never code, never the production DB.

## Schema drift is expected and must be tolerated
The preview/dev Drizzle schema runs ahead of production (prod lags behind merged
migrations). So a Drizzle column-explicit `SELECT` against production FAILS when
the local schema has a column prod doesn't (seen with `acted_by_staff_id` on
`okrs`/`quarterly_updates`).

**Rule:** read production with raw `SELECT *` then map DB column names →
Drizzle property names via `getTableColumns`/`getTableName`. Drop prod columns
absent locally; omit local columns absent in prod (insert uses defaults/null).
Do NOT read production through a Drizzle column-explicit select.

**Why:** keeps the sync working across drift in either direction without
hand-maintaining per-table column lists.

## Safety: never write/wipe the source (production)
Guards before any replace, all fail-closed:
- refuse if `RAILWAY_DATABASE_URL` unset, or `NODE_ENV==='production'` (the app
  itself deploys on Railway = prod; sync must only run in dev/preview).
- string-equality check `DATABASE_URL === RAILWAY_DATABASE_URL` is NOT enough —
  two different URLs (proxy vs direct, reordered params) can point at the same
  physical DB. Also compare DB *identity*: `system_identifier` from
  `pg_control_system()` + `current_database()`. Refuse if they match.

## Order-of-operations gotcha
`app_settings` is one of the wiped+replaced tables. Persist sync metadata
(`last_prod_sync_at`) AFTER `replaceAllData`, and re-run `seedDatabase()` after
the wipe so super-admin access is never lost.

## Reuse
The wipe+insert transaction lives in `storage.replaceAllData(snapshot)`
(extracted from `restoreBackup`); the backup/restore system covers the same
table set, so keep the two in lockstep when tables are added/removed.
