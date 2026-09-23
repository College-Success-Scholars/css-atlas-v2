# printout-excuse-hours-pct

**Date:** 2026-09-16T141909Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
theres drift in the weekly memo printout, please adjust to be pulling from the weekly memo on the webapp in how we calculate percentages, please edit this to account for excused hours
```

---

## Purpose

Align weekly memo PDF hours completion with the webapp, including excused minutes.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Print roster and Needs Attention hours now use logged minutes plus scholar_week_excuses, the same integer percent (capped at 100) as Full attendance detail. Previously the PDF used logged-only minutes and the unrounded scholar pct (one decimal, uncapped). Added a report test covering excuse-only, over-100, and still-below-threshold rows.

---

## Code Changes

- `backend/API.md`
- `backend/src/services/weekly-memo-pdf.service.ts`
- `backend/src/services/weekly-memo-report.service.ts`
- `backend/src/tests/weekly-memo-report.test.ts`
- `docs/dev/frontend/app/dashboard/memo/README.md`
