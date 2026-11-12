# Dev Tools

This folder is **developer-only**. Access is restricted via `getDeveloperUser()` (`app_role === 'developer'` on the merged profile from `public.profiles` and `public.user_roster`).

## Granting developer access

`app_role` is not editable in the app. Set it in SQL on `public.profiles` (`is_developer()` reads that column):

```sql
update public.profiles
set app_role = 'developer'
where student_id = 'your-uid';
```

## Test profile switcher

Developers can switch personas from the sidebar or `/dev` layout:

- **My profile** — your real identity and write access
- **Test personas** — read-only for mutations; read-via-POST queries (dashboard, forms, logs) still work

Mutation denylist: [`docs/dev/backend/src/middleware/README.md`](../../../docs/dev/backend/src/middleware/README.md).

Cloud SQL and seed data: [`docs/dev/supabase/README.md`](../../../docs/dev/supabase/README.md).

### Adding a new persona

1. Pick a `user_roster.uid` whose data matches the scenario (scholar, TL with mentees, etc.).
2. Insert a row into `dev_test_profiles` (see seed script pattern in `docs/dev/supabase/003_seed_test_profiles.sql`).
3. If new tables need cross-user reads, add a `developer_read_*` policy in `002_rls_developer_read.sql` and apply in Supabase SQL Editor.

### New self-scoped pages

Use `getCurrentUser()` / `getCurrentProfile()` for the effective profile, or `effectiveScholarId()` from `@/lib/dev/effective-uid` for uid-based backend calls. Do not read `authUser.id` when the page shows data for the current persona.

## Routes

- `/dev` — Dev tools page with client-side test UI
- `/dev/schedule-views` — FD/SS weekly + daily schedule boards (live roster + standing shifts; manage modal Save and Day Publish write via API)
- `GET /api/dev/schedule-board` — eligible scholars + active `scholar_shift_assignments` for schedule views
- `PUT /api/dev/schedule-board/:uid` — replace one scholar’s active standing FD/SS shifts for the active semester
- `/api/dev/*` — Dev API routes (also protected by developer check)
- `GET /api/dev/test-profiles` — list personas
- `POST /api/dev/active-profile` — validate a persona id (cookie set via server action)
- `GET /api/dev/roster/:uid` — full roster row for `/dev/profiles`
- `PATCH /api/dev/roster/:uid` — update roster except `uid` and `app_role` (blocked while acting as a test profile)

## Adding new tests

1. Add API routes in `backend/src/routes/dev.routes.ts` — protect with `requireDeveloper`
2. Add buttons/forms in dev pages to call them
