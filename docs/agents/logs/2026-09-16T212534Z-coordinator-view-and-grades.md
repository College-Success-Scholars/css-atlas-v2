# coordinator-view-and-grades

**Date:** 2026-09-16T212534Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
pull the coordinator issue, asnd come up witha. way to tackle that. Aslo integrate the grade view into this
---
also implement coordinator in the auth hierarchy, above teamleader belowe developer
---
Issue solve plan: Coordinator View + grades (M5)

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.
```

---

## Purpose

File M5 Coordinator View tickets and implement app_role coordinator, Coordinator home, and freshman grades.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Filed M5 Feature issues #91 (coordinator app_role), #92 (Coordinator View home), and #93 (freshman grades) with feature + needs-triage only. Inserted coordinator into APP_ROLE_ORDER between team_leader and developer; added requireCoordinatorOrAbove / canAccessCoordinatorView / is_coordinator_or_above(); resolveUserRole now checks developer then coordinator then team_leader. Shipped /dashboard/coordinator working list (Grades, Memo, labeled later-M5 scratch) and coordinator-shaped sidebar without Room/Teams. Shipped GET /api/grades/freshman and /dashboard/grades with weekly-capped FD/SS/WAHF 10/10/10, WAHF missing=0/submitted=100, no fake semester total; tests cover week1 0% + week2 200% = 50%. Widened roster viewer types for coordinator. Documented SQL promote and a coordinator seed persona. Did not apply supabase db push or promote a production user.

---

## Code Changes

- `backend/API.md`
- `backend/src/app.ts`
- `backend/src/middleware/auth.middleware.ts`
- `backend/src/services/weekly-memo-pdf-charts.ts`
- `backend/src/services/weekly-memo-pdf.service.ts`
- `backend/src/tests/auth.test.ts`
- `backend/src/tests/weekly-memo-pdf-charts.test.ts`
- `backend/src/tests/weekly-memo-report.test.ts`
- `docs/agents/codebase-notes.md`
- `docs/agents/general-sign-up-flow.md`
- `docs/dev/README.md`
- `docs/dev/backend/src/controllers/README.md`
- `docs/dev/backend/src/middleware/README.md`
- `docs/dev/backend/src/models/README.md`
- `docs/dev/backend/src/routes/README.md`
- `docs/dev/frontend/app/dashboard/README.md`
- `docs/dev/frontend/app/dashboard/memo/README.md`
- `docs/dev/frontend/components/dashboard/README.md`
- `docs/dev/frontend/lib/supabase/README.md`
- `docs/dev/it-review.md`
- `docs/dev/onboarding/roles-and-personas.md`
- `docs/dev/supabase/003_seed_test_profiles.sql`
- `docs/dev/supabase/README.md`
- `docs/dev/supabase/public-schema.md`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/roster/DirectoryPage.tsx`
- `frontend/app/dashboard/roster/DirectoryRoster.tsx`
- `frontend/app/dashboard/roster/roster-data.ts`
- `frontend/app/dashboard/roster/roster/DirectoryPage.tsx`
- `frontend/app/dashboard/roster/roster/DirectoryRoster.tsx`
- `frontend/app/dev/README.md`
- `frontend/app/traffic/layout.test.tsx`
- `frontend/components/layout/app-sidebar.tsx`
- `frontend/lib/auth.test.ts`
- `frontend/lib/auth.ts`
- `frontend/lib/dashboard-breadcrumb.test.ts`
- `frontend/lib/dashboard-breadcrumb.ts`
- `frontend/lib/server/data.ts`
- `frontend/lib/supabase/server.ts`
- `shared/auth.test.ts`
- `shared/auth.ts`
- `shared/time.test.ts`
- `shared/time.ts`
