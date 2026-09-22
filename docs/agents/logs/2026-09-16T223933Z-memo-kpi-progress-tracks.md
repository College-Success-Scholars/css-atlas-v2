# memo-kpi-progress-tracks

**Date:** 2026-09-16T223933Z
**User:** miguelventura1123@gmail.com

---

## User Prompt

_Verbatim user input. Multiple messages are separated by `---`._

```
DOM Path: div.group/.idebar-wrapper ha.-data-[variant=in.et]:bg-.idebar flex min-h-.vh w-full > main.bg-background relative flex w-full flex-1 flex-col md:peer-data-[variant=in.et]:m-2 md:peer-data-[variant=in.et]:ml-0 md:peer-data-[variant=in.et]:rounded-xl md:peer-data-[variant=in.et]:.hadow-.m md:peer-data-[variant=in.et]:peer-data-[.tate=collap.ed]:ml-2 > div.flex flex-1 flex-col gap-4 p-4 pt-0 > main.pace-y-4 pb-4 > section.grid gap-3 md:grid-col.-4 > div.text-card-foreground flex flex-col rounded-xl border .hadow-.m gap-0 bg-muted/20 py-0[2]
Position: top=140px, left=794px, width=249px, height=151px
React Component: WeeklyMemoNavProvider
HTML Element: <div data-slot="card" class="text-card-foreground flex flex-col rounded-xl border shadow-sm gap-0 bg-muted/20 py-0" data-cursor-element-id="cursor-el-1">Study session completion 94% 73 scholars</div> where do these kpi cards come from?

---

these should be simialr to thew print out, without the same style but same meaning

---

Align memo KPI cards with print snapshot meaning

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

give it a slider to show this more visually
```

---

## Purpose

Add visual Progress tracks to weekly memo hours KPI cards.

---

## Agent Response Summary

_What the agent did (not a recap of user input)._

Added dashboard Progress tracks on Front desk hours and Study session hours KPI cards: a combined fill under the completed/total count, plus Sophomores and Freshmen tracks. Assembler now supplies pct on the card and each subStat so the component does not parse display strings. Updated mock data, skeleton, README, assembler assertions, and a WeeklyKpiCards render test. Memo KPI tests passed. Could not click-verify in the browser; no browser tools in this session.

---

## Code Changes

- `docs/dev/frontend/app/dashboard/memo/README.md`
- `frontend/app/dashboard/memo/_components/weekly-kpi-cards.tsx`
- `frontend/app/dashboard/memo/_components/weekly-memo-async-content.test.tsx`
- `frontend/app/dashboard/memo/_components/weekly-memo-data-skeleton.tsx`
- `frontend/app/dashboard/memo/_lib/memo-kpi-titles.ts`
- `frontend/app/dashboard/memo/_lib/weekly-memo-assembler.test.ts`
- `frontend/app/dashboard/memo/_lib/weekly-memo-assembler.ts`
- `frontend/app/dashboard/memo/mock-data.ts`
- `frontend/app/dashboard/memo/types.ts`
