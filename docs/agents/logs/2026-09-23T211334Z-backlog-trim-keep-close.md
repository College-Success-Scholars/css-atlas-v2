# backlog-trim-keep-close

**Date:** 2026-09-23T211334Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
scan all tickets, and see which ones are still nesisary

---

#47-52, #64 #69-#74, #76, #80, #85, #91-97 keep/update as needed
everything else, close or remove
```

---

## Purpose

Keep the named issue ranges, update stale keep-issue bodies, and close everything else as not planned.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Closed 17 issues as not planned (#20, #21, #23, #42–#46, #53–#58, #75, #83, #87). Left 23 open matching the keep list. Updated bodies on #69/#70 (schema now in-scope because #68 shipped no tables), #71 (blocked; ready-for-agent → needs-info), #85 (domain gate done, allowlist remaining), #94 (notifications domain already exists). Commented on #72 that Stage 1 in-room is live. #47–#52, #64, #73, #74, #76, #80, #91–#93, #95–#97 kept as written. #84 was already closed.

---

## Code Changes

- `frontend/app/favicon.ico`
- `frontend/components/dashboard/roles/team-leader-dashboard.tsx`
- `frontend/components/layout/app-sidebar.tsx`
