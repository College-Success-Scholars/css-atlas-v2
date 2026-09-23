# CSS Atlas Backend API Documentation

Base URL: `/api`

All endpoints require a valid Supabase JWT in the `Authorization: Bearer <token>` header unless otherwise noted. Auth levels:

- **requireAuth** -- Any authenticated user.
- **requireTeamLeaderOrAbove** / **requireTeamLeaderRole** -- User must have `app_role` of `team_leader` or higher. `requireTeamLeaderRole` is the same check after `requireAuth` already ran.
- **requireSelfOrTeamLeader** -- Own roster uid (`:uid`) or team_leader+.
- **requireSelfScholarIdOrTeamLeader** -- Own body `scholarId` / `studentId` or team_leader+. Missing id is allowed (empty result).
- **requireDeveloper** -- User must have `app_role` of `developer`.

All error responses follow the shape `{ error: string }`.

---

## Auth

All routes under `/api/auth` require **requireAuth**.

### `GET /api/auth/me`

**Auth:** requireAuth
**Description:** Returns the authenticated user's identity and full profile (merged with user_roster data).
**Request:** None
**Response:**
```json
{
  "user": { "id": "uuid", "email": "string" },
  "profile": { /* profiles row with merged roster fields */ }
}
```

---

### `GET /api/auth/profile`

**Auth:** requireAuth
**Description:** Returns the raw profile row for the authenticated user from the `profiles` table.
**Request:** None
**Response:**
```json
{ "data": { /* profiles row */ } }
```
**Errors:** `404` when no profile row exists for the user.

---

### `POST /api/auth/profile`

**Auth:** requireAuth
**Description:** Self-service scholar onboarding — creates a `profiles` row for the authenticated user. Requires a UMD email (`@umd.edu` or `@terpmail.umd.edu`). Sets `program_role: "scholar"`, `app_role: null`, `full_name`, and explicit defaults for all other profile columns (see `buildScholarProfileInsertRow` in `user.service.ts`).
**Request Body:**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "student_id": "123456789",
  "phone_number": "3015550100",
  "cohort": 2025
}
```
**Response:** `201`
```json
{ "data": { /* profiles row */ } }
```
**Errors:** `409` if profile already exists; `403` if auth email is not UMD; `400` for invalid body.

---

### `GET /api/auth/mentees`

**Auth:** requireAuth
**Description:** Calls the `get_my_mentees` RPC to return the current user's assigned mentees.
**Request:** None
**Response:**
```json
{ "data": [ /* mentee rows */ ] }
```

---

### `GET /api/auth/semester`

**Auth:** requireAuth
**Description:** Returns the currently active semester from the Supabase `semesters` table. Alias: `/api/auth/active-semester`.

**Use sparingly.** Prefer the server-owned time frame — the shared campus week calendar (`shared/time-config.ts` / `shared/campus-calendar`) — for week bounds, navigation, and data queries. Use this endpoint when the server-owned time frame does not make sense (e.g. looking at historical data, or the collection year has not started yet), or when you need the DB semester row (e.g. `semester_id` or legacy ISO-week clamping) — not as the primary calendar source for the current collection year.

**Request:** None
**Response:**
```json
{ "data": { "id": 1, "iso_week_offset": 0, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" } }
```

---

### `GET /api/auth/active-semester`

**Auth:** requireAuth
**Description:** Same as `GET /api/auth/semester` (including the same sparingly / prefer server-owned time frame guidance).

---

## Users

All routes under `/api/users` require **requireAuth**.

### `POST /api/users/scholar-names`

**Auth:** requireAuth
**Description:** Given an array of UIDs, returns a map of UID to scholar display name.
**Request Body:**
```json
{ "uids": ["uid1", "uid2"] }
```
**Response:**
```json
{ "data": { "uid1": "Name One", "uid2": "Name Two" } }
```

---

### `POST /api/users/required-hours`

**Auth:** requireAuth
**Description:** Given an array of UIDs, returns a map of UID to required hours.
**Request Body:**
```json
{ "uids": ["uid1", "uid2"] }
```
**Response:**
```json
{ "data": { "uid1": 10, "uid2": 8 } }
```

---

### `POST /api/users/eligible-scholars`

**Auth:** requireAuth
**Description:** Filters the given UIDs to enrolled freshman/sophomore scholars with required hours.
**Request Body:**
```json
{ "uids": ["uid1", "uid2"] }
```
**Response:**
```json
{ "data": ["uid1"] }
```

---

### `GET /api/users/all-uids`

**Auth:** requireAuth
**Description:** Returns all user UIDs in the system.
**Request:** None
**Response:**
```json
{ "data": ["uid1", "uid2", "..."] }
```

---

### `GET /api/users/memo-users`

**Auth:** requireAuth
**Description:** Returns all users relevant for memo generation.
**Request:** None
**Response:**
```json
{ "data": [ /* user objects */ ] }
```

---

### `GET /api/users/team-leaders`

**Auth:** requireAuth
**Description:** Returns roster rows whose `program_role` is not scholar or Coordinator and whose `user_roster.status` is enrolled (team leader performance / form stats). Inactive and graduated rows are omitted. Program Coordinator still appears.
**Request:** None
**Response:**
```json
{ "data": [ /* team leader objects */ ] }
```

---

### `GET /api/users/scholar-uids`

**Auth:** requireAuth
**Description:** Returns UIDs for scholars whose `user_roster.status` is enrolled. Inactive and graduated roster rows are omitted.
**Request:** None
**Response:**
```json
{ "data": ["uid1", "uid2", "..."] }
```

---

### `GET /api/users/:uid`

**Auth:** requireAuth
**Description:** Returns the user profile for a specific UID.
**Request Params:** `uid` (string) -- The user's UID.
**Response:**
```json
{ "data": { /* user object */ } }
```
Returns `404` if user not found.

---

## Session Logs

All routes under `/api/session-logs` require **requireAuth**. All endpoints use POST with an optional filter body.

### `POST /api/session-logs/front-desk`

**Auth:** requireAuth
**Description:** Fetches raw front desk session logs with optional date range and scholar UID filters.
**Request Body:**
```json
{
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)",
  "scholarUids": ["uid1"] // optional
}
```
**Response:**
```json
{ "data": [ /* front desk log rows */ ] }
```

---

### `POST /api/session-logs/front-desk/cleaned`

**Auth:** requireAuth
**Description:** Returns front desk logs cleaned and separated into valid vs errored entries, grouped by scholar UID.
**Request Body:**
```json
{
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)",
  "scholarUids": ["uid1"], // optional
  "sessionType": "string (optional)",
  "treatUnclosedEntryAsError": true // optional, boolean
}
```
**Response:**
```json
{
  "data": {
    "byScholarUid": { "uid1": [ /* cleaned entries */ ] },
    "allCleaned": [ /* all valid entries */ ],
    "allErrored": [ /* all errored entries */ ]
  }
}
```

---

### `POST /api/session-logs/front-desk/in-room`

**Auth:** requireAuth
**Description:** Returns scholars currently checked into front desk (open sessions without checkout).
**Request Body:**
```json
{
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)",
  "scholarUids": ["uid1"], // optional
  "sessionType": "string (optional)"
}
```
**Response:**
```json
{ "data": [ /* scholars currently in room */ ] }
```

---

### `POST /api/session-logs/front-desk/completed`

**Auth:** requireAuth
**Description:** Returns completed front desk sessions (checked in and checked out).
**Request Body:**
```json
{
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)",
  "scholarUids": ["uid1"], // optional
  "sessionType": "string (optional)"
}
```
**Response:**
```json
{ "data": [ /* completed session entries */ ] }
```

---

### `POST /api/session-logs/study`

**Auth:** requireAuth
**Description:** Fetches raw study session logs with optional filters.
**Request Body:**
```json
{
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)",
  "scholarUids": ["uid1"], // optional
  "sessionType": "string (optional)"
}
```
**Response:**
```json
{ "data": [ /* study session log rows */ ] }
```

---

### `POST /api/session-logs/study/cleaned`

**Auth:** requireAuth
**Description:** Returns study session logs cleaned and separated into valid vs errored entries, grouped by scholar UID.
**Request Body:**
```json
{
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)",
  "scholarUids": ["uid1"], // optional
  "sessionType": "string (optional)",
  "treatUnclosedEntryAsError": true // optional, boolean
}
```
**Response:**
```json
{
  "data": {
    "byScholarUid": { "uid1": [ /* cleaned entries */ ] },
    "allCleaned": [ /* all valid entries */ ],
    "allErrored": [ /* all errored entries */ ]
  }
}
```

---

### `POST /api/session-logs/study/in-room`

**Auth:** requireAuth
**Description:** Returns scholars currently checked into study sessions.
**Request Body:**
```json
{
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)",
  "scholarUids": ["uid1"], // optional
  "sessionType": "string (optional)"
}
```
**Response:**
```json
{ "data": [ /* scholars currently in room */ ] }
```

---

### `POST /api/session-logs/study/completed`

**Auth:** requireAuth
**Description:** Returns completed study sessions.
**Request Body:**
```json
{
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)",
  "scholarUids": ["uid1"], // optional
  "sessionType": "string (optional)"
}
```
**Response:**
```json
{ "data": [ /* completed session entries */ ] }
```

---

## Session Records (retired)

`/api/session-records` has been removed. Weekly minutes are computed on read from
cleaned tickets; excuses live in `scholar_week_excuses`. Use `/api/attendance`.
The `front_desk_records` / `study_session_records` tables are frozen as
`*_legacy` SQL snapshots (no app writes).

---

## Attendance (campus week)

All routes under `/api/attendance` require **requireTeamLeaderOrAbove**.  
Minutes are computed on read from cleaned session tickets (campus week). Excuses live in `scholar_week_excuses`, keyed by `(scholar_uid, week_start, kind)` where `week_start` is the Eastern date of `campusWeekToDateRange(weekNum).startDate`. Callers still send `weekNum`; the server derives `week_start`. These endpoints do **not** write frozen `*_records_legacy` tables.

### `GET /api/attendance/week/:weekNum`

**Auth:** requireTeamLeaderOrAbove  
**Description:** Week board for eligible scholars (enrolled freshman/sophomore with required hours for the kind). Includes Mon–Fri minutes, logged total, excuse, description, and completion %.  
**Request Params:** `weekNum` (integer, >= 1)  
**Query:** `kind` = `front_desk` | `study_session` (required)
**Response:**
```json
{
  "data": {
    "week_num": 1,
    "week_start": "2026-08-31",
    "kind": "front_desk",
    "rows": [
      {
        "scholar_uid": "12345",
        "scholar_name": "Ada Lovelace",
        "week_num": 1,
        "kind": "front_desk",
        "mon_min": 30,
        "tues_min": 0,
        "wed_min": 45,
        "thurs_min": 0,
        "fri_min": 0,
        "logged_min": 75,
        "excuse_min": 15,
        "description": "Doctor appointment",
        "required_min": 120,
        "effective_min": 90,
        "completion_pct": 75
      }
    ],
    "summary": {
      "scholar_count": 1,
      "at_or_above_90": 0,
      "below_75": 0
    }
  }
}
```

---

### `POST /api/attendance/week/:weekNum/by-uids`

**Auth:** requireTeamLeaderOrAbove
**Description:** Campus-week FD and SS minutes for the given scholar UIDs, using the same compute-on-read tickets + `scholar_week_excuses` math as Weekly Memo. Returns one front_desk row and one study_session row per UID (zeros when there are no tickets or excuse). `required_min` and `completion_pct` are null — callers use roster requirements.
**Request Params:** `weekNum` (integer, >= 1)
**Request Body:**
```json
{ "uids": ["12345", "67890"] }
```
**Response:**
```json
{
  "data": {
    "week_num": 1,
    "week_start": "2026-08-31",
    "rows": [
      {
        "scholar_uid": "12345",
        "kind": "front_desk",
        "logged_min": 75,
        "excuse_min": 15,
        "description": "Doctor appointment",
        "effective_min": 90
      },
      {
        "scholar_uid": "12345",
        "kind": "study_session",
        "logged_min": 0,
        "excuse_min": 0,
        "description": null,
        "effective_min": 0
      }
    ]
  }
}
```

---

### `PATCH /api/attendance/excuse`

**Auth:** requireTeamLeaderOrAbove  
**Description:** Upserts excuse minutes + description for a scholar/week/kind into `scholar_week_excuses`. `week_start` is derived from `weekNum` via the campus calendar (not client-supplied). Description is required when `excuse_min > 0`.  
**Request Body:**
```json
{
  "uid": "12345",
  "weekNum": 1,
  "kind": "front_desk",
  "excuse_min": 60,
  "description": "Sick day"
}
```
(`scholar_uid` and `week_num` / `excuse` aliases are also accepted.)  
**Response:**
```json
{ "data": { /* scholar_week_excuses row */ } }
```

---

## Traffic

All routes under `/api/traffic` require **requireAuth**.

### `GET /api/traffic/sessions/:weekNum`

**Auth:** requireAuth
**Description:** Returns all traffic session entries (check-in/check-out pairs) for a specific week.
**Request Params:** `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* traffic session rows */ ] }
```

---

### `GET /api/traffic/entry-count/:weekNum`

**Auth:** requireAuth
**Description:** Returns the total number of entry events for a specific week.
**Request Params:** `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": 42 }
```

---

### `POST /api/traffic/entry-counts`

**Auth:** requireAuth
**Description:** Returns entry counts for multiple weeks in a single request.
**Request Body:**
```json
{ "weekNumbers": [1, 2, 3] }
```
**Response:**
```json
{ "data": { /* week-to-count mapping or array */ } }
```

---

## Form Logs

All routes under `/api/form-logs` require **requireAuth**, then a second gate:

- Week-wide, batch-by-uids, team-leader stats, and generic id lookup: **requireTeamLeaderRole**
- uid-scoped GETs: **requireSelfOrTeamLeader**
- `POST /recent-submissions`: **requireSelfScholarIdOrTeamLeader**

Scholars may read their own submissions (dashboard Activity Log). Program-wide form data is team_leader+.

### MCF (Mentee Check-in Form)

### `GET /api/form-logs/mcf/week/:weekNum`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns all MCF form log entries for a specific week.
**Request Params:** `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* MCF form log rows */ ] }
```

---

### `GET /api/form-logs/mcf/uid/:uid`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns all MCF form logs for a specific scholar/mentor UID.
**Request Params:** `uid` (string)
**Response:**
```json
{ "data": [ /* MCF form log rows */ ] }
```

---

### `GET /api/form-logs/mcf/uid/:uid/week/:weekNum`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns MCF form logs for a specific UID and week.
**Request Params:** `uid` (string), `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* MCF form log rows */ ] }
```

---

### `GET /api/form-logs/mcf/week/:weekNum/with-late`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns MCF form logs for a week, including late submissions.
**Request Params:** `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* MCF form log rows including late */ ] }
```

---

### `GET /api/form-logs/mcf/uid/:uid/with-late`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns all MCF form logs for a UID, including late submissions.
**Request Params:** `uid` (string)
**Response:**
```json
{ "data": [ /* MCF form log rows including late */ ] }
```

---

### `GET /api/form-logs/mcf/uid/:uid/week/:weekNum/with-late`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns MCF form logs for a specific UID and week, including late submissions.
**Request Params:** `uid` (string), `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* MCF form log rows including late */ ] }
```

---

### WHAF (Weekly Hours Activity Form)

### `GET /api/form-logs/whaf/week/:weekNum`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns all WHAF form log entries for a specific week.
**Request Params:** `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* WHAF form log rows */ ] }
```

---

### `GET /api/form-logs/whaf/uid/:uid`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns all WHAF form logs for a specific scholar UID.
**Request Params:** `uid` (string)
**Response:**
```json
{ "data": [ /* WHAF form log rows */ ] }
```

---

### `GET /api/form-logs/whaf/week/:weekNum/with-late`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns WHAF form logs for a week, including late submissions.
**Request Params:** `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* WHAF form log rows including late */ ] }
```

---

### WPL (Weekly Performance Log)

### `GET /api/form-logs/wpl/week/:weekNum`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns all WPL form log entries for a specific week.
**Request Params:** `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* WPL form log rows */ ] }
```

---

### `GET /api/form-logs/wpl/uid/:uid`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns all WPL form logs for a specific scholar UID.
**Request Params:** `uid` (string)
**Response:**
```json
{ "data": [ /* WPL form log rows */ ] }
```

---

### `GET /api/form-logs/wpl/uid/:uid/week/:weekNum`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns WPL form logs for a specific UID and week.
**Request Params:** `uid` (string), `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* WPL form log rows */ ] }
```

---

### `GET /api/form-logs/wpl/week/:weekNum/with-late`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns WPL form logs for a week, including late submissions.
**Request Params:** `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* WPL form log rows including late */ ] }
```

---

### `GET /api/form-logs/wpl/uid/:uid/with-late`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns all WPL form logs for a UID, including late submissions.
**Request Params:** `uid` (string)
**Response:**
```json
{ "data": [ /* WPL form log rows including late */ ] }
```

---

### `GET /api/form-logs/wpl/uid/:uid/week/:weekNum/with-late`

**Auth:** requireAuth, requireSelfOrTeamLeader
**Description:** Returns WPL form logs for a specific UID and week, including late submissions.
**Request Params:** `uid` (string), `weekNum` (integer, >= 1)
**Response:**
```json
{ "data": [ /* WPL form log rows including late */ ] }
```

---

### Batch by UIDs

### `POST /api/form-logs/whaf/by-uids`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns all WHAF form logs matching the given scholar UIDs.
**Request Body:**
```json
{ "uids": ["uid1", "uid2"] }
```
**Response:**
```json
{ "data": [ /* WHAF form log rows */ ] }
```

---

### `POST /api/form-logs/mcf/by-uids`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns all MCF form logs matching the given UIDs. Optionally filter by `mentor_uid` or `mentee_uid`.
**Request Body:**
```json
{
  "uids": ["uid1", "uid2"],
  "field": "mentee_uid"  // optional, "mentee_uid" or "mentor_uid" (default: "mentor_uid")
}
```
**Response:**
```json
{ "data": [ /* MCF form log rows */ ] }
```

---

### `POST /api/form-logs/wpl/by-uids`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns all WPL form logs matching the given scholar UIDs.
**Request Body:**
```json
{ "uids": ["uid1", "uid2"] }
```
**Response:**
```json
{ "data": [ /* WPL form log rows */ ] }
```

---

### `POST /api/form-logs/tutor-reports/by-uids`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns all tutor report logs matching the given scholar UIDs.
**Request Body:**
```json
{ "uids": ["uid1", "uid2"] }
```
**Response:**
```json
{ "data": [ /* tutor report log rows */ ] }
```

---

### `POST /api/form-logs/daily-activity/by-uids`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Returns all daily scholar activity entries matching the given scholar UIDs.
**Request Body:**
```json
{ "uids": ["uid1", "uid2"] }
```
**Response:**
```json
{ "data": [ /* daily scholar activity rows */ ] }
```

---

### Recent Submissions and Stats

### `POST /api/form-logs/recent-submissions`

**Auth:** requireAuth, requireSelfScholarIdOrTeamLeader
**Description:** Returns recent form submissions for a given student. Scholars (and anyone below `team_leader`) receive **WAHF summaries only** (`id`, `formType`, `submittedAt`) — no grades and no WPL/MCF. Team leaders+ receive full WAHF/WPL/MCF payloads for the requested uid.
**Request Body:**
```json
{ "scholarId": "12345" }  // optional string; legacy { "studentId": 12345 } also accepted
```
**Response:**
```json
{ "data": { /* recent submission summary */ } }
```

---

### `POST /api/form-logs/team-leader-stats`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Aggregates MCF, WHAF, and WPL form submission stats per team leader for a given week (includes late submissions).
**Request Body:**
```json
{ "weekNumber": 1 }  // required, integer >= 1; legacy weekNum accepted
```
**Response:**
```json
{ "data": [ /* per-team-leader stats */ ] }
```

---

### Generic Form Log Lookup

### `GET /api/form-logs/:formType/:formId`

**Auth:** requireAuth, requireTeamLeaderRole
**Description:** Retrieves a single form log entry by type and ID. Supported types: `mcf`, `wpl`.
**Request Params:** `formType` (`"mcf"` | `"wpl"`), `formId` (string for MCF UUID, integer for WPL)
**Response:**
```json
{ "data": { /* single form log row */ } }
```
Returns `404` if not found, `400` for unsupported form type.

---

## Daily Activity

All routes under `/api/daily-activity` require **requireAuth**.

### `GET /api/daily-activity/minutes`

**Auth:** requireAuth
**Description:** Returns total activity minutes for a mentee for a specific week and log source.
**Query Params:**
- `menteeUid` (string, required) -- The mentee's UID
- `weekNum` (integer >= 1, required) -- The week number
- `logSource` (string, required) -- The log source type

**Response:**
```json
{ "data": { /* total minutes result */ } }
```

---

## Dev

All routes under `/api/dev` require **requireDeveloper**.

### `GET /api/dev/test`

**Auth:** requireDeveloper
**Description:** Simple health check / connectivity test for developer API.
**Request:** None
**Response:**
```json
{ "ok": true, "message": "Developer API test successful", "user": "email@example.com", "timestamp": "ISO string" }
```

---

### `GET /api/dev/me`

**Auth:** requireDeveloper
**Description:** Returns the authenticated developer's identity and role.
**Request:** None
**Response:**
```json
{
  "user": { "id": "uuid", "email": "string" },
  "profile": { "app_role": "developer", "email": "string" }
}
```

---

### `GET /api/dev/form-logs/:formType/:formId`

**Auth:** requireDeveloper
**Description:** Retrieves a single form log entry by type and ID. Supported types: `mcf`, `wpl`.
**Request Params:** `formType` (`"mcf"` | `"wpl"`), `formId` (string for MCF UUID, integer for WPL)
**Response:**
```json
{ "data": { /* single form log row */ } }
```

---

### `GET /api/dev/roster/:uid`

**Auth:** requireDeveloper
**Description:** Returns the full `user_roster` row for a scholar UID (including invite timestamps). Used by `/dev/profiles/:uid`.
**Request Params:** `uid` (string)
**Response:**
```json
{ "data": { "uid": "12345", "status": "enrolled", "first_name": "Ada" } }
```

---

### `PATCH /api/dev/roster/:uid`

**Auth:** requireDeveloper
**Description:** Updates editable `user_roster` fields and dual-writes the matching `profiles` row (`student_id = uid`) when one exists. `mentee_uids` also replaces `mentor_mentee` rows for that profile. `uid` and `app_role` are not writable. `status` is `enrolled`, `inactive`, or `graduated`. Blocked while acting as a test profile.
**Request Params:** `uid` (string)
**Request Body:** any subset of `first_name`, `last_name`, `phone_number`, `email`, `cohort`, `status`, `program_role`, `fd_required`, `ss_required`, `majors`, `minors`, `teams`, `mentee_uids`
**Response:**
```json
{ "data": { /* updated roster row */ } }
```

---

## Memo

Routes under `/api/memo` require **requireTeamLeaderOrAbove** unless noted otherwise.

### `GET /api/memo/weekly`

**Auth:** requireTeamLeaderOrAbove
**Description:** Returns the weekly memo data by calling the `get_weekly_memo` Supabase RPC.
**Query Params:**
- `semesterId` (integer, required) -- The semester ID
- `weekNum` (integer >= 1, required) -- The week number

**Response:**
```json
{ "data": { /* weekly memo result from RPC */ } }
```

---

### `POST /api/memo/refresh-stats`

**Auth:** requireTeamLeaderOrAbove
**Description:** Triggers a fire-and-forget call to the `refresh_weekly_stats` Supabase Edge Function. Returns immediately.
**Request Body:**
```json
{
  "weekNumber": 1,     // required; legacy week_num / weekNum accepted
  "semesterId": 1      // required; legacy semester_id accepted
}
```
**Response:**
```json
{ "data": { "ok": true } }
```

---

### `GET /api/memo/page-data`

**Auth:** requireTeamLeaderOrAbove
**Description:** Returns all processed data needed to render the memo page for a given week (aggregated in one call). Scholar rows and WAHF census (`wahfDonut`) include only enrolled freshman/sophomore scholars with required hours (`user_roster.status` = enrolled). `gradeBreakdown` is the Recognition board census: assignment grades parsed from the **latest WAHF per submitter that week** (scholars and team leaders; high ≥90%, mid 70–89%, low <70%) so resubmits do not duplicate; each band is sorted by percent descending. Team leader form stats (`teamLeaderFormStats`, `formCompletionOverall`, MCF rows) include only enrolled non-scholar, non-Coordinator roster rows. Inactive and graduated roster rows are omitted from scholar lists and TL form stats. FD/SS minutes are computed on read from cleaned tickets; excuses come from `scholar_week_excuses` (not `*_records`). Each scholar row includes `wahfStatus` (`on-time` | `late` | `missing`) and `wahfSubmittedAt` (latest weekly WAHF form-log `created_at`, or `null` if none) from that week's WAHF form logs. `teamLeader` is the mentor display name from `mentor_mentee` (`Unassigned` when the scholar has no row). Scholars owe WAHF only; WPL/MCF stay on team-leader form stats. `trafficComparableLastWeekCount` is prior-week entries through the same weekday and time when the selected week is the current campus week (not the full prior week).
**Query Params:**
- `weekNumber` (integer >= 1; legacy `weekNum` accepted; defaults to current campus week if omitted)

**Response:**
```json
{ "data": { /* full memo page data object */ } }
```

---

### `GET /api/memo/pdf`

**Auth:** requireTeamLeaderOrAbove
**Description:** Renders the weekly memo printout as a PDF. FD/SS roster and Needs Attention completion match the memo page: logged minutes plus `scholar_week_excuses`, integer percent capped at 100. Program Snapshot FD/SS bars count a scholar complete at 80% or more (same hours math), not the page pie’s 100% threshold. Snapshot FD/SS rows and appendix roster group headings use class-year labels (Sophomore, Freshman), not entering cohort numbers. Study-session and front-desk appendix rosters are grouped by class year and sorted by completed minutes descending. The masthead and footer include an Eastern `Printed` timestamp. `Content-Disposition` uses `weekly-memo-week-{weekNumber}-{YYYY-MM-DD-HHmm}.pdf` in America/New_York. Response has `Cache-Control: no-store`. Returns `503` if Chromium/PDF rendering fails.
**Query Params:**
- `weekNumber` (integer >= 1; legacy `weekNum` accepted; defaults to current campus week if omitted)

**Response:** PDF binary (`Content-Type: application/pdf`)

---

### `POST /api/memo/sync`

**Auth:** requireTeamLeaderOrAbove
**Description:** No-op. Session-record sync is retired; Memo attendance is computed on read. Still requires `weekNumber`/`weekNum` and `mode` (`light`|`heavy`) for compatibility.
**Request Body:**
```json
{
  "weekNum": 1,          // required, integer >= 1
  "mode": "light"        // required, "light" or "heavy"
}
```
**Response:**
```json
{ "data": { /* sync result */ } }
```

---

### `GET /api/memo/traffic-count`

**Auth:** requireTeamLeaderOrAbove
**Description:** Returns the traffic entry count for a given week. Response has `Cache-Control: no-store`.
**Query Params:**
- `weekNumber` (integer >= 1, required; legacy `weekNum` query param accepted)

**Response:**
```json
{ "data": { "weekNumber": 1, "entryCount": 42 } }
```
