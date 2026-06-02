---
name: Auth login paths & impersonation
description: How users authenticate and the non-obvious fact that select-staff serves both genuine logins and admin impersonation.
---

# Auth login paths

There are several ways a session gets established (all in `server/routes.ts`):

- `/api/auth/login` — per-user email+password. Sets `selectedStaffId` directly → user is fully logged in, never hits select-staff.
- `/api/auth/sso/callback` — OneLogin SSO. Sets `selectedStaffId` directly → never hits select-staff.
- `/api/auth/verify` — **shared** password gate (`verifyPassword(password)` takes NO email; one org password, returns `isAdmin` based on which password matched). Sets `isAdmin` only, NO `selectedStaffId`.
- `/api/auth/enter` — no-password entry mode (only when `password_login_enabled === "false"`). Sets `isAdmin` only, NO `selectedStaffId`.

## The gotcha: select-staff is NOT only impersonation

After `verify` or `enter`, the client shows StaffSelection → `/api/auth/select-staff`. This endpoint is hit by **BOTH**:
- regular staff (`session.isAdmin === false`) picking their own profile — a **genuine login**, and
- admins (`session.isAdmin === true`) picking a profile to act as — **impersonation**.

**Why:** A natural assumption is "select-staff = admin impersonation." That is wrong and silently breaks any user-facing logic gated on genuine login (e.g. login-count tracking, first-login onboarding). The only reliable discriminator at select-staff time is `req.session.isAdmin`.

**How to apply:** When you need "genuine self-login" semantics, treat `select-staff` with `isAdmin === true` as impersonation and `isAdmin === false` as a real login. Also remember the email/password and SSO paths are always genuine self-logins (count them there, not in select-staff).
