# schedule-views-scholar-row-tools

**Date:** 2026-11-10T191726Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
Scholar row tools menu

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.
```

---

## Purpose

Per-row tools menu for history review and manage shifts modals

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Added ScholarRowMenu (⋮) on week and day boards with View history and Manage shifts. History still opens ScholarReviewModal; Manage shifts opens ScholarShiftsModal listing standing shifts for the active kind with add/edit/delete via existing ShiftEditDialog and draft state. Name click removed. Schedule-views tests and frontend build passed.

---

## Code Changes

- `backend/API.md`
- `backend/src/controllers/dev.controller.ts`
- `backend/src/routes/dev.routes.ts`
- `docs/dev/frontend/app/dev/README.md`
- `frontend/app/dev/README.md`
- `frontend/app/dev/page.tsx`
- `frontend/components/mentee-monitoring/mentee-monitoring-client.tsx`
- `frontend/lib/types/mentee-review.ts`
