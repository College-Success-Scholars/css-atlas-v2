# freshman-grades-skip-week-1

**Date:** 2026-10-08T160629Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
for the freshman grades, ignore the first week
```

---

## Purpose

Leave campus week 1 out of freshman FD, SS, and WAHF grades.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Freshman grades now score campus weeks 2 through the current week. Week 1 is dropped from the average, the weekly dialog, and the CSV. The page says week 1 is not included. Backend freshman-grade tests and the full backend suite passed, and both production builds passed.

---

## Code Changes

- `backend/src/services/freshman-grades.service.ts`
- `backend/src/tests/freshman-grades.test.ts`
- `backend/API.md`
- `frontend/app/dev/freshman-grades/page.tsx`
