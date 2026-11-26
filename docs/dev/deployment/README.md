# Deployment

**Location:** repo root (`Dockerfile.*`, `docker-compose.yml`, `.railway/railway.ts`)  
**Docs:** `docs/dev/deployment/README.md`

## Navigation

[← Root](../README.md) › Deployment

Related: [IT review](../it-review.md) · [Scripts](../scripts/README.md) · [Supabase](../supabase/README.md) · [Backend](../backend/README.md) · [Frontend](../frontend/README.md)

---

## Purpose

How CSS Atlas is hosted and wired in production, CI, and local Docker — separate from the in-repo **application** layout in [`docs/dev/README.md`](../README.md).

---

## Runtime topology

```
Browser
  │  Auth session (Supabase JS / cookies)
  ▼
Frontend (Next.js)
  │  Server: BACKEND_URL → Express /api/*
  │  Browser: NEXT_PUBLIC_BACKEND_URL → Express /api/*
  │  Auth SDK: NEXT_PUBLIC_SUPABASE_*
  ▼
Backend (Express :3001)
  │  Authorization: Bearer <JWT>
  │  CORS_ORIGIN must include the frontend origin
  ▼
Supabase (Postgres + Auth + RLS)
```

- Domain data goes **frontend → backend → Supabase**. The frontend does not run domain queries against Supabase.
- Auth signup/login/session stay on the frontend Supabase client; the backend only **verifies** the JWT and applies RLS via `runWithToken` / `getSupabaseClient()`.
- Backend talks to Postgres (tables + RPCs) only — **no Supabase Edge Functions** in this stack. See [`docs/dev/supabase/README.md`](../supabase/README.md#access-pattern).

---

## Hosting (Railway)

Production and staging run on Railway, defined as code in [`.railway/railway.ts`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/.railway/railway.ts) (one file for both environments; `production` deploys `main`, `develop` deploys `develop`). Change settings there, not in the dashboard, and check `railway config plan` for both environments before merging.

| Piece | How |
|-------|-----|
| Backend | Railway service, repo root, `Dockerfile.backend` |
| Frontend | Railway service, repo root, `Dockerfile.frontend`; `cssatlas.org` in production |
| Crons | `Dockerfile.backend` (the API image) with a per-cron start command, `node dist/domains/notifications/detectors/{signin,reconciliation}-detector.js`; scheduled in production only, no Slack token in staging |
| Health | Frontend and backend: `GET /`, 30s timeout |
| Wiring | Set `CORS_ORIGIN` to the public frontend origin(s). Set frontend `BACKEND_URL` and `NEXT_PUBLIC_BACKEND_URL` to the public backend URL. |

Nixpacks alone is not enough: `shared/` lives outside a package root, so builds use the **root Dockerfiles**.

### Data / auth platform

| Piece | Role |
|-------|------|
| Cloud Supabase | Source of truth for Postgres, Auth, RLS |
| Schema changes | Baseline in [`supabase/migrations/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/supabase/migrations) (history aligned with linked remote); new DDL via migration PRs — see [`docs/dev/supabase/README.md`](../supabase/README.md). Never re-push the baseline onto prod. |

---

## Local and CI containers

[`docker-compose.yml`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/docker-compose.yml) runs production-style images for **CI smoke** and optional local parity — not the default day-to-day loop (`npm run dev` on the host is faster).

| Service | Host ports (default) | Notes |
|---------|----------------------|--------|
| `backend` | `3001` | Build args / env: `SUPABASE_*`, `CORS_ORIGIN` (default `http://localhost:3000`). Image installs Alpine Chromium for weekly memo PDF (`PUPPETEER_EXECUTABLE_PATH`). Compose sets `shm_size: 1gb`; Puppeteer also launches with `--disable-dev-shm-usage`. |
| `frontend` | `3000` | Browser → `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:3001`); RSC → `BACKEND_URL=http://backend:3001` on the compose network |

Required at compose build/run: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (root `.env` or exports).

---

## CI / CD

| Workflow | Trigger | What it does |
|----------|---------|----------------|
| [`.github/workflows/ci.yml`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/.github/workflows/ci.yml) | Push/PR (`develop`, `main`) | Build `shared` → backend test+build → frontend test+lint+build → `docker compose build` → compose up + [`scripts/smoke-test.sh`](../scripts/README.md) |
| [`.github/workflows/docs.yml`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/.github/workflows/docs.yml) | Push to `develop` (docs paths) | MkDocs → GitHub Pages |

Railway is configured **outside** these workflows: CI validates, and Railway deploys from GitHub once checks pass (`checkSuites: true` in `.railway/railway.ts`).

Smoke checks only: `GET /` health, auth-gated `401`s on major `/api/*` routes, CORS allow for `SMOKE_ORIGIN`. No authenticated E2E against a live Supabase project in CI.

---

## Environment variables by layer

Canonical lists: [`docs/dev/README.md` — Environment Variables](../README.md#environment-variables), [`backend/.env.example`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/.env.example), [`frontend/.env.example`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/.env.example).

| Concern | Variables |
|---------|-----------|
| Supabase (backend) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` |
| Supabase (frontend) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| API reachability | `BACKEND_URL` (server), `NEXT_PUBLIC_BACKEND_URL` (browser) |
| CORS | `CORS_ORIGIN` — must match the real frontend origin(s); Compose defaults to `:3000`, bare `app.ts` defaults to `:3002` |

Never commit real `.env` files; inject secrets in Railway / CI.

---

## Validation checklist

1. Backend `GET /` returns 200; Railway healthchecks green.
2. `CORS_ORIGIN` includes the live frontend origin; smoke with matching `SMOKE_ORIGIN`.
3. Frontend can reach backend via `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL`. Weekly memo PDF export uses `BACKEND_URL` through `GET /api/memo/pdf` on the Next host, not a browser call to Express.
4. Supabase Auth redirect / Site URL match the frontend origin (see [`docs/dev/frontend/app/auth/README.md`](../frontend/app/auth/README.md)).
5. Against a live backend: `BASE_URL=… SMOKE_ORIGIN=… bash scripts/smoke-test.sh`.

---

## Standards

- **Infrastructure is code** — change `.railway/railway.ts`, not the Railway dashboard; keep env examples aligned with it.
- **Root Dockerfiles for container deploys** — needed because `shared/` is outside `backend/` and `frontend/`.
- **Compose is CI/parity** — prefer `npm run dev` for iterative development.
- **Smoke is shallow by design** — unit/integration tests live under `backend/src/tests/` and `frontend/`; deepen smoke only with a safe staging token / project.
- **Schema deploys are separate from app deploys** — ship DDL via `supabase/migrations/` (staging → prod) before relying on new columns/RPCs in an app release; Dashboard SQL remains emergency-only.
