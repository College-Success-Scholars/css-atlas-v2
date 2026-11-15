# Frontend

**Location:** [`frontend/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend)  
**Docs:** `docs/dev/frontend/README.md`

## Navigation

[← Root](../README.md) › Frontend

Children: [app/](app/README.md) · [components/](components/README.md) · [lib/](lib/README.md)

---

## Purpose

The Next.js App Router web application. Provides the UI for scholars, team leaders, and developers. Authenticates users via Supabase, reads domain data by calling the Express backend, and never queries Supabase directly for domain data (only for auth session management).

---

## Files

| File | Source Link | Description |
|------|-------------|-------------|
| `package.json` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/package.json) | Dependencies, scripts, workspace config |
| `tsconfig.json` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/tsconfig.json) | TypeScript config with path aliases (`@/`) |
| `next.config.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/next.config.ts) | Next.js config (externalDir, turbopack root for shared) |
| `middleware.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/middleware.ts) | Thin re-export of `updateSession` from `lib/supabase/middleware.ts` |
| `eslint.config.mjs` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/eslint.config.mjs) | ESLint configuration |
| `vitest.config.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/vitest.config.ts) | Vitest test runner (TZ=America/New_York required) |
| `postcss.config.mjs` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/postcss.config.mjs) | PostCSS config for Tailwind CSS |
| `components.json` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/components.json) | shadcn/ui component configuration |
| `d3.d.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/d3.d.ts) | Type declarations for D3 |
| `recharts.d.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/recharts.d.ts) | Type declarations for Recharts |
| `railway.toml` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/railway.toml) | Railway deployment configuration — see [Deployment](../deployment/README.md) |
| `README.md` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/README.md) | Original frontend documentation |

---

## Subdirectories

| Directory | Docs | Description |
|-----------|------|-------------|
| `app/` | [app/README.md](app/README.md) | Next.js App Router pages, layouts, and route handlers |
| `components/` | [components/README.md](components/README.md) | Reusable React components |
| `lib/` | [lib/README.md](lib/README.md) | Utility modules, API clients, Supabase helpers, type definitions |
| `hooks/` | _(hub)_ | Client-only React hooks — `use-<behavior>.ts`; no data-fetch or domain-logic hooks |
| `public/` | _(hub)_ | Static assets served at `/` |
| `scripts/` | _(hub)_ | Standalone Node scripts for testing/ops |

---

## Scripts

```bash
npm run dev                 # Next.js dev server with Turbopack (port 3000)
npm run build               # Production build
npm run start               # Production server
npm run lint                # ESLint
npm run test                # Vitest (TZ=America/New_York)
npm run test:watch          # Vitest watch mode
npm run check:theme-safety  # Fail on theme-unsafe patterns in scanned paths (also runs in CI)
```

---

## Path Alias

All imports use the `@/` alias which resolves to `frontend/` root:

```typescript
import { backendGet } from "@/lib/server/api-client";
import { Button } from "@/components/ui/button";
```

---

## Data Access Pattern

```
Server Component
  └─ lib/server/data.ts      ← typed backend API wrappers (use these)
       └─ lib/server/api-client.ts  ← low-level fetch with JWT

Client Component
  └─ fetch() to Next.js route handler  OR
     lib/client/api-client.ts  ← browser-side fetch wrapper

lib/supabase/server.ts  ← auth helpers (getCurrentUser, requireUser, etc.)
  Only for auth state. Never for domain data queries.
```

---

## Standards

- **Server Components by default** — only add `"use client"` when you need browser APIs, event handlers, or React state.
- **Domain data comes from the backend** — use `lib/server/api-client.ts` (server) or `lib/client/api-client.ts` (client). Do not query Supabase tables directly for domain data.
- **Auth via `lib/supabase/server.ts`** — use `requireUser()`, `requireTeamLeaderOrAbove()`, `requireDeveloper()` in page components that need auth guards. **Do not** apply these (or role redirects) to `/traffic` — that route is a public foot-traffic kiosk ([app/traffic README](app/traffic/README.md)).
- **`server-only`** — add `import "server-only"` to any module that must not be bundled for the client.
- **No business logic in pages** — pages orchestrate data fetching and render components. Logic belongs in `lib/` or components.
- **shadcn/ui for UI primitives** — add new primitives via `npx shadcn@latest add <component>`, they land in `components/ui/`.
- **Tailwind CSS only** — no inline styles, no CSS modules unless absolutely necessary.
- **Fonts and global styles** — configured once in `app/layout.tsx` and `app/globals.css`.
- **Colors live in `app/globals.css`** — light/dark CSS custom properties (semantic + domain tokens). Prefer utilities like `bg-background`, `text-muted-foreground`, `bg-success`, `text-destructive`. Do not hardcode product hex or Tailwind palette greens/reds for UI chrome.
- **Soft status chips** — pair `bg-*-muted` with `text-*-muted-foreground` (never `text-*-foreground`). Prefer `Badge` variants `success` | `warning` | `info`. Solid fills use `bg-*` + `text-*-foreground`.
- **Theme via `ThemeProvider`** — `next-themes` class strategy (`.dark` on `<html>`); toggle in dashboard header; `disableTransitionOnChange` so theme flips do not interpolate old colors.
- **Theme-during-animation** — animated overlays/success screens must use semantic tokens (never `bg-white` / palette colors); prefer transform/opacity transitions; do **not** use `transition-all` on theme-dependent surfaces. New animated shells should ship a theme-safety test (`lib/theme/theme-safety.test-helpers.ts`). `/traffic` is the canonical example. CI runs `npm run check:theme-safety`.
- **Tests run with `TZ=America/New_York`** — required because campus weeks are Eastern-time based.
- **Hooks** (`hooks/`) — client-side only; single responsibility; no data-fetching hooks (prefer server components / `lib/server/data.ts`); no domain logic.
