# frontend/lib

**Location:** [`frontend/lib/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib)  
**Docs:** `docs/dev/frontend/lib/README.md`

## Navigation

[← Root](../../README.md) › [Frontend](../README.md) › lib

Children: [server/](server/README.md) · [supabase/](supabase/README.md)

---

## Purpose

All non-component TypeScript utilities for the frontend. Organized by execution environment (server vs client) and concern (API access, Supabase auth, types, formatting). The golden rule: **server-only modules are never bundled for the client**.

Symbol catalogs: [API Reference](../../../reference/README.md).

---

## Files (root-level)

| File | Source Link | Description |
|------|-------------|-------------|
| `api-log.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/api-log.ts) | Logging helpers for API requests/responses |
| `auth.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/auth.ts) | UI role helpers (`resolveUserRole`, access labels, etc.) |
| `dashboard-breadcrumb.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/dashboard-breadcrumb.ts) | Dashboard breadcrumb trail |
| `nav-active.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/nav-active.ts) | Active nav item helpers |
| `utils.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/utils.ts) | Generic utilities (`cn()`, etc.) |

---

## Subdirectories

| Directory | Docs | Environment | Description |
|-----------|------|-------------|-------------|
| `server/` | [server/README.md](server/README.md) | Server only | Backend API client, server actions, data functions |
| `supabase/` | [supabase/README.md](supabase/README.md) | Server + Client | Supabase client factories and auth helpers |
| `client/` | _(hub)_ | Client only | Browser-side backend API fetch wrapper |
| `auth/` | _(hub)_ | Both | Auth redirect safety (open-redirect prevention) |
| `types/` | _(hub)_ | Both | Shared TypeScript type definitions |
| `format/` | _(hub)_ | Both | Display formatting utilities |
| `dev/` | _(hub)_ | Both | Developer helpers (`effective-uid.ts`) |
| `dashboard/` | _(hub)_ | Both | Dashboard activity-log presentation helpers |
| `theme/` | _(hub)_ | Both | Theme CSS var helpers (`css-color.ts`) and theme-safety test helpers |

---

## Environment Rules

| Module | `"use client"` OK? | Notes |
|--------|-------------------|-------|
| `lib/server/*` | No | Contains `import "server-only"` — will throw at runtime if imported on client |
| `lib/client/*` | Yes | Browser-only; uses `window`, `fetch` from browser context |
| `lib/supabase/server.ts` | No | `import "server-only"` |
| `lib/supabase/client.ts` | Yes | Uses `createBrowserClient` |
| `lib/types/*` | Yes | Pure types, safe everywhere |
| `lib/format/*` | Yes | Pure functions, safe everywhere |
| `lib/utils.ts` | Yes | Pure utilities |
| `lib/api-log.ts` | Yes (carefully) | Pure functions; server usage logs to console, client usage is a no-op |

---

## Standards

- **`import "server-only"` in server modules** — any module in `lib/server/` and `lib/supabase/server.ts` must have this as its first import.
- **No Supabase domain queries outside `lib/server/`** — Supabase client from `lib/supabase/` is for auth only (session, user identity). Domain data comes from the backend via `lib/server/api-client.ts`.
- **`lib/utils.ts` is for generic utilities only** — `cn()`, type guards, etc. Domain logic goes in subdirectories.
- **`lib/theme/`** — `css-color.ts` exports `var(--…)` references for charts; `theme-safety.test-helpers.ts` asserts animated/product UI stays free of hardcoded palette/`transition-all` patterns (pair with `npm run check:theme-safety`).
- **Types in `lib/types/`** — types only (no runtime logic); one file per domain; match backend model names where possible; update when API response shapes change; do not blind-generate from Supabase schema.
- **Formatting in `lib/format/`** — pure display helpers (no React, no business totals/status/risk); prefer `@css-atlas/shared/time` for time.
- **`lib/client/`** — browser only (no `server-only`, no `next/headers`); token via Supabase browser `getSession()`; mirror `lib/server/data.ts` names when adding client equivalents.
- **`lib/auth/`** — pure redirect-safety helpers only; access guards and sign-in flows stay in `lib/supabase/*`.
- **`lib/dashboard/`** — no server I/O; types from `lib/types`, not redefined here.
- **`lib/dev/`** — prefer shared `getEffectiveScholarId` for new code; keep as a thin frontend alias when needed.

<!-- AUTO-API-REFERENCE:START -->

## API Reference

Generated from TypeScript signatures. Module indexes below; full catalog: [API Reference hub](../../../reference/README.md).

| Module | Reference |
|--------|----------|
| `api-log` | [API](../../../reference/api/frontend/lib/api-log/README.md) |
| `auth` | [API](../../../reference/api/frontend/lib/auth/README.md) |
| `client/api-client` | [API](../../../reference/api/frontend/lib/client/api-client/README.md) |
| `dashboard/activity-log-dictionary` | [API](../../../reference/api/frontend/lib/dashboard/activity-log-dictionary/README.md) |
| `dashboard-breadcrumb` | [API](../../../reference/api/frontend/lib/dashboard-breadcrumb/README.md) |
| `dev/effective-uid` | [API](../../../reference/api/frontend/lib/dev/effective-uid/README.md) |
| `format/form-deadlines` | [API](../../../reference/api/frontend/lib/format/form-deadlines/README.md) |
| `format/form-view-helpers` | [API](../../../reference/api/frontend/lib/format/form-view-helpers/README.md) |
| `format/time` | [API](../../../reference/api/frontend/lib/format/time/README.md) |
| `nav-active` | [API](../../../reference/api/frontend/lib/nav-active/README.md) |
| `server/actions` | [API](../../../reference/api/frontend/lib/server/actions/README.md) |
| `server/api-client` | [API](../../../reference/api/frontend/lib/server/api-client/README.md) |
| `server/data` | [API](../../../reference/api/frontend/lib/server/data/README.md) |
| `server/dev-profile-actions` | [API](../../../reference/api/frontend/lib/server/dev-profile-actions/README.md) |
| `server/queries` | [API](../../../reference/api/frontend/lib/server/queries/README.md) |
| `supabase/client` | [API](../../../reference/api/frontend/lib/supabase/client/README.md) |
| `supabase/middleware` | [API](../../../reference/api/frontend/lib/supabase/middleware/README.md) |
| `supabase/public-key` | [API](../../../reference/api/frontend/lib/supabase/public-key/README.md) |
| `supabase/server` | [API](../../../reference/api/frontend/lib/supabase/server/README.md) |
| `types/form-log` | [API](../../../reference/api/frontend/lib/types/form-log/README.md) |
| `types/session-log` | [API](../../../reference/api/frontend/lib/types/session-log/README.md) |
| `types/supabase` | [API](../../../reference/api/frontend/lib/types/supabase/README.md) |
| `types/time` | [API](../../../reference/api/frontend/lib/types/time/README.md) |
| `types/traffic` | [API](../../../reference/api/frontend/lib/types/traffic/README.md) |
| `types/tutor-report-log` | [API](../../../reference/api/frontend/lib/types/tutor-report-log/README.md) |
| `utils` | [API](../../../reference/api/frontend/lib/utils/README.md) |

<!-- AUTO-API-REFERENCE:END -->
