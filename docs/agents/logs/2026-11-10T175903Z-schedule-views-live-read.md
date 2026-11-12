# schedule-views-live-read

**Date:** 2026-11-10T175903Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
pull live read data
```

---

## Purpose

Wire /dev/schedule-views to live roster and standing shift assignments

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Added GET /api/dev/schedule-board (service + controller + route + API.md) assembling eligible scholars and active scholar_shift_assignments. Frontend schedule-views page fetches that payload server-side, client uses live scholars instead of mock fixtures (mock-scholars removed). Frontend schedule-views tests, frontend build, and backend build passed.

---

## Code Changes

- `backend/API.md`
- `backend/src/controllers/dev.controller.ts`
- `backend/src/routes/dev.routes.ts`
- `docs/dev/frontend/app/dev/README.md`
- `frontend/app/dev/README.md`
- `frontend/app/dev/page.tsx`
