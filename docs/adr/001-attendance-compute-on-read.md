# ADR 001: Compute-on-read attendance

**Status:** Accepted  
**Date:** 2026-08-20  
**Issues:** #29, #32, #33, #34

## Decision

Weekly FD/SS **minutes** are computed on read from cleaned session tickets (`front_desk_logs` / `study_session_logs`) using `computeWeeklyMinutesByUid` and the campus calendar (`campusWeekToDateRange`). **Excuses** live in `scholar_week_excuses`, keyed by `(scholar_uid, week_start, kind)`.

We do **not** store weekly minute rollups in `front_desk_records` / `study_session_records` (those tables are frozen as `*_legacy`). We do **not** use `daily_scholar_activity` for Memo (ISO-week, no excuses).

## Why

Synced `*_records` drifted from tickets whenever sync did not run. Compute-on-read makes Memo and `/api/attendance` share one math path. Volume is one campus week of paired tickets — acceptable without a projection table.

## Rollback

Stage 3 originally called for `MEMO_ATTENDANCE_SOURCE=records|tickets`. Stages 4–5 of the same change set remove the records APIs, so that env flag is not shipped. Rollback is reverting the PR.

## Consequences

- Memo GET `/api/memo/page-data` uses `getCampusWeekAttendance`.
- Mentee monitoring FD/SS hours use `POST /api/attendance/week/:weekNum/by-uids` (same tickets + `scholar_week_excuses` math).
- Product excuse writes go to `PATCH /api/attendance/excuse` only.
- Historical `*_records.excuse_min` is not backfilled; only `scholar_week_excuses` counts.
