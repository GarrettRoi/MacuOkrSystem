---
name: Dev server reload behavior
description: Server code changes require a workflow restart; only the client hot-reloads
---

The dev workflow runs `tsx server/index.ts` without watch mode. Vite HMR only applies to `client/` code.

**Why:** After editing `server/routes.ts`, curl tests hit the *old* server code and produced confusing results (an empty response that looked like a bug) until the workflow was restarted.

**How to apply:** Always restart the "Start application" workflow before curl-testing any change under `server/`.
