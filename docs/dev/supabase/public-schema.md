# Public schema (`public`)

Column catalog for Postgres `public` as applied by [`supabase/migrations/`](../../../supabase/migrations). Types and nullability come from those migrations; generated TypeScript is [`backend/src/supabase/database.types.ts`](../../../backend/src/supabase/database.types.ts).

There are no views in `public`. Operational form and session-log tables are filled by Google Forms → Supabase; the app mostly reads them. See [Form / log intake](README.md#form--log-intake-google-forms).

| Table | Role |
|-------|------|
| [`am_pm_form_logs`](#am_pm_form_logs) | AM/PM shift task-completion logs |
| [`daily_scholar_activity`](#daily_scholar_activity) | Per-day FD/SS minute rollup (trigger-maintained) |
| [`dev_test_profiles`](#dev_test_profiles) | Developer “act as” personas |
| [`front_desk_logs`](#front_desk_logs) | Front-desk check-in/out tickets |
| [`front_desk_records_legacy`](#front_desk_records_legacy) | Frozen FD weekly rollup — do not use |
| [`mcf_form_logs`](#mcf_form_logs) | Mentee Check-in Form (MCF) |
| [`mentor_mentee`](#mentor_mentee) | Mentor → mentee assignments |
| [`profiles`](#profiles) | Canonical signed-in user profile |
| [`scholar_shift_assignments`](#scholar_shift_assignments) | Standing weekly FD/SS shift assignments (planned occupancy) |
| [`scholar_week_excuses`](#scholar_week_excuses) | TL-entered weekly FD/SS excuses |
| [`scholar_weekly_stats`](#scholar_weekly_stats) | Per-scholar weekly memo stats |
| [`semester_breaks`](#semester_breaks) | Named break windows inside a semester |
| [`semesters`](#semesters) | Academic semester calendar |
| [`study_session_logs`](#study_session_logs) | Study-session check-in/out tickets |
| [`study_session_records_legacy`](#study_session_records_legacy) | Frozen SS weekly rollup — do not use |
| [`traffic`](#traffic) | Public kiosk foot-traffic entries/exits |
| [`traffic_weekly_summary`](#traffic_weekly_summary) | Weekly traffic aggregate |
| [`tutor_report_logs`](#tutor_report_logs) | Tutoring session reports |
| [`user_roster`](#user_roster) | Pre-invite roster (source of truth for roster ops) |
| [`whaf_form_logs`](#whaf_form_logs) | Weekly Academic Honors Form (WAHF; table spelled `whaf`) |
| [`wpl_form_logs`](#wpl_form_logs) | Weekly Project List (WPL) |

---

## `am_pm_form_logs`

Google Form intake for AM/PM shift task completion. PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` identity | Row primary key. |
| `created_at` | `timestamptz` | When the form row was inserted. |
| `uid` | `text` | Scholar or leader UID who submitted the shift log. |
| `shift` | `text` | Which shift this log covers (AM or PM). |
| `leader_name` | `text` | Display name of the team leader on duty. |
| `task_completion` | `jsonb` | Structured checklist of tasks marked complete for the shift. |

---

## `daily_scholar_activity`

Trigger-maintained daily minutes from session tickets. PK `(scholar_uid, activity_date, log_source)`. Not used for Memo (ISO-week, no excuses).

| Column | Type | Description |
|--------|------|-------------|
| `scholar_uid` | `text` not null | Scholar UID the minutes belong to. |
| `activity_date` | `date` not null | Calendar day of the activity (Eastern date from the log). |
| `week_num` | `integer` | Campus/ISO week number denormalized onto the day. |
| `log_source` | `text` not null | Source table: `front_desk_logs` or `study_session_logs`. |
| `duration_minutes` | `integer` default `0` | Minutes logged that day for this source. |

---

## `dev_test_profiles`

Developer-only personas for the `/dev` profile switcher. PK `id`. Invisible to non-developers via RLS.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` not null | Persona id sent by the client (never the raw roster UID). |
| `label` | `text` not null | Human label in the switcher (e.g. “Scholar — on track”). |
| `roster_uid` | `text` not null | `user_roster.uid` this persona impersonates. |
| `program_role` | `text` | Program role snapshot (scholar, team leader, …). |
| `app_role` | `text` | App-role snapshot used for access while acting as. |
| `first_name` | `text` | Display first name for the persona. |
| `last_name` | `text` | Display last name for the persona. |
| `cohort` | `integer` | Cohort year snapshot. |
| `fd_required` | `integer` | Front-desk minutes required per week for this persona. |
| `ss_required` | `integer` | Study-session minutes required per week for this persona. |
| `teams` | `text[]` not null | Team names attached to the persona. |
| `mentee_uids` | `text[]` not null | Mentee UIDs when acting as a team leader. |
| `mentee_count` | `integer` not null | Count of assigned mentees. |
| `is_active` | `boolean` not null | Whether this persona appears in the switcher. |
| `created_at` | `timestamptz` not null | When the persona row was created. |

---

## `front_desk_logs`

Google Form / kiosk tickets for front-desk check-in and check-out. PK `id`. Minutes are computed on read from paired Entry/Exit tickets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` not null | Ticket primary key. |
| `created_at` | `timestamptz` | When the check-in or check-out was recorded. |
| `rep_name` | `text` | Name of the staff/rep who recorded the ticket. |
| `scholar_name` | `text` | Scholar display name at scan time. |
| `scholar_uid` | `text` | Scholar UID the ticket belongs to. |
| `action_type` | `text` | `Entry` or `Exit`. |
| `submitted_by_email` | `text` | Email of the Google Form submitter, if present. |

---

## `front_desk_records_legacy`

Frozen snapshot of the old weekly FD minute rollup. **Do not read or write at runtime.** Minutes come from `front_desk_logs`; excuses live in `scholar_week_excuses`. PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` identity | Row primary key. |
| `uid` | `integer` | Scholar UID stored as an integer in the legacy dump. |
| `week_num` | `smallint` | Campus week this rollup covered. |
| `mon_min` | `smallint` | Monday front-desk minutes. |
| `tues_min` | `smallint` | Tuesday front-desk minutes. |
| `wed_min` | `smallint` | Wednesday front-desk minutes. |
| `thurs_min` | `smallint` | Thursday front-desk minutes. |
| `fri_min` | `smallint` | Friday front-desk minutes. |
| `excuse_min` | `smallint` | Excuse minutes credited for the week. |
| `excuse` | `text` | Free-text excuse reason. |

---

## `mcf_form_logs`

Mentee Check-in Form (MCF) submissions. PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` not null | Form row primary key. |
| `created_at` | `timestamptz` not null | When the MCF was submitted. |
| `mentor_name` | `text` | Mentor display name. |
| `mentor_uid` | `text` | Mentor UID. |
| `mentee_name` | `text` | Mentee display name. |
| `mentee_uid` | `text` | Mentee UID. |
| `meeting_date` | `text` | Date the mentor/mentee meeting happened. |
| `meeting_time` | `text` | Time of that meeting. |
| `met_in_person` | `text` | Whether the meeting was in person. |
| `reason_no_meeting` | `text` | Why no meeting occurred, if applicable. |
| `tasks_completed` | `text` | Tasks completed during the check-in. |
| `meeting_notes` | `text` | Free-text notes from the meeting. |
| `tutoring_status` | `text` | Current tutoring status for the mentee. |
| `needs_tutor` | `text` | Whether the mentee needs a tutor. |
| `support_rank` | `text` | How much support the mentee currently needs. |
| `submitted_by_email` | `text` | Email of the Google Form submitter. |

---

## `mentor_mentee`

Canonical mentor–mentee join. PK `id`; unique `(mentor_id, mentee_uid)`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` identity | Row primary key. |
| `mentor_id` | `uuid` not null | Mentor `profiles.id` (FK, cascade on delete). |
| `mentee_uid` | `text` not null | Mentee `user_roster.uid` (FK). |
| `created_at` | `timestamptz` not null | When the assignment was created. |

---

## `profiles`

Canonical signed-in user row (created after invite accept or complete-profile). PK `id` (= `auth.users.id`). `student_id` FK → `user_roster.uid`. After invite acceptance this table is canonical for the person; roster stays canonical for roster ops.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` not null | Auth user id; also the profile primary key. |
| `created_at` | `timestamptz` not null | When the profile row was created. |
| `first_name` | `text` | Given name. |
| `last_name` | `text` | Family name. |
| `student_id` | `text` | Scholar UID; joins to `user_roster.uid`. |
| `cohort` | `integer` | Entering cohort year. |
| `status` | `text` | Program status (`enrolled` / `inactive` / `graduated`). |
| `app_role` | `text` default `'scholar'` | App access role (`scholar`, `team_leader`, `developer`, …). Not writable via the app; change in SQL. |
| `program_role` | `text` | Program-facing role (Scholar, Team Leader, …). |
| `fd_required` | `integer` default `0` | Weekly front-desk minutes required. |
| `ss_required` | `integer` default `0` | Weekly study-session minutes required. |
| `mentee_count` | `integer` default `0` | Number of assigned mentees (team leaders). `-1` means no `mentor_mentee` row yet. |
| `phone_number` | `text` | Contact phone. |
| `full_name` | `text` generated | Stored `first_name \|\| ' ' \|\| last_name`; do not insert. |
| `emails` | `text[]` | Email addresses on the profile. |
| `majors` | `text[]` | Declared majors. |
| `minors` | `text[]` | Declared minors. |
| `teams` | `text[]` | Team names this person belongs to. |

---

## `scholar_shift_assignments`

Standing weekly shift assignments - who is *supposed* to be working front desk or a
study session. Planned occupancy only; actual attendance lives in the log tables and
is compared against this on read (`backend/src/services/session-log.service.ts`).
Loaded from the sign-up sheets by [`scripts/ingest-signups.sh`](../scripts/README.md#ingest-signupssh).
PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Row primary key, defaulted from `gen_random_uuid()`. |
| `scholar_id` | `uuid` | FK -> `profiles.id`. The log tables key on `scholar_uid` = `profiles.student_id`, so joining schedule to logs goes through `profiles`. |
| `semester_id` | `integer` | FK -> `semesters.id`. The assignment holds for this semester. |
| `session_kind` | `session_kind` | `front_desk` or `study_session`. |
| `day_of_week` | `smallint` | Postgres DOW: 0=Sunday .. 6=Saturday, matching `getEasternDayOfWeek()`. Sheets fill 1-5. |
| `start_time` | `time` | Shift start, Eastern wall-clock. |
| `end_time` | `time` | Shift end, Eastern wall-clock. Must be later than `start_time`. |
| `is_active` | `boolean` | Whether the assignment is in force. Compliance reads filter `is_active = true`; the overlap constraint applies only to active rows. |
| `source` | `text` | How the row arrived. `google_sheet` for sheet loads. |
| `source_tab` | `text` | Diagnostics: workbook tab the row came from. Also scopes what a reload replaces. |
| `source_name` | `text` | Diagnostics: raw name fragment from the sheet cell. |
| `match_method` | `text` | Diagnostics: how the name resolved (`student_id`, `name_exact`, `alias`, ...). |
| `load_batch_id` | `uuid` | Diagnostics: which ingest run inserted the row. |
| `created_at` | `timestamptz` | Row insert time. |
| `updated_at` | `timestamptz` | Last write time. |

Constraints: `no_overlapping_shift_assignments` is a GiST exclusion constraint (partial
on `is_active`) preventing one scholar holding two overlapping shifts of the same kind
on the same weekday - the one piece of business logic kept in the schema. The front-desk
cap of three people per slot is deliberately *not* enforced here.

---

## `scholar_week_excuses`

Team-leader-entered weekly excuses. Source of truth for FD/SS excuse minutes and notes (not the frozen `*_records_legacy` tables). PK `(scholar_uid, week_start, kind)`. `kind` is `front_desk` or `study_session`.

| Column | Type | Description |
|--------|------|-------------|
| `scholar_uid` | `text` not null | Scholar the excuse applies to. |
| `week_start` | `date` not null | Campus-week range start (Eastern); identity with `scholar_uid`+`kind` so `week_num` can repeat across years. Monday for most weeks; winter-break week uses `WINTER_BREAK_FIRST_DAY`. |
| `week_num` | `integer` not null | Denormalized campus week number for the current time-config; not unique across years. |
| `kind` | `text` not null | Duty kind: `front_desk` or `study_session`. |
| `excuse_min` | `smallint` | Excuse minutes credited (≥ 0 if set). |
| `description` | `text` | Reason / note for the excuse. |
| `updated_by` | `text` | Who last wrote the excuse. |
| `updated_at` | `timestamptz` not null | When the excuse was last updated. |

---

## `scholar_weekly_stats`

Per-scholar weekly aggregates used by Memo / flagging. PK `(scholar_uid, semester_id, week_num)`. `semester_id` FK → `semesters.id`.

| Column | Type | Description |
|--------|------|-------------|
| `scholar_uid` | `text` not null | Scholar this week of stats belongs to. |
| `semester_id` | `integer` not null | Semester these stats are in. |
| `week_num` | `integer` not null | Campus week number within that semester. |
| `fd_minutes` | `integer` not null | Front-desk minutes logged that week. |
| `ss_minutes` | `integer` not null | Study-session minutes logged that week. |
| `fd_completion` | `numeric(5,2)` not null | Front-desk completion percent. |
| `ss_completion` | `numeric(5,2)` not null | Study-session completion percent. |
| `wahf_submitted` | `boolean` not null | Whether a WAHF was submitted that week. |
| `mcf_submitted` | `boolean` not null | Whether an MCF was submitted that week. |
| `wpl_submitted` | `boolean` not null | Whether a WPL was submitted that week. |
| `weeks_flagged` | `integer` not null | Running count of flagged weeks. |
| `grade_trend` | `text` | `improving` / `flat` / `declining` from `compute_grade_trend`. |
| `missed_tutoring` | `boolean` not null | Whether required tutoring was missed. |
| `is_flagged` | `boolean` not null | Whether this week is currently flagged. |
| `updated_at` | `timestamptz` not null | Last time this stats row was refreshed. |

---

## `semester_breaks`

Named break windows that must fall inside their semester. PK `id`. `semester_id` FK → `semesters.id` (cascade).

| Column | Type | Description |
|--------|------|-------------|
| `id` | `integer` | Break primary key. |
| `semester_id` | `integer` not null | Parent semester. |
| `name` | `text` not null | Break label (e.g. winter break). |
| `start_date` | `date` not null | First day of the break. |
| `end_date` | `date` not null | Last day of the break (`>= start_date`). |
| `created_at` | `timestamptz` not null | When the break row was created. |

---

## `semesters`

Academic semester calendar. PK `id`; unique `name`; at most one row with `is_active = true`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `integer` | Semester primary key. |
| `name` | `text` not null | Display name (unique). |
| `start_date` | `date` not null | First day of the semester. |
| `end_date` | `date` not null | Last day of the semester (`> start_date`). |
| `is_active` | `boolean` not null | Whether this is the current semester. |
| `created_at` | `timestamptz` not null | When the semester row was created. |
| `iso_week_offset` | `integer` not null | Offset used to map calendar dates onto program week numbers. |

---

## `study_session_logs`

Google Form / kiosk tickets for study-session check-in and check-out. PK `id`. Minutes are computed on read from paired Entry/Exit tickets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` not null | Ticket primary key. |
| `created_at` | `timestamptz` | When the check-in or check-out was recorded. |
| `rep_name` | `text` | Name of the staff/rep who recorded the ticket. |
| `scholar_name` | `text` | Scholar display name at scan time. |
| `scholar_uid` | `text` | Scholar UID the ticket belongs to. |
| `action_type` | `text` | `Entry` or `Exit`. |
| `session_type` | `text` default `'Study Session'` | Session kind on the ticket. |
| `submitted_by_email` | `text` | Email of the Google Form submitter, if present. |

---

## `study_session_records_legacy`

Frozen snapshot of the old weekly SS minute rollup (same shape as `front_desk_records_legacy`). **Do not read or write at runtime.** Minutes come from `study_session_logs`; excuses live in `scholar_week_excuses`. PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` identity | Row primary key. |
| `uid` | `integer` | Scholar UID stored as an integer in the legacy dump. |
| `week_num` | `smallint` | Campus week this rollup covered. |
| `mon_min` | `smallint` | Monday study-session minutes. |
| `tues_min` | `smallint` | Tuesday study-session minutes. |
| `wed_min` | `smallint` | Wednesday study-session minutes. |
| `thurs_min` | `smallint` | Thursday study-session minutes. |
| `fri_min` | `smallint` | Friday study-session minutes. |
| `excuse_min` | `smallint` | Excuse minutes credited for the week. |
| `excuse` | `text` | Free-text excuse reason. |

---

## `traffic`

Public `/traffic` kiosk foot-traffic events (insert-only from the kiosk). PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` identity | Event primary key. |
| `created_at` | `timestamptz` not null | When the kiosk event was recorded. |
| `uid` | `text` | Optional scholar UID if the visitor identified. |
| `traffic_type` | `text` | `entry` or `exit`. |
| `duration_min` | `text` | Duration string when an exit is paired (legacy text, not a number). |

---

## `traffic_weekly_summary`

Weekly rollup of kiosk traffic. PK `(semester_id, week_num)`. `semester_id` FK → `semesters.id`.

| Column | Type | Description |
|--------|------|-------------|
| `semester_id` | `integer` not null | Semester this week belongs to. |
| `week_num` | `integer` not null | Campus week number. |
| `total_entries` | `integer` not null | Count of traffic entries that week. |
| `tutoring_sessions` | `integer` not null | Count of tutoring sessions that week. |

---

## `tutor_report_logs`

Tutoring form submissions. PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` identity | Report primary key. |
| `created_at` | `timestamptz` | When the report was submitted. |
| `tutor_name` | `text` not null | Tutor who ran the session. |
| `scholar_uid` | `text` | Scholar who was tutored. |
| `end_time` | `text` not null | Session end time (form text). |
| `start_time` | `text` not null | Session start time (form text). |
| `courses` | `text[]` not null | Courses covered in the session. |
| `date` | `text` | Calendar day of the session, when present. |

---

## `user_roster`

Pre-invite staging table and source of truth for roster management only. After invite acceptance, `profiles` is canonical for the person. PK `id`; unique `uid`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` identity | Roster row primary key. |
| `created_at` | `timestamptz` not null | When the roster row was created. |
| `uid` | `text` unique | Scholar UID (joins from `profiles.student_id` and mentee FKs). |
| `first_name` | `text` | Given name on the roster. |
| `last_name` | `text` | Family name on the roster. |
| `phone_number` | `text` | Contact phone. |
| `email` | `text` | Invite / contact email. |
| `cohort` | `bigint` | Entering cohort year. |
| `status` | `text` | Roster status (`enrolled` / `inactive` / `graduated`). |
| `app_role` | `text` | App access role to copy onto the profile at invite. Not writable via the app. |
| `program_role` | `text` | Program-facing role. |
| `fd_required` | `bigint` | Weekly front-desk minutes required. |
| `ss_required` | `bigint` | Weekly study-session minutes required. |
| `mentee_count` | `bigint` | Number of assigned mentees. `-1` means a team leader has no `mentor_mentee` row yet. |
| `majors` | `text[]` | Declared majors. |
| `minors` | `text[]` | Declared minors. |
| `mentee_uids` | `text[]` | Assigned mentee UIDs (team leaders). |
| `teams` | `text[]` | Team names on the roster. |
| `invite_accepted_at` | `timestamptz` | When the Auth invite was accepted. |
| `invite_sent_at` | `timestamptz` | When the Auth invite was sent. |

---

## `whaf_form_logs`

Weekly Academic Honors Form (WAHF) submissions. Table name is spelled `whaf`. PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` not null | Form row primary key. |
| `created_at` | `timestamptz` not null | When the WAHF was submitted. |
| `scholar_name` | `text` | Scholar display name. |
| `team_leader_contact` | `text` | Team leader the scholar met with / contacted. |
| `tl_meeting_in_person` | `text` | Whether the TL meeting was in person. |
| `course_changes` | `text` | Whether courses changed this week. |
| `assignment_grades` | `jsonb` | Per-course assignment grades (e.g. `{ "CMSC420": { "Exam": "90%" } }`). |
| `missed_classes` | `text` | Classes missed this week. |
| `missed_assignments` | `text` | Assignments missed this week. |
| `submitted_by_email` | `text` | Email of the Google Form submitter. |
| `course_change_details` | `text` | Details of any course add/drop. |
| `scholar_uid` | `text` | Scholar UID. |

---

## `wpl_form_logs`

Weekly Project List (WPL) submissions. PK `id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` identity | Form row primary key. |
| `created_at` | `timestamptz` | When the WPL was submitted. |
| `full_name` | `text` | Submitter display name. |
| `scholar_uid` | `text` | Scholar UID. |
| `hours_worked` | `numeric` | Hours worked on projects that week. |
| `projects` | `jsonb` | Structured list of projects. |
| `met_with_all` | `text` | Whether the scholar met with everyone they needed to. |
| `explanation` | `text` | Free-text explanation when meetings or hours are short. |
| `submitted_by_email` | `text` | Email of the Google Form submitter. |
