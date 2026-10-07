# scholar-schedule-cli

**Date:** 2026-09-29T143842Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
make cli script that take in a uid, and then takes in a list of days and times to update a scholars schedule for signed up ss and fd hours.
---
Scholar schedule CLI

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.
```

---

## Purpose

Add an ops CLI that replaces one scholar's signed-up front-desk and study-session shifts.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Added scripts/update-scholar-schedule.sh and scripts/update-scholar-schedule.py. The wrapper resolves the Supabase URL and service role the same way as the other ops scripts, then the helper prompts for a scholar UID and a replacement list of front-desk and study-session shifts. It turns off that scholar's active shifts for the active semester and inserts the new list, restoring the old rows if the insert fails. A blank list clears the schedule after confirmation. Overlaps are rejected before any write. Documented the script in docs/dev/scripts/README.md. Checked bash syntax, Python compile, --help, and the shift parser. Frontend and backend tests were not run because those packages were not changed. graphify is not installed in this environment.

---

## Code Changes

- `scripts/update-scholar-schedule.sh`
- `scripts/update-scholar-schedule.py`
- `docs/dev/scripts/README.md`
