# Team leader schedules: type and usage sketch

Goal: TLs view and edit every roster scholar's recurring weekly FD/SS shifts from an Eastern Monday onward. Earlier weeks stay as they were.

## Data shape

`scholar_shift_assignments` rows are effective-dated. `is_active` is retired.

```text
id uuid, scholar_id, semester_id, session_kind, day_of_week (0=Sun..6=Sat), start_time, end_time
effective_from  date NOT NULL      inclusive Eastern calendar date
effective_until date NOT NULL      exclusive, always > effective_from, never open ended
effective_dates daterange GENERATED [from, until)   used only by the exclusion constraint
EXCLUDE gist (scholar_id =, week_minute_range &&, effective_dates &&)
```

Legacy active rows become `[semester.start_date, semester.end_date + 1)`. Legacy inactive rows have no known validity, so they move unchanged to `scholar_shift_assignments_legacy_inactive` and never read as schedule.

`scholar_schedule_revisions(scholar_id, semester_id, revision bigint)` is one row per scholar and semester. It is the optimistic-lock token for the whole semester timeline.

## Only writer

`public.replace_scholar_schedule_from_week(p_scholar_id, p_semester_id, p_effective_week_start, p_expected_revision, p_shifts jsonb) returns jsonb`

SECURITY DEFINER, `search_path = ''`, EXECUTE only for `authenticated`. Steps in one transaction:

1. `auth.uid()` must belong to a TL+ profile. Target must be a `user_roster` row. Nothing else about the scholar matters.
2. Semester must be active and contain the week. Week must be a Monday and not before the current Eastern Monday.
3. Lock the revision row (insert on conflict do nothing, then `FOR UPDATE`). Compare with the expected value, else `CS409`.
4. Validate shifts: kind, day 0-6, end > start, no weekly overlap across FD and SS.
5. Rows with `effective_until > from`: delete when they start at or after `from` (unless identical and in effect at `from`), truncate to `from` when they began earlier, retain and extend to the semester end when they are identical to a requested shift and in effect at `from`.
6. Insert new ids for the remaining requested shifts, `[from, semester.end_date + 1)`.
7. Bump the revision and return the canonical schedule.

`public.get_schedule_snapshot(p_week_start date, p_scholar_id text default null) returns jsonb` reads rows and revisions in one statement. It is SECURITY DEFINER with the same TL+ check.

Direct INSERT/UPDATE/DELETE on both tables is revoked from `anon`, `authenticated` and `service_role`.

## Backend

```ts
// shift-assignment.service.ts: the one owner of "is this row valid on this date"
isAssignmentEffectiveOn(row, dateKey): boolean
fetchEffectiveAssignments(client, { scholarIds?, semesterId?, startKey, endKey, kind?, dayOfWeek? }): Promise<ScholarShiftAssignment[]>
expandAssignmentOccurrences(rows, startKey, endKey): AssignmentOccurrence[]  // { assignment, dateKey, occurrenceRef }
findSemesterForDate(client, dateKey)
replaceScholarScheduleFromWeek(input): Promise<ScheduleSnapshot>   // rpc wrapper, maps error codes
getScheduleSnapshot(weekStart, scholarId?)
```

Routes (TL+, `requireTeamLeaderOrAbove`; PUT is already rejected while acting as a test profile):

```text
GET /api/schedules?week=YYYY-MM-DD            board: all roster people + shifts + revision for that week
GET /api/schedules/:uid?week=YYYY-MM-DD       one scholar snapshot
PUT /api/schedules/:uid                       { semesterId, effectiveWeekStart, expectedRevision, shifts[] }
```

Errors: 400 validation, 403 forbidden, 404 unknown scholar, 409 stale revision or no active semester, 422 past week or wrong semester.

The `/api/dev/schedule-board` routes call the same service and need the same body. Dev router stays developer-only.

## Frontend

`/dashboard/schedules` (server page + client `ScheduleManager`). Scholar list with search, week selector (Mondays of the active semester), weekday select, start and end time inputs, add and remove rows, pending state, draft kept on error. The save banner says it replaces all planned weeks from the chosen Monday through semester end.
