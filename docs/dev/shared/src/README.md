# shared/src

**Location:** [`shared/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/shared) (source files are at the shared root, not in a src/ subdirectory)  
**Docs:** `docs/dev/shared/src/README.md`

## Navigation

[← Root](../../README.md) › [Shared](../README.md) › src

---

## Purpose

Pure TypeScript source for the shared library. All exports are re-exported through `time.ts` as a single barrel. The library provides the campus week calendar system and Eastern-timezone date utilities used by both backend services and frontend components.

---

## Files

| File | Source Link | Description |
|------|-------------|-------------|
| `time.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/shared/time.ts) | Barrel export — re-exports everything from the other files; this is the main import target |
| `time-config.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/shared/time-config.ts) | Academic calendar constants: `FALL_SEMESTER_FIRST_DAY`, winter break dates, ignored-week arrays |
| `time-types.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/shared/time-types.ts) | TypeScript types: `CampusWeekDateRange`, `WeekDateRange` |
| `eastern-time.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/shared/eastern-time.ts) | Timezone-safe date utilities for Eastern Time (America/New_York): parse, format, add days, get day of week, etc. |
| `campus-calendar.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/shared/campus-calendar.ts) | Campus week calendar built from `time-config.ts` constants: `weekOf(date)` and `rangeOf(weekNum)` |
| `auth.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/shared/auth.ts) | Auth constants and helpers: `APP_ROLE_ORDER`, `hasRoleAtLeast`, `mergeProfileWithRoster`, `canAccessRequestedScholarId`, `parseRequestedScholarId` |

---

## Key Exports (from `time.ts`)

```typescript
// Campus calendar
campusWeekToDateRange(weekNum: number): CampusWeekDateRange
dateToCampusWeek(date: Date): number | null
isCollectionYearStarted(now?: Date): boolean  // true iff dateToCampusWeek(now) != null

// Eastern time utilities
parseEasternDate(input: string): Date          // "YYYY-MM-DD" → UTC Date
getEasternDateParts(date: Date): { year, month, day }
getStartOfDayEastern(date: Date): Date
addEasternCalendarDays(date: Date, delta: number): Date
easternCalendarDaysBetween(earlier: Date, later: Date): number
getEasternDayOfWeek(date: Date): number        // 0=Sun
mondayOfWeekEastern(date: Date): Date

// Formatting
formatEntryDate(iso: string, showTime?: boolean): string
formatDuration(ms: number): string             // "Xh Ym Zs"
formatDate(iso: string): string
formatMinutesToHoursAndMinutes(minutes: number): string

// Config constants
FALL_SEMESTER_FIRST_DAY: string                // "YYYY-MM-DD"
WEEKS_IGNORE_FORMS: number[]
WEEKS_IGNORE_SESSIONS: number[]
```

---

## Standards

- **`time.ts` is the only public import target** — consumers import from `@css-atlas/shared/time`, not from sub-files.
- **Update `time.ts` barrel** when adding a new export to any other file.
- **`time-config.ts` is the only place to change calendar dates** — do not hardcode academic year dates anywhere else.
- **No side effects** — all source files are pure declarations and function definitions.
- **Run `npm run build --prefix shared`** after every change — backend and frontend use the compiled `dist/`.

<!-- AUTO-API-REFERENCE:START -->

## API Reference

Generated from TypeScript signatures. Module indexes below; full catalog: [API Reference hub](../../../reference/README.md).

| Module | Reference |
|--------|----------|
| `auth` | [API](../../../reference/api/shared/auth/README.md) |
| `campus-calendar` | [API](../../../reference/api/shared/campus-calendar/README.md) |
| `eastern-time` | [API](../../../reference/api/shared/eastern-time/README.md) |
| `time` | [API](../../../reference/api/shared/time/README.md) |
| `time-config` | [API](../../../reference/api/shared/time-config/README.md) |
| `time-types` | [API](../../../reference/api/shared/time-types/README.md) |

<!-- AUTO-API-REFERENCE:END -->
