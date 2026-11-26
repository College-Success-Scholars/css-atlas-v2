# supabase/

**Location:** [`backend/src/supabase/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/supabase)  
**Docs:** `docs/dev/backend/src/supabase/README.md`

## Navigation

[← Root](../../../README.md) › [Backend](../../README.md) › [src](../README.md) › supabase

---

## Purpose

Backend-only Supabase infrastructure: generated Postgres `Database` types and the JWT-bound client factory. Domain queries stay in `services/`; this folder does not hold Edge Functions or frontend types.

---

## Files

| File | Description |
|------|-------------|
| `database.types.ts` | Generated from linked project (`npm run db:types -w @css-atlas/backend`). Do not edit by hand. |
| `client.ts` | `createClient<Database>`, `getSupabaseClient`, `getSupabaseAuthClient`, `runWithToken` — **import this** from services/controllers |

## Standards

- **Import from `backend/src/supabase/client.js`** (relative path from caller) — there is no `services/supabase.service.ts`.
- **Schema types live here only** — not under `shared/` (frontend must not import `Database`).
- **Frontend types describe API responses**, not table rows — routes return only what the page needs.
- **Regen after schema migrations** — `npm run db:types -w @css-atlas/backend` (requires `supabase link`), then run backend tests/typecheck so `database-model-align` catches model drift.
- **No Edge Functions** — see [Cloud Supabase access pattern](../../../supabase/README.md#access-pattern).

## Related

- [services/](../services/README.md) — domain queries via `getSupabaseClient()`
- [models/](../models/README.md) — API/domain shapes; may differ from raw table rows
- Repo-root [`supabase/migrations/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/supabase/migrations) — DDL source of truth
