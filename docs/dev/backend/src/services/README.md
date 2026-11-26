# services/

**Location:** [`backend/src/services/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/services)  
**Docs:** `docs/dev/backend/src/services/README.md`

## Navigation

[← Root](../../../README.md) › [Backend](../../README.md) › [src](../README.md) › services

---

## Purpose

The only layer that touches Supabase. Services contain all database queries (including Postgres RPCs via `.rpc()`), data transformation, and business logic. They are called by controllers and return typed domain objects. They never import `express` or touch `req`/`res`.

**No Supabase Edge Functions** — do not deploy or call Deno edge functions. Keep function-style logic either as Postgres RPCs invoked from these services or as TypeScript in the Express backend. See [`docs/dev/supabase/README.md`](../../../supabase/README.md#access-pattern).

---

## Modules

One `*.service.ts` per domain, plus `dev-profile.service.ts`. Supabase client infrastructure lives in [`../supabase/`](../supabase/README.md) (`client.ts`) — import `getSupabaseClient` / `runWithToken` from there. Source: [`backend/src/services/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/services). Symbol docs: [API Reference](../../../../reference/README.md).

---

## The Supabase Client Pattern

Every service that queries Supabase calls `getSupabaseClient()` at query time (not at module load). This creates a per-request client with the user's JWT set as the `Authorization` header, so **Supabase RLS is automatically applied**.

```typescript
// Correct — client is created per-call, JWT from AsyncLocalStorage
const supabase = getSupabaseClient();
const { data } = await supabase.from("profiles").select("*");

// Wrong — never create the client at module level or cache it across requests
const supabase = getSupabaseClient(); // ← do not do this at module top-level
```

The JWT reaches `getSupabaseClient()` via:
1. `auth.controller.ts` calls `runWithToken(token, () => next())` after verifying auth.
2. `runWithToken` stores the token in `AsyncLocalStorage`.
3. `getSupabaseClient()` reads the token from `AsyncLocalStorage`.

---

## Standards

- **No `req`/`res`/`next`** — services are pure TypeScript functions; they know nothing about HTTP.
- **Always call `getSupabaseClient()` inside the function body**, never at module scope.
- **Return typed values** — use the model types from `models/`.
- **Throw on fatal errors** — services throw `Error` on unexpected failures; controllers catch and convert to HTTP responses.
- **One service file per domain** — aligns with controllers and models.
- **No Edge Functions** — query tables/RPCs through `getSupabaseClient()` only; do not invoke Supabase Edge Functions from services.
- **Prefer mapping to route DTOs** — services may select full rows internally, then return only fields the API/page needs (frontend types need not match table Rows).
- **Import Supabase client from `../supabase/client.js`** — not from a services wrapper.

<!-- AUTO-API-REFERENCE:START -->

## API Reference

Generated from TypeScript signatures. Module indexes below; full catalog: [API Reference hub](../../../../reference/README.md).

| Module | Reference |
|--------|----------|
| `attendance-week.service` | [API](../../../../reference/api/backend/src/services/attendance-week.service/README.md) |
| `daily-scholar-activity.service` | [API](../../../../reference/api/backend/src/services/daily-scholar-activity.service/README.md) |
| `dev-profile.service` | [API](../../../../reference/api/backend/src/services/dev-profile.service/README.md) |
| `form-log.service` | [API](../../../../reference/api/backend/src/services/form-log.service/README.md) |
| `freshman-grades.service` | [API](../../../../reference/api/backend/src/services/freshman-grades.service/README.md) |
| `hours-benchmark-pdf.service` | [API](../../../../reference/api/backend/src/services/hours-benchmark-pdf.service/README.md) |
| `hours-benchmark.service` | [API](../../../../reference/api/backend/src/services/hours-benchmark.service/README.md) |
| `memo-page.service` | [API](../../../../reference/api/backend/src/services/memo-page.service/README.md) |
| `mentee-mcf-prefill.service` | [API](../../../../reference/api/backend/src/services/mentee-mcf-prefill.service/README.md) |
| `mentee-meeting-preference.service` | [API](../../../../reference/api/backend/src/services/mentee-meeting-preference.service/README.md) |
| `mentee-review-activity.service` | [API](../../../../reference/api/backend/src/services/mentee-review-activity.service/README.md) |
| `mentee-review-attendance.adapter` | [API](../../../../reference/api/backend/src/services/mentee-review-attendance.adapter/README.md) |
| `mentee-review-evaluator` | [API](../../../../reference/api/backend/src/services/mentee-review-evaluator/README.md) |
| `mentee-review-wire` | [API](../../../../reference/api/backend/src/services/mentee-review-wire/README.md) |
| `mentee.service` | [API](../../../../reference/api/backend/src/services/mentee.service/README.md) |
| `profile.service` | [API](../../../../reference/api/backend/src/services/profile.service/README.md) |
| `schedule-board.service` | [API](../../../../reference/api/backend/src/services/schedule-board.service/README.md) |
| `semester.service` | [API](../../../../reference/api/backend/src/services/semester.service/README.md) |
| `session-log.service` | [API](../../../../reference/api/backend/src/services/session-log.service/README.md) |
| `session-no-shows.logic` | [API](../../../../reference/api/backend/src/services/session-no-shows.logic/README.md) |
| `session-no-shows.service` | [API](../../../../reference/api/backend/src/services/session-no-shows.service/README.md) |
| `shift-occurrence.service` | [API](../../../../reference/api/backend/src/services/shift-occurrence.service/README.md) |
| `time.service` | [API](../../../../reference/api/backend/src/services/time.service/README.md) |
| `traffic.service` | [API](../../../../reference/api/backend/src/services/traffic.service/README.md) |
| `tutor-report-log.service` | [API](../../../../reference/api/backend/src/services/tutor-report-log.service/README.md) |
| `user.service` | [API](../../../../reference/api/backend/src/services/user.service/README.md) |
| `weekly-memo-pdf-charts` | [API](../../../../reference/api/backend/src/services/weekly-memo-pdf-charts/README.md) |
| `weekly-memo-pdf.service` | [API](../../../../reference/api/backend/src/services/weekly-memo-pdf.service/README.md) |
| `weekly-memo-report.service` | [API](../../../../reference/api/backend/src/services/weekly-memo-report.service/README.md) |
| `weekly-memo-risk` | [API](../../../../reference/api/backend/src/services/weekly-memo-risk/README.md) |
| `weekly-memo.service` | [API](../../../../reference/api/backend/src/services/weekly-memo.service/README.md) |
| `weekly-minutes.service` | [API](../../../../reference/api/backend/src/services/weekly-minutes.service/README.md) |

<!-- AUTO-API-REFERENCE:END -->
