# freshman-grades-through-previous

**Date:** 2026-10-08T173539Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
i meant up until the previous week, so it would be 2-5
```

---

## Purpose

Score freshman FD/SS/WAHF from week 2 through the previous campus week

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Freshman grades now average campus weeks 2 through the week before the current one. Week 6 scores weeks 2–5; week 1 and the current week stay out. Each included week is still capped at 100% before the average. The page, API docs, and tests describe that range.

---

## Code Changes

- `backend/API.md`
- `backend/src/controllers/dev.controller.ts`
- `backend/src/routes/dev.routes.ts`
- `docs/dev/frontend/app/dev/README.md`
- `frontend/app/dev/page.tsx`
