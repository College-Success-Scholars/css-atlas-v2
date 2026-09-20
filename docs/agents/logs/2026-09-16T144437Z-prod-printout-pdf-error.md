# prod-printout-pdf-error

**Date:** 2026-09-16T144437Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
for some reason, the prinout doesn't work on prod, showing an error right below the button, why could this be, and how do we fix?
```

---

## Purpose

Diagnose and fix weekly memo PDF export failing on production with the error under the Export PDF button.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

The Export PDF button called Express from the browser via NEXT_PUBLIC_BACKEND_URL (often empty in Railway Docker, falling back to localhost) while the memo page uses server BACKEND_URL. Chromium in the backend container could also 503 without --disable-dev-shm-usage. Proxied the download through same-origin GET /api/memo/pdf (BACKEND_URL + cookie JWT), added Docker Chromium launch args and compose shm_size, and covered both with tests. Frontend 145 and backend 133 tests passed; both production builds passed.

---

## Code Changes

- `Dockerfile.backend`
- `backend/API.md`
- `backend/src/services/weekly-memo-pdf-charts.ts`
- `backend/src/services/weekly-memo-pdf.service.ts`
- `backend/src/services/weekly-memo-report.service.ts`
- `backend/src/tests/weekly-memo-pdf-charts.test.ts`
- `backend/src/tests/weekly-memo-report.test.ts`
- `docker-compose.yml`
- `docs/agents/codebase-notes.md`
- `docs/dev/deployment/README.md`
- `docs/dev/frontend/app/README.md`
- `docs/dev/frontend/app/dashboard/memo/README.md`
- `docs/dev/frontend/lib/server/README.md`
- `frontend/app/dashboard/memo/_components/weekly-memo-export-button.test.tsx`
- `frontend/app/dashboard/memo/_components/weekly-memo-export-button.tsx`
- `frontend/lib/client/api-client.ts`
- `frontend/lib/server/api-client.ts`
- `frontend/lib/server/data.ts`
