# freshman-grades-csv-modes

**Date:** 2026-10-08T161103Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
for the printout, make it select between two modes, overall mode which is used as the same view as the default screen, and the indepth view like the current one. instead of writing repeating row data, just make the cell blank if its the same value above or if its repetitve (like same name or same uid or same mentor etc.)
```

---

## Purpose

Add overall and in-depth CSV printouts that blank repeated cells.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

The freshman grades printout now has an Overall or In-depth selector. Overall matches the on-screen table. In-depth keeps one row per scholar-week. In both files, a cell is left blank when it repeats the value in the cell above, including name, uid, mentor, and matching percents or minutes. Frontend tests (194) and the production build passed.

---

## Code Changes

- `frontend/app/dev/freshman-grades/freshman-grades-table.tsx`
- `frontend/app/dev/freshman-grades/freshman-grades-table.test.tsx`
- `docs/dev/frontend/app/dev/README.md`
