# freshman-grades-indepth-minutes

**Date:** 2026-10-08T182632Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
show recorded minutes, excused minutes, total (reccorded + excused), and expected for each row
```

---

## Purpose

Add recorded, excused, total, and expected minutes to in-depth freshman-grades rows

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Each in-depth CSV row now includes recorded, excused, total, and expected minutes for front desk and for study session, next to that week's capped percent. Total is recorded plus excused. Raw percent columns stay out.

---

## Code Changes

- `backend/API.md`
- `backend/src/controllers/dev.controller.ts`
- `backend/src/routes/dev.routes.ts`
- `docs/dev/frontend/app/dev/README.md`
- `frontend/app/dev/page.tsx`
