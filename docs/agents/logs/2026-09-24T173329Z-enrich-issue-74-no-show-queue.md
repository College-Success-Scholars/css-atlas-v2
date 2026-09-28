# enrich-issue-74-no-show-queue

**Date:** 2026-09-24T173329Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
enrich issue #74
```

---

## Purpose

Rewrite issue #74 into a Room Monitoring no-show spec grounded in the current tree.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Updated GitHub issue #74 (Expected-slot no-show queue) with a spec: two lists on /dashboard/room, current Eastern slot, activity-matched in-room subtraction via the existing in-room fetches, no grace window, and the absent slice of #72 when that join exists. Left needs-info because hour-signup tables still do not exist (#69/#70). Commented the same on the issue.

---

## Code Changes

- `backend/src/domains/notifications/detectors/reconciliation-detector.ts`
- `backend/src/domains/notifications/detectors/signin-detector.ts`
