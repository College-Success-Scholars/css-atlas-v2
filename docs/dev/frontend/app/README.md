# frontend/app

**Location:** [`frontend/app/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app)  
**Docs:** `docs/dev/frontend/app/README.md`

## Navigation

[← Root](../../README.md) › [Frontend](../README.md) › app

Children: api/ · [auth/](auth/README.md) · [dashboard/](dashboard/README.md) · [dev/](dev/README.md) · [traffic/](traffic/README.md)

---

## Purpose

Next.js App Router directory. Every `page.tsx`, `layout.tsx`, and `route.ts` here becomes a URL route. The folder structure maps directly to the URL structure.

---

## Files

| File | Source Link | Description |
|------|-------------|-------------|
| `layout.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/layout.tsx) | Root layout — fonts (Geist), `ThemeProvider`, themed Toaster, Vercel Analytics, wraps entire app |
| `page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/page.tsx) | Landing page — shows hero for unauthenticated users, redirects authenticated users to `/dashboard` |
| `globals.css` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/globals.css) | Global CSS — Tailwind base, light/dark CSS custom properties (semantic + domain theme tokens) |

---

## Subdirectories

| Directory | URL Prefix | Docs | Description |
|-----------|-----------|------|-------------|
| `api/` | `/api/*` | _(hub)_ | Next.js route handlers that proxy the Express backend for the browser (e.g. weekly memo PDF) |
| `auth/` | `/auth/*` | [auth/README.md](auth/README.md) | Login, sign-up, password reset, email confirmation |
| `dashboard/` | `/dashboard/*` | [dashboard/README.md](dashboard/README.md) | Main authenticated app: memo, personal, mentee, room, directory, settings |
| `dev/` | `/dev/*` | [dev/README.md](dev/README.md) | Developer scratchpad for backend integration testing |
| `memo/` | `/memo` | _(redirect)_ | Redirects to `/dashboard/memo` — retired standalone view in `legacy/app/memo/` |
| `traffic/` | `/traffic/*` | [traffic/README.md](traffic/README.md) | Public foot-traffic kiosk — **never auth/role-gate** |

---

## Route Conventions

| File | Purpose |
|------|---------|
| `layout.tsx` | Shared UI shell for a route segment and its children |
| `page.tsx` | The UI for the URL — renders for `GET /path` |
| `route.ts` | API route handler — handles non-UI HTTP requests |
| `loading.tsx` | Streaming loading UI (Suspense boundary) |
| `error.tsx` | Error boundary UI |

---

## Standards

- **Server Components by default** — page files should be Server Components unless they need interactivity (`"use client"`).
- **Auth gates in pages** — call `requireUser()`, `requireTeamLeaderOrAbove()`, or `requireDeveloper()` from `lib/supabase/server.ts` at the top of protected pages. **Exception:** `/traffic` must stay public (see [traffic/README.md](traffic/README.md)).
- **Data fetching in pages/layouts** — pages call `lib/server/data.ts` or `lib/server/api-client.ts`; components receive data as props.
- **No global state** — do not use React context or global stores for data that can be fetched server-side.
- **`globals.css` is the only global stylesheet** — all component styles use Tailwind utility classes. Light/dark token pairs (`:root` / `.dark`) own product colors.
- **Root layout owns theme** — wrap the app in `ThemeProvider` (`attribute="class"`, `disableTransitionOnChange`); mount the themed Sonner toaster here.
- **`/traffic` is always public** — foot-traffic kiosk for shared devices; never redirect by session or `app_role`. Middleware allowlist + ungated `layout.tsx`; writes via `recordTrafficEntry`. See [traffic/README.md](traffic/README.md).
- **`/traffic` is the theme-safe animation reference** — success/check-in UI uses semantic tokens only; theme-safety Vitest coverage + `npm run check:theme-safety` (CI) scan this tree.
- **`layout.tsx` at root level only** — avoid deep nested layouts unless there is a clear shared UI shell.
- **`app/api` proxies Express** — browser binary downloads (weekly memo PDF) go through a Next route handler that uses `lib/server` + `BACKEND_URL`. Do not call Express from the browser with `NEXT_PUBLIC_BACKEND_URL` for those downloads.
