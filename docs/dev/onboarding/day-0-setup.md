# Day 0 setup

**Docs:** `docs/dev/onboarding/day-0-setup.md`

## Navigation

[← Onboarding](README.md) › Day 0 setup

**Next:** [Roles & personas](roles-and-personas.md) or [Golden path](golden-path-first-pr.md)

---

## Purpose

Copy-paste checklist from a fresh clone to a running stack. Done when frontend (`:3000`) and backend (`:3001`) are up and you can complete one authenticated API call.

---

## Prerequisites

- Node.js 26 with npm 11 or newer. The repo pins the version in `.node-version`, which version managers like fnm and mise switch to automatically. Check with `node -v`.
- Access to the team’s Supabase project (URL + publishable/anon key)
- A developer (or test-capable) login for the app — ask [Miguel](mailto:miguelventura1123@gmail.com) / [Ben](mailto:bsaenz454@gmail.com) if you do not have one yet
- Any terminal: macOS/Linux shell or Windows PowerShell. Every command below is the same on all three.

---

## Checklist

Do these in order. **Create the environment files before starting the stack**: without them the backend cannot reach Supabase and the frontend cannot sign you in.

### 1. Clone

```bash
git clone <repo-url>
cd <repo>
```

### 2. Environment files (required before starting the stack)

**What these are:** local secret/config files that tell each app how to reach Supabase and each other. They are **not** committed to git (see `.gitignore`). Without them, the backend cannot talk to the database and the frontend cannot authenticate or call the API.

Copy the examples, then fill in real values from the team Supabase project (ask [Miguel](mailto:miguelventura1123@gmail.com) / [Ben](mailto:bsaenz454@gmail.com) if you do not have them yet):

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit **`backend/.env`** so it looks like:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

`CORS_ORIGIN` **must match** the frontend origin. Docker Compose defaults to `:3000`; bare `app.ts` default is `:3002` — local Next is usually `:3000`.

Edit **`frontend/.env.local`** so it looks like:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

Full variable table: [Handbook — Environment Variables](../README.md#environment-variables).

### 3. Install and start

From the repo root:

```bash
npm install
npm run dev
```

`npm install` installs `shared/`, `backend/` and `frontend/` together from the root `package-lock.json`, and sets up the pre-commit hook. Only run it from the root: running it inside a package folder creates a second lockfile.

`npm run dev` builds `shared/` once, then runs three things in one terminal, each with a colored prefix: the `shared` watcher (rebuilds when you edit `shared/`), the backend on `:3001` and the frontend on `:3000`. Ctrl+C stops all three.

Later sessions only need `npm run dev`. Run `npm install` again after pulling changes to any `package.json` or `package-lock.json`.

To run one package on its own (for example in separate terminals), build `shared` first:

```bash
npm run build -w @css-atlas/shared
npm run dev -w @css-atlas/backend
npm run dev -w @css-atlas/frontend
```

### 4. Verify “working”

| Check | Expect |
|-------|--------|
| Frontend | [http://localhost:3000](http://localhost:3000) loads |
| Backend | `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/` prints `200` (root health) |
| Auth | Log in via `/auth/login` |
| API | An authenticated dashboard page loads data (or DevTools shows `/api/*` with `200` + `{ data: ... }`) |

Optional smoke (backend only; adjust origin):

```bash
BASE_URL=http://localhost:3001 SMOKE_ORIGIN=http://localhost:3000 bash scripts/smoke-test.sh
```

Details: [Scripts](../scripts/README.md).

---

## Common Day 0 failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Backend crashes on start, or the frontend cannot sign in | Env files not created yet | Copy the `.env.example` files (step 2), fill in Supabase values, **then** re-run `npm run dev` |
| Frontend can’t reach API / CORS errors | `CORS_ORIGIN` ≠ browser origin | Set `CORS_ORIGIN=http://localhost:3000` in `backend/.env`, restart backend |
| Module / shared import errors | `shared/` not built | Restart `npm run dev` (it builds `shared` first), or run `npm run build -w @css-atlas/shared` |
| Port already in use | Leftover Node process | Free `:3000` / `:3001` or change ports deliberately |
| Sent to `/auth/login` (or bounce off dashboard) even though you just signed in | **Backend not running** on `:3001` (or wrong `BACKEND_URL`) — dashboard calls `GET /api/auth/me`; on failure it treats you as logged out and redirects | Confirm backend is up (`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/` → `200`); run `npm run dev` so both processes stay up; check `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL` |
| Auth redirect loop / empty session (backend is up) | Bad Supabase URL/key in `.env.local` | Double-check `NEXT_PUBLIC_SUPABASE_*` |
| Empty lists but data exists in Supabase | RLS / JWT not attached — see [Auth & RLS runbook](auth-rls-runbook.md) | Confirm cookie session + `Authorization` on API calls |
| `EBADENGINE` warnings, or install/test failures nobody else sees | Wrong Node version | `node -v` should print `v26.x`; switch with your version manager and re-run `npm install` |
| A `package-lock.json` appears in `backend/`, `frontend/` or `shared/` | `npm install` ran inside a package folder | Delete that file and run `npm install` from the repo root |

---

## Success criteria

- [ ] `npm run dev` keeps `shared`, backend and frontend up
- [ ] You are signed in
- [ ] You can explain in one sentence: backend Supabase queries are RLS-scoped via the JWT bound in `AsyncLocalStorage` ([codebase notes](../../agents/codebase-notes.md))
