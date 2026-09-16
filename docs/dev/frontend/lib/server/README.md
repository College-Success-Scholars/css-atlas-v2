# lib/server

**Location:** [`frontend/lib/server/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/server)  
**Docs:** `docs/dev/frontend/lib/server/README.md`

## Navigation

[← Root](../../../README.md) › [Frontend](../../README.md) › [lib](../README.md) › server

---

## Purpose

Server-only modules for the frontend. All files here include `import "server-only"` and will throw at build time if accidentally imported from a client component. This directory is the primary data access layer for Next.js Server Components.

---

## Files

| File | Source Link | Description |
|------|-------------|-------------|
| `api-client.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/server/api-client.ts) | Backend HTTP client — reads JWT from auth cookies, calls backend `/api/*` endpoints, unwraps `{ data }` responses. Exports: `backendFetch`, `backendGet`, `backendPost`, `backendPatch`, `backendDownload` (binary GET, no JSON unwrap) |
| `data.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/server/data.ts) | Typed wrapper functions for every backend endpoint — the preferred way for pages to fetch data |
| `actions.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/server/actions.ts) | Next.js Server Actions for form submissions and mutations |
| `queries.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/server/queries.ts) | Query parameter builders / URL helpers for backend endpoints |
| `dev-profile-actions.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/lib/server/dev-profile-actions.ts) | Server Action `setActiveTestProfile()` — sets/clears dev test profile cookie (developer only) |

---

## How `api-client.ts` Works

1. Reads the Supabase auth cookie from the request using `next/headers`.
2. Decodes the base64-encoded session JSON to extract `access_token`.
3. Attaches the token as `Authorization: Bearer <token>` on the fetch request.
4. Forwards the dev test-profile cookie as `x-dev-active-profile` when set (developer acting as a test persona).
5. Calls the backend URL (from `BACKEND_URL` env var or auto-detected from `VERCEL_URL`).
6. Unwraps `{ data: ... }` from the response automatically (`backendDownload` returns the raw `Response` so PDF bytes can be proxied).

---

## Preferred Import Pattern for Pages

```typescript
// In a Server Component page:
import { getSessionRecords, getMemoPageData } from "@/lib/server/data";

export default async function Page() {
  const records = await getSessionRecords(weekNum, uid);
  return <MyComponent data={records} />;
}
```

Do not call `backendGet` / `backendFetch` directly in pages — add a typed wrapper to `data.ts` instead.

---

## Standards

- **`import "server-only"` is required** in every file in this directory — verify it's the first import.
- **Add new endpoints to `data.ts`** — when a new backend endpoint is created, add a corresponding typed function in `data.ts` rather than calling `backendGet` directly from pages.
- **No React imports** — this is plain TypeScript, not a component module.
- **Server Actions go in `actions.ts`** — do not add `"use server"` functions to other files.
- **Public traffic check-in** — `recordTrafficEntry` is intentionally unauthenticated; validate with Zod, force `traffic_type: "entry"`, never trust client `created_at`. Pair with Supabase INSERT-only RLS (`docs/dev/supabase/004_traffic_public_insert.sql`).
- **Error handling** — `backendFetch` throws on non-OK responses. Pages and actions should handle errors with try/catch or error boundaries.

<!-- AUTO-API-REFERENCE:START -->

## API Reference

Generated from TypeScript signatures. Module indexes below; full catalog: [API Reference hub](../../../../reference/README.md).

| Module | Reference |
|--------|----------|
| `actions` | [API](../../../../reference/api/frontend/lib/server/actions/README.md) |
| `api-client` | [API](../../../../reference/api/frontend/lib/server/api-client/README.md) |
| `data` | [API](../../../../reference/api/frontend/lib/server/data/README.md) |
| `dev-profile-actions` | [API](../../../../reference/api/frontend/lib/server/dev-profile-actions/README.md) |
| `queries` | [API](../../../../reference/api/frontend/lib/server/queries/README.md) |

<!-- AUTO-API-REFERENCE:END -->
