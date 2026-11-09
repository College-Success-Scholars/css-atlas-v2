# freshman-grades-csv-blank-rules

**Date:** 2026-10-08T161333Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
dont do it with any grade cells tho
---
and mentor cells if they show a different freshman
```

---

## Purpose

Keep grade cells and a new freshman's mentor filled in the CSV.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

CSV blanking now applies only to a repeated scholar name or UID. Grade percents, minutes, and WAHF status are always written. A mentor cell is blank only on a later week for the same freshman; a different freshman keeps their mentor even when the name matches the row above. Frontend tests (194) and the production build passed.

---

## Code Changes

- `frontend/app/dev/freshman-grades/freshman-grades-table.tsx`
- `frontend/app/dev/freshman-grades/freshman-grades-table.test.tsx`
- `docs/dev/frontend/app/dev/README.md`
