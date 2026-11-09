# middleware/

**Location:** [`backend/src/middleware/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/middleware)  
**Docs:** `docs/dev/backend/src/middleware/README.md`

## Navigation

[← Root](../../../README.md) › [Backend](../../README.md) › [src](../README.md) › middleware

---

## Purpose

Express middleware that runs on every request (or a broad set of requests). Distinct from auth middleware — auth middleware lives in `controllers/auth.controller.ts` because it populates `req.authUser` and `req.profile`, making it tightly coupled to the controller layer.

---

## Files

| File | Source Link | Description |
|------|-------------|-------------|
| `request-logger.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/middleware/request-logger.ts) | Logs each incoming request: HTTP method, URL, response status code, and duration in milliseconds |
| `reject-writes-when-acting.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/middleware/reject-writes-when-acting.ts) | Denylist of mutation routes blocked while a developer acts as a test profile (see below) |

---

## `rejectWritesWhenActing` — read-only acting

When `req.isActingAsTestProfile` is true, this middleware runs inside `requireAuth` / `requireTeamLeaderOrAbove` (see `auth.controller.ts`).

**Not all POSTs are writes.** Many read endpoints use POST with a JSON body (`/by-uids`, `recent-submissions`, session-log fetches). The middleware uses a **denylist** of true mutations:

| Blocked when acting | Method |
|---------------------|--------|
| `/api/auth/profile` | POST |
| `/api/memo/sync` | POST |
| Any route | PATCH, PUT, DELETE |

**Allowed when acting:** GET; POST read endpoints (form logs, session logs, users, traffic); `/api/dev/*` GET and non-mutation POST (persona switch).

When adding a **new mutation** endpoint, add its full path to `ACTING_BLOCKED_POST_PATHS` in `reject-writes-when-acting.ts` (or rely on PATCH/PUT/DELETE blocking, including `/api/dev`). Read-only POSTs need no change.

## Standards

- **Application-wide middleware here** — middleware that applies to all or most routes belongs in this directory and is registered in `app.ts` via `app.use(middleware)`.
- **Route-specific middleware belongs in routes** — if middleware only applies to one route group, pass it as an argument to the route definition in `routes/*.routes.ts`.
- **Auth middleware lives in `controllers/auth.controller.ts`** — not here, because it needs to populate request context fields.
- **Keep middleware stateless** — middleware should not hold per-request state outside of the request object.
- **Naming** — `<purpose>.ts` (e.g., `request-logger.ts`, `rate-limiter.ts`).

<!-- AUTO-API-REFERENCE:START -->

## API Reference

Generated from TypeScript signatures. Module indexes below; full catalog: [API Reference hub](../../../../reference/README.md).

| Module | Reference |
|--------|----------|
| `reject-writes-when-acting` | [API](../../../../reference/api/backend/src/middleware/reject-writes-when-acting/README.md) |
| `request-logger` | [API](../../../../reference/api/backend/src/middleware/request-logger/README.md) |

<!-- AUTO-API-REFERENCE:END -->
