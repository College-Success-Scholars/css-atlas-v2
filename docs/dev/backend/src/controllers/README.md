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
2. **Bind a handler** in the controller with `implement(contract, handler)` from `http/endpoint.ts`. A handler maps validated `params` / `query` / `body` to one service call.
3. **Mount** with `toRouter(endpoints)` in the route file. Path, method and minimum role come from the contract.
4. **Call it from the frontend** with `callEndpoint(contract, request)`. Types come from the contract; do not add a mirror type under `frontend/lib/types`.

### Services return Effects

New and migrated services return `Effect.Effect<Output, DomainError, CurrentCaller>` (see ADR 003; `upsertExcuse` in `attendance-week.service.ts` is the reference):

- **Fail with a domain error:** `return yield* new NotFoundError({ resource: "Scholar", id })`. The four kinds live in `utils/domain-error.ts` and map to 400 / 403 / 404 / 409. The type says which ones a service can produce.
- **Read who and when from `CurrentCaller`:** `const { actorId, asOf } = yield* CurrentCaller`. Never read the clock or pass the request around.
- **Database errors are defects:** `if (error) return yield* Effect.die(error)`. They are not the caller's to fix; the error handler still turns PostgREST data errors into 400s.
- **Never run the Effect.** `http/endpoint.ts` runs it once and provides `CurrentCaller`. Tests run it with `Effect.provideService(effect, CurrentCaller, caller)`.

Promise services are still accepted during migration; they may `throw` the same domain errors.

What a handler never does (each is a lint error in new files):

- import Express, call `res.status(...)`, or build the `{ data }` / `{ error }` envelope
- `try/catch`
- parse or validate input by hand, or import a schema library (use `Schema` from `@css-atlas/shared/contract`)
- read the clock
- query Supabase — call a service
- run an Effect

Every controller follows this shape; `atlas/no-express-import` and `atlas/no-try-catch` have no grandfathered files.

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
