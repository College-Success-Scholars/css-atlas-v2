# app/dashboard/memo

**Location:** [`frontend/app/dashboard/memo/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo)  
**Docs:** `docs/dev/frontend/app/dashboard/memo/README.md`

## Navigation

[← Root](../../../../README.md) › [Frontend](../../../README.md) › [app](../../README.md) › [dashboard](../README.md) › memo

---

## Purpose

The weekly memo page — the trusted ops snapshot for a campus week. It aggregates scholar hours, WAHF submission, team-leader form compliance, tutoring, and recognition. FD/SS completion uses compute-on-read minutes from tickets plus `scholar_week_excuses` (see [ADR 001](../../../../adr/001-attendance-compute-on-read.md)).

Scholars owe **WAHF** only. **WPL** and **MCF** are Team Leader obligations.

---

## How to read the page

The header blurb (`WEEKLY_MEMO_HEADER_BLURB` in `_lib/memo-section-guide.ts`) is the in-app version of this table.

| Section | Job | Who appears |
|---------|-----|-------------|
| KPI cards | Week totals: visits, mean FD/SS completion, tutoring sessions | Campus week |
| Team leader performance | **WPL · MCF · WAHF** compliance for TLs. Missing MCF is a TL issue, not scholar follow-up. Some-but-not-all mentee MCFs is **incomplete**, not late. TLs with `mentee_count` ≤ 0 (including `-1`, no `mentor_mentee` row) show MCF on-time plus small “no mentee” text. | Roster `program_role` ≠ scholar / Coordinator; `status` ≠ graduated. Program Coordinator still appears. |
| Scholar follow-up | **Action list** — who needs a conversation this week | Scholars with **What's missing** (Front desk, Study session, WAHF, assignment title) and **How it's missing** (hours/grade meters, WAHF submitted-at or no-submission time) |
| Tutoring log | Sessions held vs empty sessions | Tutor report rows |
| Recognition board | **Census** — every assignment grade parsed from this week's **WAHF** (90–100% / 70–89% / below 70%) | Scholars with parsed grades; empty band = None |
| Full attendance detail | **Census** — hours math for freshman and sophomore scholars with required minutes, plus **overall WAHF** on-time / late / missing counts | Enrolled freshman/sophomore scholars with required hours (cohort years from `FALL_SEMESTER_FIRST_DAY`) |

There is no separate Form submissions accordion. WAHF totals live on attendance detail; people who have not submitted (or submitted late) live on scholar follow-up; assignment grades live on Recognition board (lows also on follow-up); WPL/MCF live on team leader performance.

---

## Files

| File | Source Link | Description |
|------|-------------|-------------|
| `page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/page.tsx) | Memo page server component — header shell + async body |
| `types.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/types.ts) | Page-data and view-model types |
| `layout.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/layout.tsx) | TL+ access gate |

---

## Subdirectories

| Directory | Description |
|-----------|-------------|
| `_components/` | Memo-specific subcomponents (prefixed `_` = route-private, not shared globally) |
| `_lib/` | Memo-specific utilities and assembler logic |

### `_components/`

| File | Source Link | Description |
|------|-------------|-------------|
| `weekly-memo-header-shell.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/weekly-memo-header-shell.tsx) | Persistent header: week range, section blurb, week nav |
| `weekly-memo-header.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/weekly-memo-header.tsx) | Header used by memo-legacy |
| `weekly-memo-async-content.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/weekly-memo-async-content.tsx) | Fetches page-data and renders sections |
| `weekly-kpi-cards.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/weekly-kpi-cards.tsx) | Weekly KPI summary cards |
| `team-leader-performance-table.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/team-leader-performance-table.tsx) | TL WPL / MCF / WAHF |
| `scholar-follow-up-table.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/scholar-follow-up-table.tsx) | Scholars needing a conversation |
| `full-attendance-detail-section.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/full-attendance-detail-section.tsx) | Hours census + overall WAHF counts |
| `tutoring-log-section.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/tutoring-log-section.tsx) | Tutor sessions / empty sessions |
| `recognition-board-section.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/recognition-board-section.tsx) | WAHF grade census (three bands) |
| `memo-accordion-section.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_components/memo-accordion-section.tsx) | Accordion wrapper (optional section description) |

### `_lib/`

| File | Source Link | Description |
|------|-------------|-------------|
| `memo-source.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_lib/memo-source.ts) | Data fetching layer for memo page |
| `memo-section-guide.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_lib/memo-section-guide.ts) | Header blurb copy |
| `risk-classifier.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_lib/risk-classifier.ts) | Follow-up Issues (glance labels + hours/grade pct + WAHF submitted-at) |
| `weekly-memo-assembler.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_lib/weekly-memo-assembler.ts) | Assembles page-data into the display model |
| `weekly-memo-assembler.test.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/_lib/weekly-memo-assembler.test.ts) | Unit tests for the assembler |

---

## Standards

- **`_` prefix = route-private** — components and lib files in `_components/` and `_lib/` are for this route only. If a component is needed elsewhere, move it to `frontend/components/`.
- **Assembler owns data shape** — `weekly-memo-assembler.ts` is the single place that transforms raw API data into the memo display model. Do not transform data in individual components.
- **Test the assembler** — the assembler contains the most business logic; tests must be kept current.
- **Risk classification is in `risk-classifier.ts`** — do not hardcode thresholds in components.
- **Scholar forms vs TL forms** — do not show WPL/MCF as required on scholar rows. WAHF exceptions are follow-up Issues (submitted-at when a log exists); WAHF census is on attendance detail. Assignment grades from WAHF are the Recognition board census; only low grades are follow-up Issues.
- **What's missing vs how it's missing** — glance column is short labels only (no numbers). How-it's-missing uses CompletionMeter for hours/grades and a time indicator for WAHF. Do not put healthy FD/SS meters on follow-up. Hours only appear when below the classifier threshold; late/missing WAHF use form-log `created_at`, never attendance.
