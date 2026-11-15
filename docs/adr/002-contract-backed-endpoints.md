# ADR 002: Contract-backed endpoints

**Status:** Accepted (rolling out; `/api/attendance` is the reference)
**Date:** 2026-11-15

## Decision

Each Express endpoint is described once, in `shared/contracts/<domain>.ts`: method, path, minimum role, input schemas and output schema. Both apps derive from that description:

- The backend binds a handler with `implement(contract, handler)` (`backend/src/http/endpoint.ts`), which owns authentication, validation, the `{ data }` envelope and error mapping. A handler is `(input, caller) => data`.
- The frontend calls `callEndpoint(contract, request)` and takes its types from the contract.

Errors a caller can act on are thrown as `AppError` (`backend/src/utils/app-error.ts`) and mapped to a status in one place. The schema library (zod) is a dependency of `shared` only; the apps validate through `validate()` from the contract module.

## Why

Before this, an endpoint was described by hand in five places: backend model types, controller parsing, `backend/API.md`, `frontend/lib/types` ("mirrors backend"), and a wrapper in `frontend/lib/server/data.ts`. Nothing failed when they drifted, controllers held 69 `try/catch` blocks with three different failure styles, and several endpoints accepted two names for the same field. Every one of those is a pattern an agent copies.

Alternatives considered:

- **tRPC** — removes the REST surface that `backend/API.md`, the smoke test and the cron containers rely on.
- **OpenAPI + codegen** — adds a generation step and generated files to keep in sync; the contract module gives the same guarantee with plain imports.
- **Effect Schema / HttpApi** — viable later; adopting Effect is a separate, undecided question. The contract's shape (schemas per endpoint, handlers as input → data) does not block it.

## Consequences

- A contract field has exactly one name. Aliases (`uid`/`scholar_uid`, `weekNum`/`week_num`) are removed as endpoints migrate; `/api/attendance/excuse` already changed.
- Responses are validated against the output schema. Fields a handler returns that the contract does not declare are dropped; a response that breaks the contract is a 500.
- Unmigrated controllers are grandfathered in `backend/eslint-baseline.json` (`atlas/no-express-import`, `atlas/no-try-catch`). New controllers cannot use the old shape.
- `backend/API.md` stays hand-written until every endpoint is migrated; it can then be generated from the contracts.
