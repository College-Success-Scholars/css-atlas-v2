# revert-coordinator-auth-ladder

**Date:** 2026-09-20T225302Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
/code-review the pr

---

for the high errors, what are some suggested solutions?

---

take it out
```

---

## Purpose

Remove the out-of-scope coordinator APP_ROLE_ORDER change from the traffic leave-at PR.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Reviewed PR #102 (traffic leave-at clock). Restored shared/auth.ts and shared/auth.test.ts from origin/develop so APP_ROLE_ORDER is again [null, team_leader, developer] with no coordinator rung or tests. Rebuilt shared/dist. Did not commit. Shared auth + traffic unit tests passed (31); backend tests passed (142). Frontend lib/auth.test.ts still fails 6 coordinator cases (develop baseline). next build still type-errors roster/page.tsx because UserRole includes coordinator independently of the shared ladder.

---

## Code Changes

- `shared/auth.test.ts`
- `shared/auth.ts`
