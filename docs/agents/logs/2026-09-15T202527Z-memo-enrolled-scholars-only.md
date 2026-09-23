# memo-enrolled-scholars-only

**Date:** 2026-09-15T202527Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
make the weekly memo only show scholars that are currently enrolledm from user_roster status
```

---

## Purpose

Restrict weekly memo scholar lists to user_roster status enrolled.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Scoped weekly memo scholar rows, WAHF census, and grade breakdown to eligible scholars whose user_roster.status is enrolled (inactive/graduated and non-scholar WAHF grades no longer appear). Added isEnrolledScholar and applied it in isEligibleScholar and fetchScholarUids. Backend tests (131) and production build passed. Graphify CLI is not installed.

---

## Code Changes

- `backend/API.md`
- `backend/src/services/memo-page.service.ts`
- `backend/src/services/user.service.ts`
- `backend/src/tests/memo.test.ts`
- `backend/src/tests/user.service.test.ts`
- `docs/dev/frontend/app/dashboard/memo/README.md`
