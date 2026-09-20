# traffic-leave-at-clock-mask

**Date:** 2026-09-20T211607Z
**User:** moosay@Moosays-MacBook-Pro-8.local
**PR:** https://github.com/College-Success-Scholars/css-atlas-v2/pull/100
**Issue:** #84

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
[plan/implement traffic #84 leave-at clock UI]

---

Can u make them type the time instea dof scroll?

---

can u have typing me in the format of tiem so : is already typed when they type they can only tpye _:__AM/PM like that

---

When I change the time like edit to chose the time quick stay gets deselected and the 30 min stay below recultes to the tiem I input andh ow long tha tis from the current time tot eh exti time I put

---

can u commit changes

---

dont write co author by cursor

---

create pr using pr format

---

for my PR: can we write docs/agents/logs
```

---

## Purpose

Replace traffic kiosk stay-length entry with a leave-at wall clock (typed `_:__ AM/PM` mask) while still submitting `duration_min`.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Implemented #84 leave-at as source of truth on `/traffic`: Quick stay chips (30/60/90) snap leave-at; pencil opens a typed hour/minute mask with a fixed colon and AM/PM toggles (no native `input type="time"` scroll picker). Completing a typed time clears the chip and recalculates stay length as now → exit in America/New_York (past / >12h rejected). Added Eastern leave-at + mask helpers and tests. Committed without Cursor Co-authored-by (`/usr/bin/git -F`). Opened PR #100 vs `develop` using `docs/dev/pr/TEMPLATE.md`. Local `npm test` needs Node 22 (CI already uses 22); Vitest fails on Node 20.16 with Vite 8/rolldown.

---

## Code Changes

- `frontend/app/traffic/page.tsx`
- `frontend/app/traffic/_components/traffic-check-in-form.tsx`
- `frontend/app/traffic/_components/traffic-check-in-form.test.tsx`
- `frontend/app/traffic/_components/traffic-format.ts`
- `frontend/app/traffic/_components/traffic-format.test.ts`
- `docs/agents/logs/2026-09-20T211607Z-traffic-leave-at-clock-mask.md`
