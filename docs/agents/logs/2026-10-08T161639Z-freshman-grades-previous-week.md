# freshman-grades-previous-week

**Date:** 2026-10-08T161639Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
count the only the previos week to this week, so if its week 6 right now, only count 5
```

---

## Purpose

Score freshman FD/SS/WAHF for only the previous campus week

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Freshman grades now score only the campus week immediately before the current one. Week 6 scores week 5, the current week is excluded, and week 1 is still never scored (so week 2 has no scored week). The page, API docs, and tests describe that single capped week instead of a semester-to-date average.

---

## Code Changes

- `backend/API.md`
- `backend/src/controllers/dev.controller.ts`
- `backend/src/routes/dev.routes.ts`
- `docs/dev/frontend/app/dev/README.md`
- `frontend/app/dev/page.tsx`
