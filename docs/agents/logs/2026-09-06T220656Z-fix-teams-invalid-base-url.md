# fix-teams-invalid-base-url

**Date:** 2026-09-06T220656Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
Failed to construct 'URL': Invalid base URL

on the teams page for front desk and studysession

---

note this is only on ralway on main, but local main seems fine
```

---

## Purpose

Fix Railway teams board crash from empty NEXT_PUBLIC_BACKEND_URL

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Diagnosed production-only Invalid base URL on /dashboard/teams/front-desk and /dashboard/teams/study: the client API client called new URL() with NEXT_PUBLIC_BACKEND_URL, which Railway Docker bakes as empty at image build time (local falls back to http://localhost:3001). Moved board load to a server view using getAttendanceWeekBoard (BACKEND_URL) and excuse saves to upsertAttendanceExcuseAction. Also treat blank backend base URLs as missing in api-log/client/server api-clients. Frontend tests 123/123 and production build passed; graphify CLI is not installed.

---

## Code Changes

- `frontend/app/dashboard/teams/_components/teams-attendance-client.tsx`
- `frontend/app/dashboard/teams/front-desk/page.tsx`
- `frontend/app/dashboard/teams/study/page.tsx`
- `frontend/lib/api-log.ts`
- `frontend/lib/client/api-client.ts`
- `frontend/lib/server/actions.ts`
- `frontend/lib/server/api-client.ts`
