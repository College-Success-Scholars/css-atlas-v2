# freshman-grades-csv-mentor-uid

**Date:** 2026-10-08T160326Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
mke the explination look nicer, and add in the mentor in the table and popout
---
also add in uids
---
give me a button to printout a csv
```

---

## Purpose

Show mentor and uid, tidy the weekly explanation, and add a CSV download.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Added mentor (from mentor_mentee, Unassigned when missing) and roster uid to the freshman grades table and the weekly dialog. Rebuilt the dialog as summary tiles plus a card per week, with logged and excuse minutes and a capped-from note when a week is over 100%. Added Download CSV, one row per scholar-week, including uid, mentor, semester percents, and weekly minutes. Backend tests (196) and build passed. Frontend tests (194) and production build passed. Could not sign in and click the live page.

---

## Code Changes

- `backend/src/services/freshman-grades.service.ts`
- `backend/src/tests/freshman-grades.test.ts`
- `backend/API.md`
- `frontend/app/dev/freshman-grades/page.tsx`
- `frontend/app/dev/freshman-grades/freshman-grades-table.tsx`
- `frontend/app/dev/freshman-grades/freshman-grades-table.test.tsx`
- `docs/dev/frontend/app/dev/README.md`
