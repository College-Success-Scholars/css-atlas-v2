# lib

Shared utilities, types, and the server-side data layer for the frontend.

**Canonical docs:** [`docs/dev/frontend/lib/README.md`](../docs/dev/frontend/lib/README.md)

## Directory overview

| Path | Purpose |
|------|--------|
| **`utils.ts`** | `cn()` (class names) |
| **`auth.ts`** | UI role helpers: `resolveUserRole`, `canAccessMenteeMonitoring`, `canAccessWeeklyMemo`, `formatUserRoleLabel` |
| **`dashboard-breadcrumb.ts`** | Breadcrumb trail for dashboard routes |
| **`nav-active.ts`** | Sidebar active-link helpers |
| **`dashboard/`** | Dashboard display dictionaries (`activity-log-dictionary.ts`) |
| **`api-log.ts`** | API request/response logging for server and client fetch wrappers |
| **`auth/`** | Open-redirect safety (`getSafeInternalPath`) |
| **`dev/`** | Developer helpers (`effective-uid`) |
| **`format/`** | Display formatting (dates, form deadlines) |
| **`types/`** | TypeScript types mirroring backend models |
| **`supabase/`** | Supabase client factories, auth helpers, session middleware |
| **`server/`** | Server-only backend API client (`api-client.ts`), typed wrappers (`data.ts`), server actions |
| **`client/`** | Browser-side backend API client |

## Rules

- **Domain data comes from the Express backend** via `lib/server/api-client.ts` or `lib/client/api-client.ts` — not from Supabase queries.
- **Supabase in `lib/supabase/` is for auth only** (session, profile, role guards).
- **`import "server-only"`** in `lib/server/*` and `lib/supabase/server.ts`.
- **Campus week / time utilities** live in `shared/` (`shared/dist/time.js`), not in `frontend/lib/`.

## Import paths

- Client-safe: `@/lib/utils`, `@/lib/auth`, `@/lib/types/*`, `@/lib/format/*`
- Server-only: `@/lib/supabase/server`, `@/lib/server/*`
- Client fetch: `@/lib/client/api-client`
