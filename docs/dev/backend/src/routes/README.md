# routes/

**Location:** [`backend/src/routes/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes)  
**Docs:** `docs/dev/backend/src/routes/README.md`

## Navigation

[← Root](../../../README.md) › [Backend](../../README.md) › [src](../README.md) › routes

---

## Purpose

Express Router definitions. Each route file declares HTTP method + path combinations, attaches auth middleware, and delegates to the appropriate controller function. Route files contain **no business logic** — they are purely structural.

---

## Files

| File | Source Link | Mount Path | Auth Level |
|------|-------------|------------|------------|
| `auth.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/auth.routes.ts) | `/api/auth` | `requireAuth` |
| `user.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/user.routes.ts) | `/api/users` | `requireTeamLeaderOrAbove` |
| `session-log.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/session-log.routes.ts) | `/api/session-logs` | `requireTeamLeaderOrAbove` |
| `form-log.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/form-log.routes.ts) | `/api/form-logs` | mixed (`requireAuth` / `requireTeamLeaderOrAbove`) |
| `memo.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/memo.routes.ts) | `/api/memo` | `requireTeamLeaderOrAbove` |
| `hours-benchmark.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/hours-benchmark.routes.ts) | `/api/hours-benchmark` | `requireDeveloper` |
| `traffic.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/traffic.routes.ts) | `/api/traffic` | `requireTeamLeaderOrAbove` |
| `activity.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/activity.routes.ts) | `/api/daily-activity` | `requireAuth` |
| `tutor-report-log.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/tutor-report-log.routes.ts) | `/api/tutor-reports` | `requireTeamLeaderOrAbove` |
| `attendance.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/attendance.routes.ts) | `/api/attendance` | `requireTeamLeaderOrAbove` |
| `dev.routes.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/routes/dev.routes.ts) | `/api/dev` | `requireDeveloper` |

All routers are mounted in [`backend/src/app.ts`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/app.ts).

---

## Auth Middleware Reference

| Middleware | Who can call |
|-----------|-------------|
| `requireAuth` | Any authenticated user (any role) |
| `requireTeamLeaderOrAbove` | `team_leader` or `developer` (verifies JWT) |
| `requireTeamLeaderRole` | `team_leader` or `developer` — use after `requireAuth` |
| `requireDeveloper` | `developer` only |
| `requireSelfOrTeamLeader` | Own `:uid` (`student_id`), or `team_leader`/`developer` — use after `requireAuth` |
| `requireSelfScholarIdOrTeamLeader` | Own body `scholarId`, or `team_leader`/`developer` — use after `requireAuth` |

All auth middleware is exported from `controllers/auth.controller.ts`.

---

## Standards

- **One router file per domain** — must match the corresponding controller and service files.
- **No logic in route files** — only: `router.get("/path", middleware, controller)`.
- **Auth middleware on every route** — the only unprotected route is `GET /` (health check in `app.ts`).
- **Register in `app.ts`** — all routers are imported and mounted in `app.ts`; do not create floating routers.
- **Naming pattern** — file: `<domain>.routes.ts`, mount: `/api/<domain>`.
- **Full API reference** — see [REST API](../../api.md) for all endpoints with params and response shapes (canonical file: `backend/API.md`).

<!-- AUTO-API-REFERENCE:START -->

## API Reference

Route files are thin Express wiring (`export default router`). They do not have useful TypeDoc pages. Use:

- **HTTP contracts** (paths, auth, params, responses): [REST API](../../api.md)
- **Request handlers** (functions with parameters/returns): [Controllers handbook](../controllers/README.md)

| Controller | Handler docs |
|------------|-------------|
| `activity.controller` | [API](../../../../reference/api/backend/src/controllers/activity.controller/README.md) |
| `auth.controller` | [API](../../../../reference/api/backend/src/controllers/auth.controller/README.md) |
| `dev.controller` | [API](../../../../reference/api/backend/src/controllers/dev.controller/README.md) |
| `form-log.controller` | [API](../../../../reference/api/backend/src/controllers/form-log.controller/README.md) |
| `memo.controller` | [API](../../../../reference/api/backend/src/controllers/memo.controller/README.md) |
| `session-log.controller` | [API](../../../../reference/api/backend/src/controllers/session-log.controller/README.md) |
| `traffic.controller` | [API](../../../../reference/api/backend/src/controllers/traffic.controller/README.md) |
| `tutor-report-log.controller` | [API](../../../../reference/api/backend/src/controllers/tutor-report-log.controller/README.md) |
| `user.controller` | [API](../../../../reference/api/backend/src/controllers/user.controller/README.md) |

<!-- AUTO-API-REFERENCE:END -->
