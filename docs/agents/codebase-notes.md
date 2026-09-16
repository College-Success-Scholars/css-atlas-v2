# Codebase Notes

Agent-oriented architecture map. For the human handbook (env, standards, onboarding), start at [`docs/dev/README.md`](../dev/README.md).

## Standard check results

- Backend check: `npm --prefix backend run build` passes.
- Frontend check: `npm --prefix frontend run lint` passes.
- Frontend tests: `npm --prefix frontend run test` passes.

## High-level architecture

This repository is a two-app setup:

- `backend/`: Express + TypeScript API service.
- `frontend/`: Next.js 16 (App Router) web app.

Core data/auth platform is Supabase. The frontend obtains user session/JWT and calls backend endpoints with `Authorization: Bearer <token>`. The backend validates that JWT and then performs user-scoped Supabase queries.

Operational form and session-log rows (WAHF/WPL/MCF, tutoring, front desk, study sessions, etc.) are **populated by an existing Google Forms → Supabase intake**, not by in-app forms. The Express API mostly **reads** those tables and derives aggregates; see [`docs/dev/supabase/README.md`](../dev/supabase/README.md#form--log-intake-google-forms). Each academic year, re-authenticate that pipeline (OAuth / Apps Script consent) as part of the calendar rollover — [Yearly rollover](../dev/supabase/README.md#yearly-rollover).

## Backend how it works

Entry point: `backend/src/server.ts`.

- Registers CORS (comma-separated `CORS_ORIGIN`, default `http://localhost:3002` — must match the frontend origin), JSON parsing, request logger, route groups, and a global error handler.
- Routes are mounted under `/api/*` with domain-specific modules (`auth`, `users`, `session-logs`, `attendance`, `traffic`, `form-logs`, `daily-activity`, `memo`, `tutor-reports`, `dev`).

Request flow pattern:

1. Route-level auth middleware (`requireAuth`, `requireTeamLeaderOrAbove`, or `requireDeveloper`).
2. Controller validates inputs and orchestrates service calls.
3. Service reads/writes Supabase and returns domain data.
4. Controller returns `{ data }` or `{ error }`.

Auth and Supabase context:

- `auth.controller.ts` extracts JWT from header and verifies with Supabase auth.
- It stores token/user/profile on `req`.
- `backend/src/supabase/client.ts` uses `AsyncLocalStorage` to bind the JWT per request via `runWithToken(...)`.
- `getSupabaseClient()` reads that token and creates a typed client (`Database`) with `Authorization` header, so RLS is applied consistently.

Important backend domains:

- `session-log.*`: fetches and cleans raw check-in/out logs.
- `attendance-week.*`: campus-week boards and Memo minutes from cleaned tickets on read + excuses in `scholar_week_excuses` keyed by campus-week `week_start`. Frozen `*_records_legacy` tables are not used at runtime.
- `weekly-minutes.*`: pure Mon–Fri rollup from paired tickets (`computeWeeklyMinutesByUid`).
- `form-log.*`: MCF/WHAF/WPL and related aggregation endpoints.
- `memo.*`: memo aggregation endpoints, sync/refresh, and weekly PDF export (`weekly-memo-pdf.service` via Puppeteer; print snapshot SVG in `weekly-memo-pdf-charts.ts`). Local Chrome: `npm run install:chrome --prefix backend`, or the system Chrome app. Docker uses Alpine `chromium` with `--disable-dev-shm-usage`. The memo Export PDF button hits Next `GET /api/memo/pdf`, which proxies Express with `BACKEND_URL` (not `NEXT_PUBLIC_BACKEND_URL`).
- `traffic.*`: weekly traffic counts and session entries.

## Frontend how it works

Frontend uses Next.js App Router with route groups in `frontend/app/`.

- `frontend/middleware.ts` wires Supabase session update middleware (`lib/supabase/middleware.ts` → `updateSession`).
- Middleware redirects unauthenticated users to `/auth/login`, with public exceptions for `/`, `/auth/*`, and `/traffic` (foot-traffic kiosk — no login, no role gate for signed-in users either).
- App includes dashboard routes (including temporary `/dashboard/teams/front-desk` and `/dashboard/teams/study`), auth routes, a `/memo` redirect to `/dashboard/memo`, standalone public `/traffic` (writes via `recordTrafficEntry` server action; analytics stay on `/dev/traffic` + auth-gated `/api/traffic`), and developer scratchpad pages under `app/dev/*` (backend testing — not kept in sync with production UI).
- Theme (`ThemeProvider` / `next-themes` class strategy), fonts, and themed toaster are initialized in `app/layout.tsx`. Color tokens (light/dark) live in `app/globals.css`; dashboard header hosts the theme toggle.

Data access pattern:

- `frontend/lib/server/data.ts` acts as a typed backend API client wrapper for many `/api/*` calls.
- Frontend server/client features consume these wrappers instead of duplicating fetch logic.
- Developer tools pages (`/dev/session-logs`, `/dev/session-records` retired notice, etc.) are present for operational/debug workflows.

## Typical end-to-end flow (example)

For an authenticated session record request:

1. User logs in through Supabase in frontend.
2. Frontend sends JWT to backend endpoint (for example `/api/attendance/week/:weekNum`).
3. Backend `requireAuth` verifies token and loads profile.
4. Controller parses week/uid input.
5. Service queries Supabase tables and/or computes on-read aggregates.
6. Backend returns normalized JSON response.

## Operational notes

- New-developer guided path: `docs/dev/onboarding/` (Day 0, golden-path first PR, roles, campus weeks, auth/RLS runbook). PR descriptions use `docs/dev/pr/TEMPLATE.md`.
- Backend tests: `npm --prefix backend run test` (Vitest + supertest).
- API reference is documented in `backend/API.md` and is comprehensive.
- Set `CORS_ORIGIN` to the actual frontend URL in each environment (Docker defaults to `http://localhost:3000`; bare `app.ts` default is `http://localhost:3002`).
- Deployment topology (Railway / Vercel / Docker Compose / CI smoke): `docs/dev/deployment/README.md`.
- Developers can switch to curated test personas via `dev_test_profiles` (see `docs/dev/supabase/README.md`).
