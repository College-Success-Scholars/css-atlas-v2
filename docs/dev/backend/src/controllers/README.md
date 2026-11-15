# controllers/

**Location:** [`backend/src/controllers/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/controllers)  
**Docs:** `docs/dev/backend/src/controllers/README.md`

## Navigation

[← Root](../../../README.md) › [Backend](../../README.md) › [src](../README.md) › controllers

---

## Purpose

Express request handlers. A controller receives a validated `AuthenticatedRequest`, reads route/query params, calls one or more services, and returns a JSON response. Controllers contain no Supabase queries and no business logic beyond input validation and response shaping.

---

## Modules

One `*.controller.ts` per domain (auth, user, session-log, form-log, memo, traffic, activity, tutor-report-log, attendance-week, dev). Source: [`backend/src/controllers/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/controllers). Symbol docs: [API Reference](../../../../reference/README.md).

---

## Standards

New and migrated endpoints are **contract-backed**. `attendance-week.controller.ts` is the reference.

1. **Describe the endpoint once** in `shared/contracts/<domain>.ts` with `endpoint({ method, path, access, params, query, body, output })`. One name per field, no aliases.
2. **Bind a handler** in the controller with `implement(contract, handler)` from `http/endpoint.ts`. A handler is `(input, caller) => data`: it receives validated `params` / `query` / `body`, returns what the output schema accepts, and does nothing else.
3. **Mount** with `toRouter(endpoints)` in the route file. Path, method and minimum role come from the contract.
4. **Call it from the frontend** with `callEndpoint(contract, request)`. Types come from the contract; do not add a mirror type under `frontend/lib/types`.

What a handler never does (each is a lint error in new files):

- import Express, call `res.status(...)`, or build the `{ data }` / `{ error }` envelope
- `try/catch` — throw `invalid()`, `notFound()`, `forbidden()`, `conflict()` or `unavailable()` from `utils/app-error.ts`; anything else becomes a 500
- parse or validate input by hand, or import `zod`
- read the clock — use `caller.asOf` and pass it down
- query Supabase — call a service

Controllers that still export `(req, res)` functions predate this and are grandfathered in `backend/eslint-baseline.json`. Do not copy them; migrate them.

<!-- AUTO-API-REFERENCE:START -->

## API Reference

Generated from TypeScript signatures. Module indexes below; full catalog: [API Reference hub](../../../../reference/README.md).

| Module | Reference |
|--------|----------|
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
