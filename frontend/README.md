# CSS Atlas Frontend

Next.js App Router web application for the CSS Atlas scholar-management platform.

**Canonical docs:** [`docs/dev/frontend/README.md`](../docs/dev/frontend/README.md)

## Quick start

```bash
npm install
npm run dev    # http://localhost:3000
```

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build (builds `shared/` first) |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (`TZ=America/New_York`) |

## Architecture

- **Auth:** Supabase via `lib/supabase/`; session refresh in `middleware.ts`
- **Domain data:** Express backend at `/api/*` via `lib/server/data.ts` (server) or `lib/client/api-client.ts` (client)
- **Shared utilities:** `@css-atlas/shared` (campus weeks, role hierarchy)
