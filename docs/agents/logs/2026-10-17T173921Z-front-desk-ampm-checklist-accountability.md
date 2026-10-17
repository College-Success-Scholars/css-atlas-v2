# front-desk-ampm-checklist-accountability

**Date:** 2026-10-17T173921Z
**User:** moosay@Moosays-MacBook-Pro-8.local
**Issue:** #47 (children #48, #49, #50, #51, #52)

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`. Session spanned 2026-10-11 to 2026-10-17; two unrelated debugging exchanges are summarised under Out of scope rather than reproduced._

```
I created a file on under /Documents-mac/Obsadin-valut/Projects/School/CSS that is supposed to be used as a claude md file for this project and any instruction I give you, do you wanna put this under this projects for directroy on when to go to for instructions for this project?
---
check the directroy again
---
Can you access my github projects
---
Try now I am trying to work on this task: Add: Front Desk Team AM/PM checklist accountability
---
Can you make a plan on our obsain vault? with a digram aswell so i can understand
---
First make a mark down file for the plan so I can see it then I will let you approve :)
---
I dont see the md file in my obsain-vault?
---
I dont see it did u make it under documents-mac/Obsain-valut/Projects/School/CSS directroy
---
so wait about the shift lenecy and on late so we are checking when they submitted the form and if its 10 mineunts later we count it as late?
---
lets remove the 10 min , and rather just check if they submitted within there viald shif
---
mention it on the obsian file for me to go back and change later
---
so did you finish stage 1 right now?
---
why did u need to change this:
        modified:   .github/workflows/ci.yml
        modified:   shared/package.json
---
ok commit those changes but please dont have claude as athe co author
---
now move to stage two
---
I am lost
---
ok can you just finish it and have it working end to end am/pm checklist should only show in the front desk team page and mentee page
---
also can u pull the latest stuff in develop and merge it here
---
Can u remove the reminder on the front desk table collum, also whne the shift is inviald or outisde how do u check? DO u check the first form they subit or the last one
```

---

## Purpose

Ship #47 Front Desk AM/PM checklist accountability end to end: a shared shift-integrity rule, a TL-gated read API over `am_pm_form_logs`, a team board, and a per-mentee card.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Implemented all five children of #47. **Scope was cut mid-session on the user's call:** the tickets specified two ±10-minute on-time windows (vs the paired front-desk Exit ticket and vs an undefined "session end") producing a four-state `onTimeStatus`. That was dropped for a single `shiftValid` boolean — submitted between the claimed shift's start and its end plus grace. Grace is asymmetric (`GRACE_BEFORE_START_MINUTES = 0`, `GRACE_AFTER_END_MINUTES = 60`): tasks cannot be done before the shift begins, but filing shortly after finishing is normal. This resolved an open question that blocked Stage 1, cut Stage 1 from five helpers to three, and removed the dependency on `getFrontDeskCompletedSessions` entirely — there is now **no** Entry/Exit pairing in this feature.

New `shared/front-desk-ampm-config.ts` holds the three shift labels and `parseShiftWindow` / `isCreatedAtWithinShift` / `computeReminderOwed`. `parseShiftWindow` reads times out of the label string rather than duplicating them, so the window cannot drift from the Google Form's option text. Windows compare wall-clock to wall-clock via `Intl`; the naive `easternMidnight + N minutes` reads 10:00 AM as 11:00 AM on the spring-forward day, and a test pinned to 2027-03-14 fails if that regresses.

Backend adds `GET /api/form-logs/am-pm/week/:weekNum` and `POST /api/form-logs/am-pm/by-uids`, both `requireAuth` + `requireTeamLeaderRole`. The GET is registered **before** the generic `/:formType/:formId` catch-all, which would otherwise read `am-pm`/`week` as a formType/formId pair; a test pins that. Enrichment reuses `findTeamLeaderUidByFuzzyName`, which was already exported with no caller, instead of adding a second name matcher. `am_pm_form_logs` was typed but entirely unused before this; every column is nullable, so null shift, unknown label, and null `created_at` all degrade to `shiftValid: false` rather than throwing. `buildAmPmChecklistRows` and `summarizeTaskCompletion` are pure, so enrichment is unit-testable without Supabase. No write path — intake stays Google Forms.

**Route differs from the tickets.** #49/#51/#52 say `/dashboard/front-desk`; the board landed at `/dashboard/teams/front-desk/am-pm`. A Front Desk page already existed under `/dashboard/teams/`, TL-gated by `teams/layout.tsx` and already in the sidebar via `sidebar-teams.ts`, and `app/dashboard/front-desk/_components/` was an empty abandoned scaffold. The ticket's path would have produced two identically-named sidebar entries pointing at different pages plus a duplicated gate. As a sibling board it inherits the gate and week-param handling. The board switcher moved out of `teams-attendance-client` into `teams-view-tabs`; per the user's instruction the checklist appears in exactly two places, so `visibleTeamsViewTabs` hides the AM/PM pill outside Front Desk routes, with tests. The old "Front desk" pill is now "Front desk hours" to distinguish the two boards.

Mentee view gets an `AmPmCard` beside Hours/Tutoring/WAHF, fed by the by-uids endpoint batched into the existing `Promise.all` and week-scoped server-side. It distinguishes "no submissions" (likely worked no shift) from a problem so an empty week does not read as failure. The `Reminder` column was removed from the board as redundant — `reminderOwed` is exactly `!shiftValid` — while the field stays on the DTO for the card and the deferred mailer.

Also fixed a latent CI gap: `shared/package.json` pinned its test script to `time.test.ts`, and `ci.yml` never ran `npm test` for shared, so `auth.test.ts` and `campus-calendar.test.ts` had never run in CI and a new Stage 1 test file would have silently never executed. The CI step went into `backend-test`, not `shared-build`, because shared borrows backend's vitest via `--prefix ../backend`.

Verified: shared build + 57 tests; backend build + 208 tests; frontend lint, 223 tests, production build green with both routes registered. Commits authored without a Claude `Co-authored-by` trailer at the user's request.

**Known gap, not addressed:** every submission is judged independently (`rows.map`) with no per-scholar/per-shift deduplication. A scholar who files late and then refiles correctly shows two rows — one invalid, one valid — and still counts toward "N need follow-up". Repeat submissions were never specified; raised with the user, decision pending.

**Out of scope (same session, no code in this branch):** diagnosed a `/dashboard/directory` "Failed to fetch" as CORS — `backend/.env` set `CORS_ORIGIN=http://localhost:3002`, which *replaces* rather than extends the default list, dropping the frontend's own `:3000` origin. Server-side fetches were unaffected; only the directory's browser-side `useEffect` calls failed. Fixed in the gitignored `.env` (not in this PR). Same root cause as a pre-existing local `memo.test.ts` CORS failure, which also fails on pristine `main` and passes with CI's default. Separately confirmed `origin/develop` has not moved since this branch started and `origin/main`'s two extra commits are merge commits with an identical tree, so there was nothing to merge in.

---

## Code Changes

- `shared/front-desk-ampm-config.ts`
- `shared/front-desk-ampm-config.test.ts`
- `shared/package.json`
- `.github/workflows/ci.yml`
- `backend/src/models/am-pm.model.ts`
- `backend/src/services/am-pm.service.ts`
- `backend/src/tests/am-pm.test.ts`
- `backend/src/controllers/form-log.controller.ts`
- `backend/src/routes/form-log.routes.ts`
- `backend/API.md`
- `frontend/app/dashboard/teams/front-desk/am-pm/page.tsx`
- `frontend/app/dashboard/teams/_components/am-pm-checklist-view.tsx`
- `frontend/app/dashboard/teams/_components/am-pm-checklist-client.tsx`
- `frontend/app/dashboard/teams/_components/teams-view-tabs.tsx`
- `frontend/app/dashboard/teams/_components/teams-view-tabs.test.ts`
- `frontend/app/dashboard/teams/_components/teams-attendance-client.tsx`
- `frontend/components/mentee-monitoring/am-pm-card.tsx`
- `frontend/components/mentee-monitoring/mentee-monitoring-client.tsx`
- `frontend/app/dashboard/mentee/page.tsx`
- `frontend/lib/server/data.ts`
- `frontend/lib/format/front-desk-ampm.ts`
- `frontend/lib/types/am-pm-checklist.ts`
- `frontend/lib/types/supabase.ts`
- `docs/agents/ubiquitous_language.md`
- `docs/agents/logs/2026-10-17T173921Z-front-desk-ampm-checklist-accountability.md`
