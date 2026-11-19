# ADR 003: Effect for backend handlers and services

**Status:** Accepted (rolling out; `upsertExcuse` is the reference)
**Date:** 2026-11-19

## Decision

Backend handlers and services return Effects (`effect` 4.x):

```ts
Effect.Effect<Output, DomainError, CurrentCaller>
```

- **Failures are typed.** Services fail with one of four domain errors (`utils/domain-error.ts`: validation, not found, forbidden, conflict). `http/error-handler.ts` maps each tag to a status. Everything else, database errors included, is a defect and a 500 (PostgREST data errors still become 400s).
- **The request is a service.** `CurrentCaller` (`context/current-caller.ts`) carries `actorId`, `asOf` and the profiles. `http/endpoint.ts` provides it on every request; tests provide it with `Effect.provideService`.
- **Effects run only at the edge.** `http/endpoint.ts` is the only backend code that runs one (lint: `atlas/no-effect-run`).
- **The compiler enforces the edge.** `implement()` accepts only handlers whose failures are domain errors and whose requirements are `CurrentCaller`.
- **Contracts stay in zod**, in `shared/`, so the frontend never depends on Effect.

Promise handlers and services remain valid during migration and may throw the same domain errors.

## Why

A service's signature now states what it produces, how it can fail, and that it depends on the request, without reading its body. That is the information an agent needs to call it correctly, and today it is only in the implementation. `CurrentCaller` replaces passing `asOf` and audit identity through every call, while keeping that dependency visible in the type rather than hidden in a global.

## Trade-offs

- **Two styles coexist until migration ends.** This is the nuance the guardrails exist to remove, so the migration should finish rather than stall. New services use Effect; a Promise service is migrated when it is next changed.
- **Learning curve** for developers new to Effect. The rules in `docs/dev/backend/src/controllers/README.md` cover the subset in use: `Effect.gen`, `yield*`, domain errors, `CurrentCaller`, `Effect.promise`, `Effect.die`.
- **The request token still lives in AsyncLocalStorage** (`supabase/client.ts`). It was verified to survive Effect's scheduling under concurrent requests; moving the Supabase client into an Effect service is a later step.
