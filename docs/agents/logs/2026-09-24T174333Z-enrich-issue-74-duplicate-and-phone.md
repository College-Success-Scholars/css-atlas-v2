# enrich-issue-74-duplicate-and-phone

**Date:** 2026-09-24T174333Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
enrich issue #74

---

for #74, also add to cross reference duplicate signins between both table (in that it shouldn't be allowed and highlight the offending scholar in red), and display phone numbers next to scholars who aren't in the room, but are supposed to be
```

---

## Purpose

Add double-signup highlighting and no-show phone numbers to issue #74.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Updated issue #74 twice. First pass locked the Room Monitoring no-show spec. Second pass added a cross-check: the same scholar on both FD and SS signup tables for the current slot is shown in red and kept on the lists, and each no-show row shows user_roster.phone_number. Labels stay needs-info until #69 and #70 ship tables.

---

## Code Changes

- `backend/src/domains/notifications/detectors/reconciliation-detector.ts`
- `backend/src/domains/notifications/detectors/signin-detector.ts`
