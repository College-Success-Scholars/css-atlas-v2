# freshman-grades-week-breakdown

**Date:** 2026-10-08T155936Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.
---
when clicking on a scholar, pop out an explination for their hours broken down by week
```

---

## Purpose

Show a weekly hours explanation when a freshman grade row is selected.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Attached each scholar's weekly logged, excuse, effective, and capped percents on GET /api/dev/freshman-grades. Selecting a name on /dev/freshman-grades opens a dialog that explains Front Desk and Study Session minutes per week, including the 100% cap, plus WAHF missing or submitted, and the average of those capped weeks. Backend tests (196) and build passed. Frontend tests (193) and production build passed. Could not sign in and click the live page; the dialog interaction is covered by a component test.

---

## Code Changes

- `backend/src/services/freshman-grades.service.ts`
- `backend/src/tests/freshman-grades.test.ts`
- `backend/API.md`
- `frontend/app/dev/freshman-grades/page.tsx`
- `frontend/app/dev/freshman-grades/freshman-grades-table.tsx`
- `frontend/app/dev/freshman-grades/freshman-grades-table.test.tsx`
- `docs/dev/frontend/app/dev/README.md`
