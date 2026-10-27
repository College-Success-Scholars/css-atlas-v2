# freshman-grades-indepth-week-pct

**Date:** 2026-10-08T181948Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
for the indepth view, this should be running the calculations for every scholar every week. so fd% on week 5 shows for that week. Dont show the raw cols, just show the capped percentages as percentages.
```

---

## Purpose

Make the in-depth freshman-grades CSV show each week's capped percent

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

The in-depth CSV is now one row per scholar per week. FD %, SS %, and WAHF % are that week's capped percent, written as a percentage such as 100%. Minute columns, raw percent columns, and WAHF status were removed.

---

## Code Changes

- `backend/API.md`
- `backend/src/controllers/dev.controller.ts`
- `backend/src/routes/dev.routes.ts`
- `docs/dev/frontend/app/dev/README.md`
- `frontend/app/dev/page.tsx`
