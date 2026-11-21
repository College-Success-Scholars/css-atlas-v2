# CSS Atlas — Developer Documentation

**Location:** `/` (repo root)  
**Docs:** `docs/dev/README.md`

## Navigation

| Area | Source | Docs |
|------|--------|------|
| [Onboarding](onboarding/README.md) | Guided path for new developers | Day 0 → branching → first PR, roles, campus weeks, auth runbook |
| [Backend](backend/README.md) | [`backend/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend) | Express + TypeScript API |
| [Shared](shared/README.md) | [`shared/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/shared) | Shared TypeScript utilities |
| [Frontend](frontend/README.md) | [`frontend/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend) | Next.js 16 web app |
| [Guardrails](guardrails.md) | [`tools/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/tools) | Lint bans, import-direction rules, baselines |
| [Deployment](deployment/README.md) | Docker / Railway / CI | Hosted topology, env wiring, smoke |
| [IT review](it-review.md) | Current-state briefing | Product state, stack, vendors, UMD SRM proposal |
| [Scripts](scripts/README.md) | [`scripts/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/scripts) | Dev/ops shell scripts |
| [Supabase](supabase/README.md) | [`docs/dev/supabase/`](supabase/README.md) | Cloud schema scripts (test profiles) |
| [Agent Docs](agents/README.md) | [`docs/agents/`](../agents/codebase-notes.md) | AI agent knowledge base |

---

## Project Overview

**CSS Atlas** is a full-stack scholar-management platform for a university program. It tracks scholar attendance, mentorship activity, form submissions, and weekly performance data.

### Architecture

```
repo root
├── backend/       Express + TypeScript REST API (port 3001)
├── frontend/      Next.js 16 web application (port 3000)
├── shared/        TypeScript library shared by both
├── docs/          Documentation (agents/ + dev/)
├── scripts/       Shell scripts for deployment/testing
├── Dockerfile.backend
└── Dockerfile.frontend
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 22, Express 5, TypeScript |
| Frontend | Next.js App Router (16.x), React, Tailwind CSS |
| Shared utilities | TypeScript compiled library |
| Database + Auth | Supabase (PostgreSQL + JWT) |
| Component library | Radix UI / shadcn-ui |
| Charts | Recharts, D3 |
| Testing | Vitest |
| Deployment | Railway, Docker — see [Deployment](deployment/README.md) |

---

## Core Request Flow

```
Browser
  └─ Frontend (Next.js Server Component or Client fetch)
       ├─ lib/server/api-client.ts  →  extracts JWT from cookies
       └─ fetch() to backend /api/*
            └─ Backend (Express)
                 ├─ requireAuth middleware  →  validates JWT via Supabase
                 ├─ runWithToken()          →  binds JWT to AsyncLocalStorage
                 ├─ Controller             →  validates inputs, calls services
                 └─ Service               →  queries Supabase (RLS applied)
```

---

## Authentication Model

- Users authenticate via Supabase in the frontend.
- The JWT is stored in cookies by `@supabase/ssr`.
- For backend calls, `frontend/lib/server/api-client.ts` reads the JWT from cookies and attaches it as `Authorization: Bearer <token>`.
- Backend middleware (`requireAuth`, `requireTeamLeaderOrAbove`, `requireDeveloper`) verifies the JWT and loads the user profile.
- Services call `getSupabaseClient()` which reads the JWT from `AsyncLocalStorage` — this means **all Supabase queries in the backend are automatically RLS-scoped to the authenticated user**.

---

## Role Hierarchy

```
null (basic user / scholar)
  └─ team_leader
       └─ developer
```

Roles are stored in `profiles.app_role` (or `user_roster.app_role`).

---

## Environment Variables

### Backend (`.env` in `backend/`)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/publishable key |
| `PORT` | No | Server port (default: `3001`) |
| `CORS_ORIGIN` | No | Comma-separated allowed origins. Default in `app.ts` is `http://localhost:3002`; Docker Compose defaults to `http://localhost:3000`. **Must match the frontend URL.** |

### Frontend (`.env.local` in `frontend/`)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/publishable key |
| `BACKEND_URL` | No | Server-side backend URL (default: `http://localhost:3001`) |
| `NEXT_PUBLIC_BACKEND_URL` | No | Browser-side backend URL (default: `http://localhost:3001`; set in Docker/production builds) |

---

## Local Development

**New developers:** follow [Onboarding — Day 0 setup](onboarding/day-0-setup.md) (preferred: `./scripts/dev.sh --install`; Windows: `.\scripts\dev.ps1 -Install`).

```bash
# Install dependencies
npm install --prefix backend
npm install --prefix frontend
npm install --prefix shared

# Build shared library (must come first)
npm run build --prefix shared

# Start backend
npm run dev --prefix backend    # port 3001

# Start frontend
npm run dev --prefix frontend   # port 3000
```

---

## Campus Week System

The app uses a **campus week** numbering system (not ISO weeks), defined in `shared/time-config.ts`. Week 1 starts on a configurable `FALL_SEMESTER_FIRST_DAY`. Most data queries take a `weekNum` parameter (integer).

This shared campus calendar is the **server-owned time frame** — use it for week bounds, navigation, and queries (including Personal and Mentee dashboards). Prefer it over `GET /api/auth/semester` / `GET /api/auth/active-semester` (and `getActiveSemester`), which should be used sparingly: when the server-owned time frame does not make sense (e.g. historical data, or the collection year has not started yet), or when a Supabase `semesters` row is required.

**Yearly rollover** is more than those dates: re-authenticate the Google Forms → Supabase pipelines in the same pass (OAuth / Apps Script consent expires independently of git). See [Form / log intake — Yearly rollover](supabase/README.md#yearly-rollover).

---

## Domain Vocabulary

See [`ubiquitous_language.md`](../agents/ubiquitous_language.md) for the full glossary. Key terms:

| Term | Meaning |
|------|---------|
| **Scholar** | A student participant in the program |
| **Team Leader** | A scholar with supervisory responsibilities |
| **Front Desk session** | A general check-in/check-out at the front desk |
| **Study Session** | A dedicated study-room check-in/check-out |
| **MCF** | Mentee Check-in Form |
| **WHAF** | Weekly Hours Activity Form |
| **WPL** | Weekly Performance Log |
| **Memo** | Weekly summary report aggregating all activity data |

---

## Standards Across the Whole Codebase

1. **TypeScript everywhere** — no plain `.js` source files in `backend/src/`, `shared/`, or `frontend/` (except compiled output in `dist/`).
2. **Imports use `.js` extension** in backend source — required for Node ESM compatibility even though files are `.ts`.
3. **Shared code lives in `shared/`** — anything used by both backend and frontend must go there, never duplicated.
4. **No Supabase in `shared/`** — shared utilities must be pure TypeScript with no server-side dependencies.
5. **Services own all Supabase access** — controllers must not import from `@supabase/supabase-js` directly.
6. **API responses wrap data** — all backend routes return `{ data: ... }` or `{ error: "..." }`.
7. **No logic in routes** — routes only wire middleware → controller. All business logic is in services.
8. **`server-only` guard** in any frontend module that must not run on the client.
9. **Published docs site** — the human-facing handbook is on GitHub Pages (MkDocs). Keep pages **concise at the top** (Purpose, Navigation, Files) and put deep detail / generated API indexes at the **bottom**. In-site navigation must stay under `docs/`; use GitHub blob links for source code.

### Docs depth

- **Handbook vs reference** — `docs/dev/` is the human handbook (standards, placement, ops). Symbol catalogs are generated TypeDoc under [`docs/reference/`](../reference/README.md); link there instead of inventing leaf mirrors.
- **New README only for a Standards boundary** — add a `docs/dev/**/README.md` when a directory has rules that parent hubs cannot own, not merely because a source folder exists.
- **Missing leaf READMEs are expected** — walk up to the nearest parent hub; that hub’s Purpose / Standards are authoritative.
- **Architecture narrative** — humans: this page; agents: [`docs/agents/codebase-notes.md`](../agents/codebase-notes.md). Other handbook pages **link**, do not retell request flow / auth / roles.

---

## Developer test profiles

Developers (`app_role === developer`) can switch to curated **test personas** stored in `public.dev_test_profiles` (cloud Supabase). This emulates another user's roles and `roster_uid` for read-only debugging without their credentials.

- **My profile** — default; full write access as the developer.
- **Acting as test profile** — true API mutations blocked via a **denylist** in `rejectWritesWhenActing` (not all POSTs); `/api/dev/*` stays writable. See [`docs/dev/backend/src/middleware/README.md`](backend/src/middleware/README.md).
- **Security** — clients send only `dev_test_profiles.id` (cookie → `X-Dev-Active-Profile` header); server resolves `roster_uid` from DB.

Setup: [`docs/dev/supabase/README.md`](supabase/README.md). CI: [`.github/workflows/ci.yml`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/.github/workflows/ci.yml).
