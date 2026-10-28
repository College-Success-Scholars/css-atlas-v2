# freshman-grades-csv-particulars

**Date:** 2026-10-08T173736Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
add in the paticulars of the sheet (what weeks they cover etc. ) in the content in the files cell
```

---

## Purpose

Put the weeks a freshman-grades CSV covers into the first cell

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Each freshman-grades CSV now starts with one cell describing the printout: Overall or In-depth, the campus weeks covered, the current week, that week 1 and the current week are excluded, the 100% weekly cap, and the FD/SS/WAHF weights. Column headers follow on the next row.

---

## Code Changes

- `backend/API.md`
- `backend/src/controllers/dev.controller.ts`
- `backend/src/routes/dev.routes.ts`
- `docs/dev/frontend/app/dev/README.md`
- `frontend/app/dev/page.tsx`
