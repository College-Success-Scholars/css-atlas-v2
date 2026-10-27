# assign-mentor-mentee

**Date:** 2026-10-08T190202Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
do i have a script to add mentor mentee relationships?

---

make one that handles making sure that handles inputting, ensuring one mentee has only one mentor

---

take a mentors student_id and find their profile (throw an error if multiple profiles), to pair it up

---

Assign mentor–mentee script

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.
```

---

## Purpose

Add an ops script that pairs one mentee to a mentor looked up by student_id and confirms before replacing any other mentor.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Answered that no existing script inserts mentor_mentee rows. Added scripts/assign-mentor-mentee.sh and scripts/assign-mentor-mentee.py. The shell sources supabase-env.sh. The helper requires exactly one profiles row for the mentor student_id, refuses a self-pair, and leaves a mentee who already has only that mentor unchanged. Any other assignment is replaced only after yes, by deleting every mentor_mentee row for that mentee and inserting one so the sync trigger updates both mentors. If the insert fails, the previous rows are restored. Documented the script in docs/dev/scripts/README.md. Checked shell syntax, Python compile, help text, extra-argument handling, and the assign-versus-move wording. Did not call Supabase.

---

## Code Changes

- `scripts/assign-mentor-mentee.sh`
- `scripts/assign-mentor-mentee.py`
- `docs/dev/scripts/README.md`
