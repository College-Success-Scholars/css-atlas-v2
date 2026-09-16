# weekly-memo-plural-class-years

**Date:** 2026-09-16T174036Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
fix the typo on the weekly memo printout, its freshman and sophmores plural
```

---

## Purpose

Fix weekly memo printout class-year labels to plural Freshmen and Sophomores.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Added scholarYearGroupLabel in shared/time.ts (Freshmen / Sophomores) and used it for weekly memo PDF snapshot rows, chart aria-labels, and roster headings. Individual scholar rows still use singular scholarYearLabel. Updated tests and the memo README.

---

## Code Changes

- `backend/src/services/weekly-memo-pdf-charts.ts`
- `backend/src/services/weekly-memo-pdf.service.ts`
- `backend/src/tests/weekly-memo-pdf-charts.test.ts`
- `backend/src/tests/weekly-memo-report.test.ts`
- `docs/dev/frontend/app/dashboard/memo/README.md`
- `shared/time.test.ts`
- `shared/time.ts`
