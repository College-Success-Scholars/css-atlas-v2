# General sign-up flow (provisional)

> **Provisional agent reference** — candidate for removal when this self-service onboarding path is replaced (e.g. roster pre-provisioning). Canonical dev docs: [`docs/dev/frontend/app/auth/README.md`](../dev/frontend/app/auth/README.md).

## Overview

Self-service scholars sign up with a UMD email, confirm via email link, complete a profile form, then access the dashboard. Users without a `profiles` row are redirected to complete-profile instead of erroring.

## End-to-end sequence

1. **Sign up** (`/auth/sign-up`) — UMD email only (`@umd.edu`, `@terpmail.umd.edu`); creates `auth.users` row
2. **Email confirm** (`/auth/confirm`) — `verifyOtp` with `token_hash` + `type=email`; redirects to `/dashboard`
3. **Dashboard gate** (`/dashboard/layout`) — `GET /api/auth/me`; if `profile` is null → `/auth/complete-profile`
4. **Complete profile** (`/auth/complete-profile`) — form submits `POST /api/auth/profile`
5. **Profile created** — `program_role: "scholar"`, `app_role: null`; redirect to `/dashboard`

## Onboarding fields

| Field | Required | Notes |
|-------|----------|-------|
| first_name | yes | |
| last_name | yes | |
| student_id | yes | Scholar UID |
| phone_number | no | |
| cohort | yes | e.g. 2025 |

Server sets: `program_role: "scholar"`, `app_role: null`, `emails: [auth email]`, and explicit defaults for writable profile columns (see below). `full_name` is **DB-generated** from first/last name — do not send it on insert.

### Profile columns set at create

| Column | Source | Value |
|--------|--------|-------|
| `id` | auth user | `auth.users.id` |
| `first_name`, `last_name`, `student_id`, `phone_number`, `cohort` | complete-profile form | user input (`student_id` is Postgres `text`) |
| `emails` | server | `[auth email]` |
| `program_role` | server | `"Scholar"` |
| `app_role` | server | `null` |
| `status` | server default | `null` |
| `fd_required`, `ss_required` | server default | `null` |
| `mentee_count` | server default | `0` |
| `majors`, `minors`, `teams` | server default | `[]` |
| `full_name` | database | generated from first/last — omitted on insert |
| `created_at` | database | `now()` (not sent on insert) |

Implementation: `buildScholarProfileInsertRow()` in `backend/src/services/user.service.ts`.

### Columns not collected at onboarding — how to handle later

These are **not** on the complete-profile form. They are initialized to safe scholar defaults on create; update them through the paths below when program data becomes available.

| Column | Initial value | How to handle later |
|--------|---------------|---------------------|
| `status` | `null` | Set from `/dev/profiles` (developer roster editor) or a future settings flow. Canonical values: `enrolled` (in program), `inactive`, or `graduated`. |
| `fd_required` | `null` | Usually synced from `user_roster` via `mergeProfileWithRoster`, or set by staff in dev profiles / roster import. Required for session-hour tracking. |
| `ss_required` | `null` | Same as `fd_required` — study-session minutes requirement per scholar. |
| `majors` | `[]` | Add to complete-profile form, settings edit UI, or bulk roster import when academic data is collected. |
| `minors` | `[]` | Same as `majors`. |
| `teams` | `[]` | Assign via roster/admin when placing scholars on teams; team leaders often have non-empty `teams`. |
| `mentee_count` | `0` | **Team leaders only** — derived from mentee assignments on `user_roster` / `mentor_mentee`; do not invent a `profiles.mentee_uids` column. |
| `app_role` | `null` | Not editable in the app. Promote to `team_leader` or `developer` in SQL on `profiles` (and `user_roster` if you want invite copies to match). Controls memo access and elevated routes. |
| `program_role` | `"Scholar"` | Change only if the user is not a scholar (e.g. roster pre-provision as `team_leader`); use invite/roster flows instead of self-signup. |

**Mentee assignments** live on `user_roster.mentee_uids` / `mentor_mentee`, not on `profiles`. Use `GET /api/auth/mentees` for lists.

**Pre-provisioned users:** If a row already exists in `user_roster` for the scholar UID, `mergeProfileWithRoster` can backfill `fd_required`, `ss_required`, names, and `app_role` on read — but self-service create does not join roster automatically. Consider a post-create sync job or manual dev profile linking if roster data must match on day one.

## Role and memo access

- **UI role** — `resolveUserRole()` in `frontend/lib/auth.ts` maps `program_role: "scholar"` + `app_role: null` → scholar nav (no Memo link)
- **Memo API** — `GET /api/memo/page-data` (and related memo routes) require `requireTeamLeaderOrAbove`
- **Memo pages** — `/dashboard/memo`, `/dashboard/memo-legacy` redirect to `/dashboard` when `canAccessWeeklyMemo(getCurrentProfile())` is false (effective `/api/auth/me` role, including acting-as)

## Supabase dependencies

| Item | Requirement |
|------|-------------|
| Confirm signup email template | Link to `/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard` (not `{{ .ConfirmationURL }}`) |
| Site URL | Production origin (e.g. `https://cssatlas.org`) |
| Redirect URLs | `https://cssatlas.org/auth/confirm**` |
| RLS on `profiles` | `INSERT` policy: `auth.uid() = id` for authenticated users |

Template script: `scripts/configure-supabase-confirm-email-template.sh`

**Developer test profiles** (`public.dev_test_profiles`) are separate from sign-up: they are not `auth.users` rows. Developers switch personas for read-only debugging. See `docs/dev/supabase/README.md`.

## Key code touchpoints

| Area | Path |
|------|------|
| UMD email helper | `shared/auth.ts` → `isUmdEmail()` |
| Sign-up form | `frontend/components/sign-up-form.tsx` |
| Confirm route | `frontend/app/auth/confirm/route.ts` |
| Complete profile | `frontend/app/auth/complete-profile/page.tsx`, `frontend/components/complete-profile-form.tsx` |
| Dashboard gate | `frontend/app/dashboard/layout.tsx` |
| Create profile API | `POST /api/auth/profile` — `backend/src/controllers/auth.controller.ts` |
| UI role resolution | `frontend/lib/auth.ts` → `resolveUserRole()` |
| Sidebar nav | `frontend/components/app-sidebar.tsx` |

## Alternate flows

- **Invite** — `type=invite` in confirm route → `/auth/set-password`; hash invites via `InviteFromHashRedirect`
- **Pre-provisioned users** — team leaders / roster rows may already have `profiles`; skip complete-profile

## Removal checklist

If retiring self-service sign-up:

- [ ] Delete `frontend/app/auth/complete-profile/`, `frontend/components/complete-profile-form.tsx`
- [ ] Remove `POST /api/auth/profile` handler and `createScholarProfile` service
- [ ] Revert dashboard layout profile gate (or replace with roster-based provisioning)
- [ ] Remove `isUmdEmail` usage from sign-up if domain restriction no longer needed
- [ ] Drop Supabase `profiles` INSERT RLS policy if profiles are admin-only again
- [ ] Revert confirm email template if using a different auth model
- [ ] Delete this file
