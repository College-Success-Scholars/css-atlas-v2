# memo-tl-compliance-enrolled

**Date:** 2026-09-15T202929Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
make the weekly memo only show scholars that are currently enrolledm from user_roster status

---

tl complience should also follow this
```

---

## Purpose

Restrict weekly memo team leader compliance to enrolled user_roster status.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Required isTeamLeaderForPerformance to use user_roster.status enrolled, so inactive, graduated, and unset TL rows drop off Memo WPL/MCF/WAHF compliance (and GET /api/users/team-leaders). Aligned the mentee-count sync helper to the same enrolled rule. Backend tests (131) and production build passed.

---

## Code Changes

- `backend/API.md`
- `backend/src/services/memo-page.service.ts`
- `backend/src/services/user.service.ts`
- `backend/src/tests/memo.test.ts`
- `backend/src/tests/user.service.test.ts`
- `docs/dev/frontend/app/dashboard/memo/README.md`
- `docs/dev/scripts/README.md`
- `frontend/app/dev/profiles/roster-edit-form.tsx`
- `scripts/sync-mentee-count-from-mentor-mentee.py`
- `scripts/sync-mentee-count-from-mentor-mentee.sh`
