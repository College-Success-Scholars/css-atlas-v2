# Golden path — first PR

**Docs:** `docs/dev/onboarding/golden-path-first-pr.md`

## Navigation

[← Onboarding](README.md) › Golden path (first PR)

**Also read:** [Branching & reviews](branching-and-reviews.md) · [PR template](../pr/TEMPLATE.md) · [Day 0 setup](day-0-setup.md)

---

## Purpose

Ship one narrow vertical slice so you hit every seam that usually bites: `shared` build order, Express route → controller → service, `{ data }` / `{ error }` responses, JWT + RLS, Next.js server data access, Vitest, and the **repo PR template**.

Pick a **tiny, reviewable** change (prefer a supervised ticket). Examples of good first scope:

- Add a field already returned by an existing service to a dashboard display
- Fix a copy / formatting bug with a test
- Extend an existing read endpoint with a well-scoped query param (team-approved)

Avoid first PRs that change auth middleware, RLS, migrations, or `shared/time-config.ts` — see [Ask / don’t touch](ask-and-dont-touch.md).

---

## Before your edits can hit `develop`

Your commits never land on `develop` by pushing there directly (unless you are on the senior team). The path is:

```text
1. Branch off develop
2. Push a feature branch
3. Open a PR with base = develop  (never main)
4. CI green + CODEOWNERS (senior) approval
5. Merge → develop
```

Checklist before you start coding:

| Step | What to do |
|------|------------|
| Base branch | `git fetch origin && git checkout develop && git pull` — create your branch from **current `develop`**, not `main` |
| Branch name | Something like `feature/short-description` or `fix/short-description` |
| PR target | Base branch **`develop`**. Do not open a PR into `main` |
| Description | Copy [`docs/dev/pr/TEMPLATE.md`](../pr/TEMPLATE.md); link `Fixes #<n>` when there is an issue |
| Review | GitHub requests `@College-Success-Scholars/senior-developers` via [CODEOWNERS](branching-and-reviews.md#codeowners). You need **one** Senior Developer approval |
| Checks | Required CI status checks must pass |
| Merge | After approval + green CI, merge the PR. That is when your edits hit `develop` |

Policy detail (teams, `main`, hotfixes): [Branching & reviews](branching-and-reviews.md).

---

## Mental model (before coding)

Request flow:

```text
Browser / RSC
  → frontend lib/server (JWT from cookies)
  → backend /api/*
       → requireAuth (or stronger)
       → controller
       → service → getSupabaseClient() (RLS via AsyncLocalStorage)
  → { data } | { error }
```

Details: [codebase notes](../../agents/codebase-notes.md), [handbook overview](../README.md).

---

## Walkthrough checklist

### 1. Trace the existing path

1. Open the UI page you’ll touch (e.g. Memo or a dashboard widget).
2. Find the route under `frontend/app/…`.
3. Find the data call (`frontend/lib/server/…` or client API helper).
4. Map to `backend/src/routes/*.routes.ts` → controller → service.
5. Confirm response shape is `{ data: … }`.

### 2. Implement the smallest change

Follow package standards:

- Services own Supabase access — not controllers ([backend services](../backend/src/services/README.md))
- Routes only wire middleware → controller ([routes](../backend/src/routes/README.md))
- Shared types/helpers go in `shared/`, then rebuild shared
- Backend imports use `.js` extensions in `.ts` sources
- Frontend server-only modules stay behind `server-only` where required

### 3. Test what you touched

From the repo root. If `shared` changed, build it first:

```bash
npm run build -w @css-atlas/shared
```

Backend:

```bash
npm test -w @css-atlas/backend
npm run build -w @css-atlas/backend
```

Frontend:

```bash
npm test -w @css-atlas/frontend
npm run build -w @css-atlas/frontend
```

Skip packages you did not change; never skip the package you did. Docker only if containers / shared packaging are involved: `docker compose build` from repo root.

### 4. Open the PR into `develop` with the canonical template

Confirm the PR **base** is `develop` (not `main`). Copy **[`docs/dev/pr/TEMPLATE.md`](../pr/TEMPLATE.md)** into the PR body (GitHub does not auto-apply it yet).

Fill at least:

- **Summary** — what / why + bold-lead bullets
- **Changelog** — commits + themed Backend / Frontend / Shared / Docs notes
- **Test plan** — checkboxes for the exact scripts you ran (same commands as above)

Example Test plan lines:

```markdown
- [ ] Manual: signed in, opened <page>, saw <expected>
- [ ] `cd backend && npm test`
- [ ] `cd frontend && npm test`
- [ ] `cd frontend && npm run build`   # if frontend changed
```

### 5. Wait for senior review + CI (then merge)

CODEOWNERS auto-requests **Senior Developers**. You can also ping [Miguel](mailto:miguelventura1123@gmail.com), [Ben](mailto:bsaenz454@gmail.com), or [Moosay](mailto:97802676+m0osay@users.noreply.github.com) if review is stuck.

Merge only when:

1. At least one **Senior Developer / code owner** approval is on the PR  
2. Required CI checks are green  
3. Base is still `develop`

That merge is the moment your edits hit `develop`. Linking `Fixes #…` closes the issue when the PR merges.

---

## Success criteria

- [ ] PR targets `develop` (not `main`) with template-complete description
- [ ] Senior Developer (CODEOWNERS) approval + green CI, then merge — or still in that review
- [ ] Tests / builds for touched packages green
- [ ] No drive-by refactors outside the ticket
