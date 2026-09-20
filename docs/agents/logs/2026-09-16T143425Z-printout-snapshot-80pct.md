# printout-snapshot-80pct

**Date:** 2026-09-16T143425Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
theres drift in the weekly memo printout, please adjust to be pulling from the weekly memo on the webapp in how we calculate percentages, please edit this to account for excused hours

---

increase the tolerance for the program snap shot completion to above 90% on the printout

---

increase it to 80
```

---

## Purpose

Lower Program Snapshot hours complete threshold from 90% to 80% on the printout.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Changed WEEKLY_MEMO_SNAPSHOT_COMPLETE_PERCENT from 90 to 80. Snapshot tiles now read “80% or more”; 80% counts, 79% does not. Recognition-board 90% bands and green status colors were left alone.

---

## Code Changes

- `backend/API.md`
- `backend/src/services/weekly-memo-pdf-charts.ts`
- `backend/src/services/weekly-memo-pdf.service.ts`
- `backend/src/services/weekly-memo-report.service.ts`
- `backend/src/tests/weekly-memo-pdf-charts.test.ts`
- `backend/src/tests/weekly-memo-report.test.ts`
- `docs/dev/frontend/app/dashboard/memo/README.md`
