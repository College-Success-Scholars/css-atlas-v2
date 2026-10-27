# Public tables — importance, secrecy, Atlas use

Schema inventory for CSS Atlas against the linked Supabase `public` schema (regenerated types: [`backend/src/supabase/database.types.ts`](../../../backend/src/supabase/database.types.ts)). Column types/descriptions: [`public-schema.md`](public-schema.md). Access pattern: [`README.md`](README.md).

This doc describes **structure and product use only** — not row data.

## Secrecy scale

| Level | Meaning |
|-------|---------|
| **Critical** | Academic performance, rich mentoring notes, contact channels that enable reach-out, or identity keys that unlock broad PII joins. Restrict to service-role / TL / developer paths. |
| **High** | Scholar-identifiable operational fields (UID, display name, presence tickets, emails on forms). Role-scoped RLS / Express auth required. |
| **Medium** | Program structure or soft PII (roles, teams, schedules, excuse text, assignment links) keyed to a person but not grades. |
| **Low** | Opaque IDs, timestamps, enums, counts, calendar config, or public/kiosk fields with little standalone risk. |
| **Dev-only** | Developer tooling fields; entire table must stay invisible to non-developers. |
| **Ops-secret** | Not scholar PII, but a credential/token that must not leak (e.g. sync tokens). |

**Table secrecy** in the summary matrix is the **highest** column level in that table (Dev-only / Ops-secret called out when they dominate). **Importance** is product criticality for Atlas, not legal classification.

**Join warning:** a `Low` column next to a `High`/`Critical` UID still identifies a person when selected together. Prefer projecting only columns needed for the API.

---

## Summary matrix

| Table | Importance | Table secrecy (max) | Atlas status |
|-------|------------|---------------------|--------------|
| [`profiles`](#profiles) | Critical | Critical | Core auth / identity |
| [`user_roster`](#user_roster) | Critical | Critical | Roster source of truth |
| [`mentor_mentee`](#mentor_mentee) | Critical | High | Mentor ↔ mentee map |
| [`front_desk_logs`](#front_desk_logs) | Critical | High | FD attendance (compute-on-read) |
| [`study_session_logs`](#study_session_logs) | Critical | High | SS attendance (compute-on-read) |
| [`whaf_form_logs`](#whaf_form_logs) | High | Critical | Weekly grades / honors form |
| [`mcf_form_logs`](#mcf_form_logs) | High | Critical | Mentee check-in notes |
| [`wpl_form_logs`](#wpl_form_logs) | High | High | TL weekly project list |
| [`tutor_report_logs`](#tutor_report_logs) | High | High | Tutoring board + Memo |
| [`scholar_week_excuses`](#scholar_week_excuses) | High | High | TL excuses in attendance math |
| [`scholar_shift_assignments`](#scholar_shift_assignments) | High | High | Shift compliance + Slack detectors |
| [`notification_log`](#notification_log) | Medium | Critical | Slack delivery idempotency |
| [`semesters`](#semesters) / [`semester_breaks`](#semester_breaks) | Medium | Low | DB semester scope + break skips |
| [`traffic`](#traffic) | Medium | High* | Kiosk + Memo traffic KPIs |
| [`daily_scholar_activity`](#daily_scholar_activity) | Low | High | Trigger rollup; not Memo path |
| [`dev_test_profiles`](#dev_test_profiles) | Low (ops) | Dev-only | `/dev` act-as personas |
| [`scholar_weekly_stats`](#scholar_weekly_stats) | Low | High | Legacy memo aggregate |
| [`traffic_weekly_summary`](#traffic_weekly_summary) | Low | Low | Legacy memo aggregate |
| [`front_desk_records_legacy`](#front_desk_records_legacy) / [`study_session_records_legacy`](#study_session_records_legacy) | None | High | Frozen — do not use |
| [`am_pm_form_logs`](#am_pm_form_logs) | None yet | High | Google intake; unread by app |
| [`calendar_events`](#calendar_events) | None yet | Medium | Schema present; UI still mock |
| [`calendar_sync_state`](#calendar_sync_state) | None yet | Ops-secret | Sync cursor only |
| [`career_opportunities`](#career_opportunities) | None yet | Low | Stub; internship board is mock |
| [`mentee_meeting_preferences`](#mentee_meeting_preferences) | None yet | High | Remote/schema; no app code |

\* `traffic.uid` is High when present; anonymous entry/exit rows are Low.

---

## Identity & roster

### `profiles`

| | |
|--|--|
| **Importance** | Critical — signed-in user record; roles, `student_id` → roster, Slack id. |
| **Table secrecy** | Critical |
| **How Atlas uses it** | Auth middleware and `/api/auth/me`; complete-profile / login; dual-write with roster on `/dev/profiles`; notification recipient resolution. Created/updated by app (+ `handle_new_user` on auth). |

| Column | Secrecy | Why |
|--------|---------|-----|
| `emails` | Critical | Direct contact; account recovery surface |
| `phone_number` | Critical | Direct contact |
| `slack_user_id` | Critical | Opens Slack DM / identity across systems |
| `student_id` | High | Scholar UID; joins to roster + all scholar data |
| `id` | High | Auth user PK; joins everything about the signed-in person |
| `first_name` / `last_name` / `full_name` | High | Direct identifiers |
| `app_role` | Medium | Privilege level (not PII, but security-sensitive) |
| `program_role` / `status` / `teams` | Medium | Program affiliation |
| `majors` / `minors` / `cohort` | Medium | Soft academic/demographic context |
| `fd_required` / `ss_required` / `mentee_count` | Low | Program numbers |
| `created_at` | Low | Metadata |

### `user_roster`

| | |
|--|--|
| **Importance** | Critical — pre-invite directory and required FD/SS hours; source of truth for roster ops. |
| **Table secrecy** | Critical |
| **How Atlas uses it** | Directory, Memo scholar lists, eligibility, `/dashboard/roster`, mentee joins, developer roster RPCs. App/ops-written. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `email` | Critical | Invite + contact |
| `phone_number` | Critical | Direct contact |
| `uid` | High | Canonical scholar key across Atlas |
| `first_name` / `last_name` | High | Direct identifiers |
| `mentee_uids` | High | Reveals who is assigned to whom |
| `app_role` | Medium | Privilege to copy onto profile |
| `program_role` / `status` / `teams` | Medium | Program affiliation |
| `majors` / `minors` / `cohort` | Medium | Soft academic context |
| `invite_sent_at` / `invite_accepted_at` | Medium | Auth lifecycle (who was invited when) |
| `fd_required` / `ss_required` / `mentee_count` | Low | Program numbers |
| `id` / `created_at` | Low | Row metadata |

### `mentor_mentee`

| | |
|--|--|
| **Importance** | Critical — who mentors whom. |
| **Table secrecy** | High |
| **How Atlas uses it** | `/dashboard/mentee`, Memo “Unassigned”, Slack TL routing, developer assignment replace. App-written. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `mentee_uid` | High | Identifies mentee |
| `mentor_id` | High | Identifies mentor profile |
| `id` / `created_at` | Low | Row metadata |

### `dev_test_profiles`

| | |
|--|--|
| **Importance** | Low for production scholars; high for developer QA. |
| **Table secrecy** | Dev-only (entire table) |
| **How Atlas uses it** | `/dev` profile switcher → `POST /api/dev/active-profile`. RLS hides from non-developers. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `roster_uid` | Dev-only | Impersonation target UID |
| `mentee_uids` | Dev-only | Impersonated TL’s mentee set |
| `app_role` / `program_role` | Dev-only | Privilege while acting as |
| `first_name` / `last_name` / `label` | Dev-only | Persona display |
| `teams` / `cohort` / `fd_required` / `ss_required` / `mentee_count` | Dev-only | Persona snapshot |
| `id` / `is_active` / `created_at` | Dev-only | Switcher plumbing (still developer-gated) |

---

## Attendance & compliance

### `front_desk_logs`

| | |
|--|--|
| **Importance** | Critical — primary FD Entry/Exit tickets. |
| **Table secrecy** | High |
| **How Atlas uses it** | Room, Teams FD, Memo, mentee compliance, `/dev/session-logs`; minutes and shift compliance computed on read. Google Form / kiosk intake. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `scholar_uid` | High | Who was present |
| `scholar_name` | High | Direct identifier at scan time |
| `submitted_by_email` | High | Submitter contact |
| `rep_name` | Medium | Staff name on ticket |
| `created_at` | Medium | Presence timeline when joined to UID |
| `action_type` | Low | Entry/Exit enum |
| `id` | Low | Ticket PK |

### `study_session_logs`

| | |
|--|--|
| **Importance** | Critical — primary SS Entry/Exit tickets. |
| **Table secrecy** | High |
| **How Atlas uses it** | Same stack as FD for study boards, Memo, mentee, detectors. Google Form intake. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `scholar_uid` | High | Who was present |
| `scholar_name` | High | Direct identifier |
| `submitted_by_email` | High | Submitter contact |
| `rep_name` | Medium | Staff name |
| `created_at` | Medium | Presence timeline when joined to UID |
| `action_type` / `session_type` | Low | Enums |
| `id` | Low | Ticket PK |

### `scholar_week_excuses`

| | |
|--|--|
| **Importance** | High — adjusts weekly completion with TL-entered excuse minutes. |
| **Table secrecy** | High |
| **How Atlas uses it** | `PATCH /api/attendance/excuse`; Teams FD/SS boards, mentee monitoring, Memo. App-written. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `description` | High | Free-text reason (often personal) |
| `scholar_uid` | High | Who the excuse is for |
| `updated_by` | Medium | Who wrote it |
| `excuse_min` | Medium | Credited minutes |
| `kind` / `week_start` / `week_num` | Low | Duty kind + week keys |
| `updated_at` | Low | Metadata |

### `scholar_shift_assignments`

| | |
|--|--|
| **Importance** | High — standing weekly FD/SS schedule for no-show / compliance. |
| **Table secrecy** | High |
| **How Atlas uses it** | Compliance APIs and Slack missed-session detectors; updated via ops scripts, not an in-app editor. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `scholar_id` | High | Whose schedule |
| `day_of_week` / `start_time` / `end_time` / `week_minute_range` | Medium | When they are expected in room |
| `session_kind` / `semester_id` / `is_active` | Low | Classification |
| `id` / `created_at` | Low | Row metadata |

### `daily_scholar_activity`

| | |
|--|--|
| **Importance** | Low for primary product — trigger rollup; Memo/attendance use compute-on-read from logs. |
| **Table secrecy** | High |
| **How Atlas uses it** | Optional `GET /api/daily-activity/minutes`; maintained by triggers / `full_resync_daily_scholar_activity`. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `scholar_uid` | High | Who accrued minutes |
| `duration_minutes` | Medium | Activity volume for that person/day |
| `activity_date` / `week_num` / `log_source` | Low | Time + source keys |

### `front_desk_records_legacy` / `study_session_records_legacy`

| | |
|--|--|
| **Importance** | None — frozen; do not read or write. |
| **Table secrecy** | High |
| **How Atlas uses it** | Explicitly avoided (ADR 001). `/dev/session-records` only points people at live attendance APIs. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `excuse` | High | Free-text personal reason |
| `uid` | High | Scholar key (legacy int) |
| `excuse_min` | Medium | Credited minutes |
| `mon_min` … `fri_min` | Medium | Daily presence minutes |
| `week_num` / `id` | Low | Keys |

---

## Weekly forms & academics

### `whaf_form_logs`

| | |
|--|--|
| **Importance** | High — Weekly Academic Honors Form. |
| **Table secrecy** | Critical |
| **How Atlas uses it** | Personal, Memo, mentee views, `/dev/form-logs`, freshman-grades tooling. Google Form intake. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `assignment_grades` | Critical | Per-course grade payload |
| `missed_classes` / `missed_assignments` | Critical | Academic performance signals |
| `course_change_details` | Critical | Add/drop narrative |
| `course_changes` | High | Whether courses changed |
| `scholar_uid` / `scholar_name` | High | Whose grades |
| `submitted_by_email` | High | Submitter contact |
| `team_leader_contact` | Medium | TL name/contact string |
| `tl_meeting_in_person` | Low | Yes/no style field |
| `id` / `created_at` | Low | Row metadata |

### `mcf_form_logs`

| | |
|--|--|
| **Importance** | High — Mentee Check-in Form. |
| **Table secrecy** | Critical |
| **How Atlas uses it** | Personal, Memo, mentee, `/dev/form-logs`. Google Form intake; RLS own-row or team_leader+. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `meeting_notes` | Critical | Free-text mentoring content |
| `support_rank` | Critical | How much support needed |
| `needs_tutor` / `tutoring_status` | Critical | Academic support status |
| `reason_no_meeting` | High | Often personal explanation |
| `tasks_completed` | High | Progress narrative |
| `mentee_uid` / `mentee_name` | High | Mentee identity |
| `mentor_uid` / `mentor_name` | High | Mentor identity |
| `submitted_by_email` | High | Submitter contact |
| `meeting_date` / `meeting_time` / `met_in_person` | Medium | Meeting logistics |
| `id` / `created_at` | Low | Row metadata |

### `wpl_form_logs`

| | |
|--|--|
| **Importance** | High — Weekly Project List (TL workload / meetings). |
| **Table secrecy** | High |
| **How Atlas uses it** | Personal, Memo TL performance, `/dev/form-logs`. Google Form intake. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `explanation` | High | Free-text when hours/meetings short |
| `projects` | High | Structured project list (may name people/work) |
| `scholar_uid` / `full_name` | High | Submitter identity |
| `submitted_by_email` | High | Contact |
| `hours_worked` / `met_with_all` | Medium | Workload / compliance signals |
| `id` / `created_at` | Low | Row metadata |

### `tutor_report_logs`

| | |
|--|--|
| **Importance** | High — tutoring session reports. |
| **Table secrecy** | High |
| **How Atlas uses it** | `/dashboard/teams/tutoring`, Memo, mentee; TLs can delete via API. Google Form intake. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `scholar_uid` | High | Who was tutored |
| `courses` | High | Academic subjects (with UID = course history) |
| `tutor_name` | Medium | Tutor identity |
| `date` / `start_time` / `end_time` | Medium | When they were tutored |
| `id` / `created_at` | Low | Row metadata |

### `am_pm_form_logs`

| | |
|--|--|
| **Importance** | None in Atlas yet (intake exists). |
| **Table secrecy** | High |
| **How Atlas uses it** | Not queried by Express/Next. Documented Google Form destination only. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `uid` | High | Who submitted |
| `leader_name` | Medium | TL on duty |
| `task_completion` | Medium | Shift checklist JSON |
| `shift` | Low | AM/PM |
| `id` / `created_at` | Low | Row metadata |

---

## Notifications & calendar stubs

### `notification_log`

| | |
|--|--|
| **Importance** | Medium — prevents duplicate Slack DMs; audit of delivery. |
| **Table secrecy** | Critical |
| **How Atlas uses it** | Backend notification detectors / service (service-role); no dashboard UI. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `payload` | Critical | Event body may embed scholar/session context |
| `channel_target` | Critical | Slack user/channel destination |
| `recipient_id` | High | Profile FK |
| `error` | Medium | May echo targets or payload fragments |
| `event_type` / `event_ref_id` / `idempotency_key` | Medium | Links to domain events |
| `channel` / `status` / `attempt_count` | Low | Delivery plumbing |
| `id` / `created_at` / `sent_at` | Low | Row metadata |

### `calendar_events`

| | |
|--|--|
| **Importance** | None yet — intended Google Calendar mirror. |
| **Table secrecy** | Medium |
| **How Atlas uses it** | Not wired. `/dashboard/events` still uses mock data. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `description` / `location` / `recording_url` | Medium | May reveal meeting content or links |
| `title` | Medium | Event name may identify private meetings |
| `google_event_id` | Low | External opaque id |
| `start_time` / `end_time` / `status` | Low | Schedule metadata |
| `id` / `updated_at` | Low | Row metadata |

### `calendar_sync_state`

| | |
|--|--|
| **Importance** | None yet — sync cursor for calendar import. |
| **Table secrecy** | Ops-secret |
| **How Atlas uses it** | No Atlas consumer yet. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `sync_token` | Ops-secret | Google sync credential/cursor — do not log or export |
| `last_synced_at` / `id` | Low | Sync bookkeeping |

### `career_opportunities`

| | |
|--|--|
| **Importance** | None yet — stub (`id`, `link`). |
| **Table secrecy** | Low |
| **How Atlas uses it** | Unused; internship board UI is hardcoded mocks. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `link` | Low | Public URL (unless someone stores private links) |
| `id` / `created_at` | Low | Row metadata |

### `mentee_meeting_preferences`

| | |
|--|--|
| **Importance** | None yet. |
| **Table secrecy** | High |
| **How Atlas uses it** | In generated types / remote schema; no backend or frontend references. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `mentee_uid` | High | Whose preference |
| `mentor_id` | High | Which mentor |
| `weekday` / `meeting_time` | Medium | Recurring personal schedule |
| `created_at` / `updated_at` | Low | Metadata |

---

## Calendar config, traffic, legacy aggregates

### `semesters`

| | |
|--|--|
| **Importance** | Medium — active semester row and FK target for semester-scoped tables/RPCs. |
| **Table secrecy** | Low |
| **How Atlas uses it** | `GET /api/auth/semester`; detectors. Product week math mostly comes from `shared/time-config`. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `id` / `name` / `start_date` / `end_date` / `is_active` / `iso_week_offset` / `created_at` | Low | Public program calendar |

### `semester_breaks`

| | |
|--|--|
| **Importance** | Medium for notifications (skip break days). |
| **Table secrecy** | Low |
| **How Atlas uses it** | Notification detectors; not a first-class UI API. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `id` / `semester_id` / `name` / `start_date` / `end_date` / `created_at` | Low | Named break windows |

### `traffic`

| | |
|--|--|
| **Importance** | Medium — room foot traffic for kiosk + Memo charts. |
| **Table secrecy** | High when `uid` set; otherwise Low |
| **How Atlas uses it** | Public `/traffic` inserts; `/dev/traffic`; Memo KPIs via `traffic.service.ts`. One of the few tables Next writes directly. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `uid` | High | Optional scholar identity at kiosk |
| `created_at` | Medium | Timeline (with `uid` = presence) |
| `traffic_type` / `duration_min` | Low | entry/exit + duration string |
| `id` | Low | Event PK |

### `traffic_weekly_summary`

| | |
|--|--|
| **Importance** | Low — legacy weekly aggregate. |
| **Table secrecy** | Low |
| **How Atlas uses it** | Inside legacy `get_weekly_memo` RPC; live Memo uses raw `traffic`. |

| Column | Secrecy | Why |
|--------|---------|-----|
| `semester_id` / `week_num` / `total_entries` / `tutoring_sessions` | Low | Counts only |

### `scholar_weekly_stats`

| | |
|--|--|
| **Importance** | Low — historical weekly memo/flagging aggregate. |
| **Table secrecy** | High |
| **How Atlas uses it** | Legacy `get_weekly_memo` / refresh path; current Memo uses `/api/memo/page-data` (compute-on-read). |

| Column | Secrecy | Why |
|--------|---------|-----|
| `grade_trend` | High | Academic trend derived from grades |
| `scholar_uid` | High | Whose week |
| `is_flagged` / `weeks_flagged` / `missed_tutoring` | Medium | Risk / compliance flags |
| `fd_minutes` / `ss_minutes` / `fd_completion` / `ss_completion` | Medium | Attendance performance |
| `wahf_submitted` / `mcf_submitted` / `wpl_submitted` | Medium | Form compliance booleans |
| `semester_id` / `week_num` / `updated_at` | Low | Keys / metadata |

---

## Kind of writer (who fills the table)

| Kind | Tables |
|------|--------|
| **Google Forms → Postgres** | `am_pm_form_logs`, `front_desk_logs`, `study_session_logs`, `mcf_form_logs`, `whaf_form_logs`, `wpl_form_logs`, `tutor_report_logs` |
| **Atlas / ops writes** | `profiles`, `user_roster`, `mentor_mentee`, `scholar_week_excuses`, `scholar_shift_assignments`, `dev_test_profiles`, `traffic`, `notification_log`, `semesters`, `semester_breaks` |
| **DB triggers / pipelines** | `daily_scholar_activity`; (legacy) `scholar_weekly_stats`, `traffic_weekly_summary` |
| **External / future sync** | `calendar_events`, `calendar_sync_state` |
| **Unused stubs** | `career_opportunities`, `mentee_meeting_preferences` |
| **Frozen** | `front_desk_records_legacy`, `study_session_records_legacy` |

---

## Hottest columns (quick scan)

If you only remember a short list:

| Secrecy | Columns to treat carefully |
|---------|----------------------------|
| **Critical** | `whaf_form_logs.assignment_grades`, `missed_*`, `course_change_details`; `mcf_form_logs.meeting_notes`, `support_rank`, `needs_tutor`, `tutoring_status`; `profiles.emails`, `phone_number`, `slack_user_id`; `user_roster.email`, `phone_number`; `notification_log.payload`, `channel_target` |
| **Ops-secret** | `calendar_sync_state.sync_token` |
| **Dev-only** | All of `dev_test_profiles` |
| **High identity** | Any `*_uid` / `scholar_uid` / `student_id` / `uid`, plus names and `submitted_by_email` on form/log tables |

---

## Handling notes for agents & humans

1. Prefer Express services over Dashboard SQL for lasting changes; new DDL goes in `supabase/migrations/`.
2. Do not dump or `SELECT *` production tables when schema is enough — use types, migrations, or `information_schema`.
3. When APIs need a subset of a row, **omit Critical columns** unless the endpoint’s purpose requires them (e.g. don’t ship `assignment_grades` to a presence widget).
4. After remote schema drift, regen types with `npm run db:types --prefix backend` and update this overview if columns appear.
5. As of the Oct 2026 types regen, remote has migrations `20261023120000` and `20261023140000` not yet present under local `supabase/migrations/`.

*Generated for ops / architecture orientation. Not a legal FERPA memo — escalate policy questions to program leadership.*
