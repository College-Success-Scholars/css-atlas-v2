# Cloud Supabase

Schema source of truth is the repo-root CLI folder: [`supabase/migrations/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/supabase/migrations). See [`supabase/README.md`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/supabase/README.md).

Dashboard SQL Editor is **emergency / one-off ops only** — every lasting schema/RLS/RPC change should land as a migration PR.

## Access pattern

**App reads and app-owned mutations** reach Postgres through the Express backend via `getSupabaseClient()` (table queries and Postgres RPCs such as `get_mentee_activity`).

**Operational form / log population is already handled outside the app:** Google Forms write into Supabase tables (see [Form / log intake](#form--log-intake-google-forms)). Do not plan in-app “data entry” or seed pipelines for those weekly forms — treat the `*_form_logs` / session log tables as externally fed sources of truth the backend reads and aggregates.

| Do | Don’t |
|----|--------|
| Call Supabase from `backend/src/services/*` (`.from(…)`, `.rpc(…)`) | Deploy or invoke **Supabase Edge Functions** |
| Keep business logic in the Express app | Put domain logic in Deno edge functions under `supabase/functions/` |
| Read form/session log tables; compute weekly minutes on read | Rebuild Google Form → Postgres intake inside Next.js / Express; sync `*_records` |

Auth session management on the frontend still uses the Supabase JS client; that is not domain data access. PostgreSQL functions/triggers in migrations are fine — they are database objects, not Edge Functions.

### Typed client (backend only)

Generated schema types and `createClient<Database>` live under [`backend/src/supabase/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/supabase) — not in `shared/`, and not bundled for the frontend. Regen after migrations: `npm run db:types --prefix backend`, then fix backend models / frontend API types until `npm test` / `npm run typecheck` pass (see [`database-model-align.test.ts`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/tests/database-model-align.test.ts)).

**Architecture:** Postgres → generated `Database` (backend) → backend models/services → HTTP JSON → `frontend/lib/types/*` (route/API DTOs). There is no shared schema DTO package.

Frontend types should describe **route response shapes** (what each page/API returns), not a mirror of Postgres tables. Backend maps query results to those DTOs.

See [backend supabase docs](../backend/src/supabase/README.md).

## Schema baseline + migration history

Captured with `supabase db dump --linked --schema public` → [`supabase/migrations/20260715051600_baseline.sql`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/supabase/migrations/20260715051600_baseline.sql) (2026-07-15).

**Migration history (Step 2, 2026-07-15):** orphan remote versions (`20260329*` … `20260414*`) were marked `reverted`; baseline `20260715051600` was marked `applied`. Local and linked remote now agree on that single version (`supabase migration list --linked`). Repair only touched the migration history table — not app schema or data.

**Do not** `supabase db push` the baseline onto production (objects already exist). New schema/RLS/RPC changes: `supabase migration new <name>` → PR → `db push` staging → prod.

Developer roster edits from `/dev/profiles` need `developer_update_user_roster` (and `developer_*_mentor_mentee` for mentee UID sync) from [`20260903053000_developer_write_user_roster.sql`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/supabase/migrations/20260903053000_developer_write_user_roster.sql). Apply that migration on the linked project; do not re-run the historical `002_rls_developer_read.sql` runbook for writes.

### Inventory — tables in dump

`am_pm_form_logs`, `daily_scholar_activity`, `dev_test_profiles`, `front_desk_logs`, `front_desk_records_legacy`, `mcf_form_logs`, `mentor_mentee`, `profiles`, `scholar_week_excuses`, `scholar_weekly_stats`, `semester_breaks`, `semesters`, `study_session_logs`, `study_session_records_legacy`, `traffic`, `traffic_weekly_summary`, `tutor_report_logs`, `user_roster`, `whaf_form_logs`, `wpl_form_logs`

Column-level catalog (types + one-liners): [`public-schema.md`](public-schema.md).

### Form / log intake (Google Forms)

Program staff already submit weekly and session forms via **Google Forms**, which insert into Supabase. That pipeline is **in place** — the app consumes rows; it does not own form collection. Linked destinations (Sheets, Apps Script, webhooks) live **outside this repo**.

Likely intake targets from the baseline migration (`*_form_logs`, log tables with `submitted_by_email`, and the tutoring form table):

| Table | Role (domain) |
|-------|----------------|
| `whaf_form_logs` | **WAHF** (Weekly Academic Honors Form) — table name uses `whaf` |
| `wpl_form_logs` | **WPL** (Weekly Project List) |
| `mcf_form_logs` | **MCF** (Mentee Check-in Form) |
| `am_pm_form_logs` | AM/PM shift / task completion logs |
| `tutor_report_logs` | Tutoring form (table comment: “Tutoring form”) |
| `front_desk_logs` | Front-desk check-in/out style logs (`submitted_by_email`) |
| `study_session_logs` | Study-session check-in/out style logs (`submitted_by_email`) |

**Not** Google Form intake (app- or DB-derived): `front_desk_records_legacy` / `study_session_records_legacy` (frozen snapshots — do not use), `scholar_week_excuses` (TL-entered excuses, keyed by campus-week `week_start`), `daily_scholar_activity` / `scholar_weekly_stats` (aggregates), `traffic` / `traffic_weekly_summary` (kiosk + analytics), `profiles` / `user_roster` / `mentor_mentee` / `dev_test_profiles` / semester tables.

When debugging empty dashboards, check whether the linked project has recent rows in the form/log tables above before assuming a missing “populate data” feature. If week 1 of a new academic year is empty, also check [Yearly rollover](#yearly-rollover) — expired Google consent is a common cause. If the Forms already have responses that never landed in Postgres, export the Sheet and load it with [`scripts/backfill-form-logs.sh`](../scripts/README.md#backfill-form-logssh) (WPL / MCF).

### Yearly rollover

Do this **once per academic year**, together with the `shared/time-config.ts` date update ([Campus weeks](../onboarding/campus-weeks.md)). The in-app calendar change does **not** refresh Google’s OAuth / Apps Script consent.

1. **Re-authenticate the Google Forms → Supabase pipelines.** Open each operational form’s linked destination (Apps Script, Sheets add-on, or webhook) as the owning Google account and complete the consent / “authorize” prompt so writes to the live Supabase project still succeed. Google consent for unpublished scripts typically expires on a yearly cycle.
2. **Confirm Drive location.** Forms and response Sheets belong in the **current-year CSS Drive**, not last year’s folder or a personal Drive. Prefer a Drive **move** (IDs and `viewform` URLs stay the same) over copy/recreate.
3. **Test-submit** each form in the table above and confirm a new row in the matching Supabase table.
4. **If a form ID changed**, update `FORM_URLS` in [`frontend/components/personal/personal-client.tsx`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/components/personal/personal-client.tsx) (WAHF / WPL / MCF) so Personal “Open form” points at this year’s forms.
5. **Backfill missed rows.** If scholars already submitted in Google Forms while the pipeline was down, export the response Sheet (WPL / MCF) and run [`./scripts/backfill-form-logs.sh`](../scripts/README.md#backfill-form-logssh) (`--dry-run` first). Do not rebuild intake inside the app.

Ask before changing intake destinations, secrets, or `time-config` dates — [Ask / don’t touch](../onboarding/ask-and-dont-touch.md).

### Inventory — notable RPCs / functions

`get_mentee_activity`, `get_my_mentees`, `get_week_breaks`, `get_weekly_memo`, `get_effective_requirement`, `handle_new_user`, `is_developer`, `sync_daily_scholar_activity`, …

### Schema ↔ app types (resolved)

Hand-written type drift against the baseline dump was cleared (architecture alert #25):

- `profiles.student_id` is `string | null` end-to-end (Postgres `text`)
- Scholar profile create omits generated `full_name`
- `ProfileRow` / profiles DTOs do not invent `mentee_uids` (use `user_roster` / `/api/auth/mentees`)
- Tutor report types include `date`
- Compile-time checks live in backend `database-model-align` tests

**Standing ops (not schema):** verify Supabase Dashboard Auth Site URL + redirect URLs match each environment’s frontend origin.

Domain-semantics drift (campus week vs ISO week) is a separate alert — out of scope here.

### Form-log SELECT (own row or team_leader+)

Baseline policies left `mcf_form_logs` / `wpl_form_logs` world-readable (`USING (true)`). WAHF compared `scholar_uid` to `auth.uid()` and listed stale roles (`teamleader`, `admin`, `staff`).

Apply [`supabase/migrations/20260903033000_form_log_rls_own_or_leaders.sql`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/supabase/migrations/20260903033000_form_log_rls_own_or_leaders.sql) (`supabase db push` staging, then prod):

- `roster_uid()` → `profiles.student_id` for `auth.uid()` (form tables store roster uids, not auth uuids)
- `is_team_leader_or_above()` → `app_role IN ('team_leader', 'developer')`
- Scholars SELECT only their own MCF (mentor or mentee uid), WPL, and WAHF rows

Express `/api/form-logs` enforces the same split (week-wide = team_leader+; uid-scoped = self or team_leader+). RLS is the backstop if someone calls Supabase with a scholar JWT.

### Mentee → team-leader names (weekly memo)

Own-row RLS on `mentor_mentee` and `profiles` cannot join a campus-wide mentee → mentor map. Apply [`supabase/migrations/20260904224500_team_leader_read_mentor_mentee.sql`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/supabase/migrations/20260904224500_team_leader_read_mentor_mentee.sql) (`supabase db push` staging, then prod):

- `team_leader_read_mentor_mentee` — SELECT all assignments when `is_team_leader_or_above()`
- `team_leader_read_profiles` — SELECT mentor `student_id` / name for that join
- Express `/api/memo/page-data` queries the tables (no RPC). Scholars with no `mentor_mentee` row stay `Unassigned`

---

## Dev test profiles (Dashboard runbooks)

These scripts under `docs/dev/supabase/` are **historical / ops runbooks**. Objects they create are already in the Phase 1 baseline when applied on the live project. Prefer a new migration for further changes; use these only if re-seeding or reconstructing a project by hand.

### Run order

1. [`001_dev_test_profiles.sql`](001_dev_test_profiles.sql) — `is_developer()`, `dev_test_profiles` table, RLS
2. [`002_rls_developer_read.sql`](002_rls_developer_read.sql) — developer SELECT policies on data tables
3. [`003_seed_test_profiles.sql`](003_seed_test_profiles.sql) — five persona rows (edit `REPLACE_*` uids first)
4. [`004_traffic_public_insert.sql`](004_traffic_public_insert.sql) — optional: INSERT-only RLS for public `/traffic` kiosk (no anon SELECT)

### Before seeding

Replace placeholders in `003_seed_test_profiles.sql`:

| Persona | Pick a `user_roster.uid` where… |
|---------|----------------------------------|
| Scholar — on track | Scholar with healthy hours / forms |
| Scholar — at risk | Scholar with low completion or missing forms |
| Team leader — with mentees | TL with `mentor_mentee` rows |
| Team leader — no mentees | TL with zero mentees |
| Team leader — with team | TL with team names on profile + mentees |

Verify in SQL Editor:

```sql
SELECT uid, program_role, app_role, mentee_count FROM public.user_roster WHERE uid = '<uid>';
SELECT * FROM public.mentor_mentee WHERE mentor_id = '<uid>' OR mentor_id IN (SELECT id::text FROM public.profiles WHERE student_id = '<uid>');
```

### Verification

1. **Policies** — Dashboard → Authentication → Policies: `dev_test_profiles` has four policies gated on `is_developer()`.
2. **As developer** — `SELECT * FROM public.dev_test_profiles` returns five rows.
3. **As non-developer** — same query returns zero rows.
4. **App** — deploy backend/frontend after SQL is applied; profile switcher lists personas at `/dev`.

### Rollback

```sql
DROP TABLE IF EXISTS public.dev_test_profiles;
DROP FUNCTION IF EXISTS public.is_developer();
-- Drop developer_read_* policies individually if needed (see 002 script policy names).
```

### Security

- Clients send only `dev_test_profiles.id` (UUID), never raw `roster_uid`.
- Test profiles are invisible to non-developers (RLS).
- Acting as a test profile is read-only for mutations (denylist in `rejectWritesWhenActing`; read-via-POST endpoints are allowed). See [`docs/dev/backend/src/middleware/README.md`](../backend/src/middleware/README.md).
