# drop-coordinator-ui-role-for-build

**Date:** 2026-09-20T230408Z
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

---

fix the build in the same way, removing that check for now
```

---

## Purpose

Unblock next build by removing the frontend coordinator UserRole check until the shared ladder lands.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Dropped coordinator from frontend UserRole, resolveUserRole, formatUserRoleLabel, and canAccessCoordinatorView (developer-only via team_leader/developer ladder). Updated frontend/lib/auth.test.ts to match. next build typechecks; frontend 156 tests passed. Coordinator maps to default until APP_ROLE_ORDER includes it. Did not commit.

---

## Code Changes

- `frontend/lib/auth.test.ts`
- `frontend/lib/auth.ts`
