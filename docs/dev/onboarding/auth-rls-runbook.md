# Auth & RLS runbook

**Docs:** `docs/dev/onboarding/auth-rls-runbook.md`

## Navigation

[← Onboarding](README.md) › Auth & RLS runbook

**Related:** [codebase notes](../../agents/codebase-notes.md) · [Day 0 setup](day-0-setup.md) · [Roles & personas](roles-and-personas.md)

---

## Purpose

Symptom → cause table for the auth path that juniors usually spend a full day reinventing.

Flow reminder:

1. User signs in via Supabase on the frontend (cookies via `@supabase/ssr`).
2. Server/client API helpers attach `Authorization: Bearer <jwt>`.
3. Backend `requireAuth` verifies the JWT and loads profile.
4. `runWithToken` binds the JWT in `AsyncLocalStorage`; `getSupabaseClient()` applies it so **RLS runs as that user**.

---

## Symptom → cause

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| `401` on every `/api/*` call | Missing / expired JWT, or middleware rejecting before controller | Cookie session on frontend; `Authorization` header; login again |
| Redirected to `/auth/login` right after a successful Supabase sign-in | Backend down / unreachable — `getCurrentUser()` fails and dashboard layout treats it as no user | Start backend (`./scripts/dev.sh`, `.\scripts\dev.ps1`, or `npm run dev --prefix backend`); verify `BACKEND_URL` ([Day 0 failures](day-0-setup.md#common-day-0-failures)) |
| `200` with `{ data: [] }` or null-ish empty where Dashboard SQL shows rows | RLS scoped you out, wrong persona, or service filter | Are you acting as a test profile? Does the real user own those rows? JWT bound in service path? |
| Data looks fine while acting as TL, but broken for a real `team_leader` | **Persona RLS blindspot** — JWT stays developer; overlay only changes app profile | Reproduce with a real TL login (not persona). Personas do not simulate RLS; see [Roles & personas](roles-and-personas.md#acting-as-a-test-profile--rules) |
| CORS / browser blocks API | `CORS_ORIGIN` ≠ page origin | `backend/.env` → `CORS_ORIGIN=http://localhost:3000` ([Day 0](day-0-setup.md)) |
| Mutation fails while “acting as” someone | `rejectWritesWhenActing` denylist | Switch to **My profile** for writes; see [middleware README](../backend/src/middleware/README.md) |
| Scholar can’t open Memo / gets redirected | Role gate (`requireTeamLeaderOrAbove` or frontend guard) | Expected for scholars — not a broken JWT |
| Scholar can see other people’s form submissions | Form-log Express gate missing, or RLS still `USING (true)` | `/api/form-logs` week/by-uids/stats contracts must have `access: "team_leader"`; uid routes `{ selfOrTeamLeader: "params.uid" }` (`shared/contracts/form-logs.ts`). Apply migration `20260903033000_form_log_rls_own_or_leaders.sql` so MCF/WPL/WAHF own-row uses `roster_uid()` + `is_team_leader_or_above()` |
| Scholar / anyone blocked from `/traffic` | Incorrect auth or role redirect on the kiosk | **`/traffic` is always public** — remove any gate; see [app/traffic README](../frontend/app/traffic/README.md) |
| Sign-up confirm link “No token hash or type” | Supabase email template not using `token_hash` + `type` | [Auth README — email template](../frontend/app/auth/README.md) |
| Profile create / complete-profile errors | UMD email rules or profiles insert shape | [Sign-up flow](../../agents/general-sign-up-flow.md) |

---

## Debug order (keep it short)

1. Confirm you are logged in and cookies exist for the Supabase project.
2. Inspect one failing Network request: status, response `{ error }`, presence of `Authorization`.
3. If empty data: reproduce as **My profile** vs a **test persona**.
4. If the bug is role-specific data (e.g. TL sees empty, developer does not): also reproduce with a **real** `team_leader` login — personas keep the developer JWT ([RLS blindspot](roles-and-personas.md#acting-as-a-test-profile--rules)).
5. If only local: confirm env URLs/keys match the same Supabase project on frontend and backend.
6. Still stuck → [Ask / don’t touch](ask-and-dont-touch.md) contacts with the request URL + status + whether you were acting as a persona.

---

## What not to “fix” casually

- Bypassing RLS with a service-role key in app code
- Removing `requireAuth` / role middleware to “see if it works”
- Hard-coding another user’s `roster_uid` from the client

Those need an explicit design review with [Miguel](mailto:miguelventura1123@gmail.com) / [Ben](mailto:bsaenz454@gmail.com) / [Moosay](mailto:97802676+m0osay@users.noreply.github.com).
