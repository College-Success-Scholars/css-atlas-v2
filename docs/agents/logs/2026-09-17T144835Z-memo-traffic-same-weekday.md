# memo-traffic-same-weekday

**Date:** 2026-09-17T144835Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
give it some color to distiguish it

---

fd is orange and ss is blue, grab from the central theming

---

also, for the weeky memo traffic kpi, compare the current amoun of traffic in the week to the same day last week instead of a summation
```

---

## Purpose

Compare memo visits KPI to the same weekday last week instead of last week's full total.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Switched hours KPI tracks to domain tokens --front-desk (orange) and --study (blue). Changed the visits KPI trend so the current campus week compares this week's entries so far to last week through the same weekday and time, not last week's full total. Past weeks still compare full week to full prior week. Added trafficComparableLastWeekCount on page-data, assembler copy (up/down vs last Thursday), traffic.service helpers/tests, and API/README notes.

---

## Code Changes

- `backend/API.md`
- `backend/src/controllers/attendance-week.controller.ts`
- `backend/src/models/attendance-week.model.ts`
- `backend/src/routes/attendance.routes.ts`
- `backend/src/services/attendance-week.service.ts`
- `backend/src/services/memo-page.service.ts`
- `backend/src/services/traffic.service.ts`
- `backend/src/tests/attendance-week.test.ts`
- `docs/adr/001-attendance-compute-on-read.md`
- `docs/agents/codebase-notes.md`
- `docs/dev/frontend/app/dashboard/README.md`
- `docs/dev/frontend/app/dashboard/memo/README.md`
- `docs/dev/frontend/components/README.md`
- `frontend/app/dashboard/memo/_components/weekly-kpi-cards.tsx`
- `frontend/app/dashboard/memo/_components/weekly-memo-async-content.test.tsx`
- `frontend/app/dashboard/memo/_components/weekly-memo-data-skeleton.tsx`
- `frontend/app/dashboard/memo/_lib/memo-kpi-titles.ts`
- `frontend/app/dashboard/memo/_lib/risk-classifier.test.ts`
- `frontend/app/dashboard/memo/_lib/weekly-memo-assembler.test.ts`
- `frontend/app/dashboard/memo/_lib/weekly-memo-assembler.ts`
- `frontend/app/dashboard/memo/mock-data.ts`
- `frontend/app/dashboard/memo/types.ts`
- `frontend/app/dashboard/mentee/page.tsx`
- `frontend/components/mentee-monitoring/hours-card.tsx`
- `frontend/components/mentee-monitoring/mentee-monitoring-client.tsx`
- `frontend/components/mentee-monitoring/utils.test.ts`
- `frontend/components/mentee-monitoring/utils.ts`
- `frontend/lib/server/data.ts`
- `frontend/lib/types/attendance-week.ts`
- `frontend/lib/types/supabase.ts`
- `frontend/vitest.config.ts`
