# printout-snapshot-90pct

**Date:** 2026-09-16T143135Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
theres drift in the weekly memo printout, please adjust to be pulling from the weekly memo on the webapp in how we calculate percentages, please edit this to account for excused hours

---

increase the tolerance for the program snap shot completion to above 90% on the printout
```

---

## Purpose

Count Program Snapshot FD/SS complete at 90% or more on the weekly memo printout.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Program Snapshot front-desk and study-session bars now count a scholar complete at 90% or more using logged-plus-excuse hours, instead of the page pie’s 100% threshold. Tiles label “90% or more.” 89% still does not count. Web app pie charts are unchanged.

---

## Code Changes

- `backend/API.md`
- `backend/src/services/weekly-memo-pdf-charts.ts`
- `backend/src/services/weekly-memo-pdf.service.ts`
- `backend/src/services/weekly-memo-report.service.ts`
- `backend/src/tests/weekly-memo-pdf-charts.test.ts`
- `backend/src/tests/weekly-memo-report.test.ts`
- `docs/dev/frontend/app/dashboard/memo/README.md`
