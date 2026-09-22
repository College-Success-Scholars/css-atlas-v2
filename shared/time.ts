/**
 * @file time.ts
 * @module shared
 *
 * Main public API for the shared time/calendar library.
 * This is the single file that both backend and frontend import from
 * (`shared/dist/time.js`). It provides the campus week calendar functions,
 * Eastern time utilities, formatting helpers, and re-exports config types.
 *
 * ## Responsibilities
 * - campusWeekToDateRange(weekNum): week number → { startDate, endDate }
 * - dateToCampusWeek(date): date → week number
 * - isCollectionYearStarted(now?): true iff dateToCampusWeek(now) != null
 * - getWeekFetchEnd(weekNum): get the fetch-end boundary date for a week
 * - formatEntryDate(iso, showTime?): format a timestamp for display
 * - formatDuration(ms): format milliseconds as "Xh Ym Zs"
 * - formatDate(iso): format an ISO date string
 * - formatMinutesToHoursAndMinutes(minutes): format minutes as "Xh Ym"
 * - freshman/sophomore cohort years from FALL_SEMESTER_FIRST_DAY
 * - Re-export all from eastern-time.ts, time-config.ts, time-types.ts
 *
 * ## What belongs here
 * - Convenience wrappers over campus-calendar.ts that use the app's configured calendar
 * - All display formatting functions for dates and durations
 * - Re-exports that make this file the single import target
 *
 * ## What does NOT belong here
 * - Low-level date arithmetic (that's eastern-time.ts)
 * - Calendar construction (that's campus-calendar.ts)
 * - Configuration constants (that's time-config.ts)
 */
import { createCampusCalendar, type CampusDay } from "./campus-calendar.js";
import {
  addEasternCalendarDays,
  EASTERN_TIMEZONE,
  ONE_DAY_MS,
  parseEasternDate,
} from "./eastern-time.js";
import {
  FALL_SEMESTER_FIRST_DAY,
  WINTER_BREAK_FIRST_DAY,
  WINTER_BREAK_LAST_DAY,
} from "./time-config.js";
import type { CampusWeekDateRange } from "./time-types.js";

export {
  EASTERN_TIMEZONE,
  ONE_DAY_MS,
  addEasternCalendarDays,
  getEasternDateParts,
  getEasternDayOfWeek,
  getStartOfDayEastern,
  parseEasternDate,
} from "./eastern-time.js";
export {
  FALL_SEMESTER_FIRST_DAY,
  WINTER_BREAK_FIRST_DAY,
  WINTER_BREAK_LAST_DAY,
  WEEKS_IGNORE_FORMS,
  WEEKS_IGNORE_SESSIONS,
} from "./time-config.js";
export type { CampusWeekDateRange, WeekDateRange } from "./time-types.js";
export { createCampusCalendar, type CampusCalendar, type CampusDay, type CampusWeekRange } from "./campus-calendar.js";

const campusCalendar = createCampusCalendar({
  fallSemesterFirstDay: FALL_SEMESTER_FIRST_DAY as CampusDay,
  winterBreakFirstDay: WINTER_BREAK_FIRST_DAY as CampusDay,
  winterBreakLastDay: WINTER_BREAK_LAST_DAY as CampusDay,
  timeZone: EASTERN_TIMEZONE,
});

const SEMESTER_START =
  campusCalendar.rangeOf(1)?.startDate ?? parseEasternDate(FALL_SEMESTER_FIRST_DAY);
export const WINTER_BREAK_CAMPUS_WEEK_NUMBER =
  campusCalendar.weekOf(WINTER_BREAK_FIRST_DAY as CampusDay) ?? 0;
const WINTER_START =
  campusCalendar.rangeOf(WINTER_BREAK_CAMPUS_WEEK_NUMBER)?.startDate ??
  parseEasternDate(WINTER_BREAK_FIRST_DAY);
const WINTER_END =
  campusCalendar.rangeOf(WINTER_BREAK_CAMPUS_WEEK_NUMBER)?.endDate ??
  parseEasternDate(WINTER_BREAK_LAST_DAY);
const FIRST_SPRING_MONDAY =
  campusCalendar.rangeOf(WINTER_BREAK_CAMPUS_WEEK_NUMBER + 1)?.startDate ??
  addEasternCalendarDays(WINTER_END, 1);
const WEEK_1_MONDAY = SEMESTER_START;

export const CAMPUS_WEEK = {
  WEEK_1_MONDAY,
  SEMESTER_START_DATE: SEMESTER_START,
  WINTER_BREAK_START_DATE: WINTER_START,
  WINTER_BREAK_END_DATE: WINTER_END,
  FIRST_SPRING_MONDAY,
  WINTER_BREAK_WEEK_NUMBER: WINTER_BREAK_CAMPUS_WEEK_NUMBER,
  DAYS_PER_WEEK: 7,
} as const;

export function campusWeekToDateRange(weekNumber: number): CampusWeekDateRange | null {
  const range = campusCalendar.rangeOf(weekNumber);
  if (!range) return null;
  return {
    weekNumber: range.week,
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export function dateToCampusWeek(date: Date): number | null {
  return campusCalendar.weekOf(date);
}

/** True once the Fall collection year has a campus week for `now` (not before Fall start). */
export function isCollectionYearStarted(now: Date = new Date()): boolean {
  return dateToCampusWeek(now) != null;
}

export function getWeekFetchEnd(range: { endDate: Date }): Date {
  return new Date(range.endDate.getTime() + ONE_DAY_MS - 1);
}

export function formatEntryDate(iso: string, showTime = false): string {
  const d = new Date(iso);
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: EASTERN_TIMEZONE });
  const entryET = d.toLocaleDateString("en-CA", { timeZone: EASTERN_TIMEZONE });
  const timeOnly = d
    .toLocaleTimeString("en-US", {
      timeZone: EASTERN_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s/g, "");
  if (entryET === todayET) return timeOnly;
  const [y1, m1, d1] = todayET.split("-").map(Number);
  const [y2, m2, d2] = entryET.split("-").map(Number);
  const daysAgo = ((y1 ?? 0) - (y2 ?? 0)) * 372 + ((m1 ?? 0) - (m2 ?? 0)) * 31 + ((d1 ?? 0) - (d2 ?? 0));
  if (daysAgo >= 1 && daysAgo <= 6) {
    const weekday = d.toLocaleDateString("en-US", { timeZone: EASTERN_TIMEZONE, weekday: "long" });
    return showTime ? `${weekday}, ${timeOnly}` : weekday;
  }
  const month = d.toLocaleDateString("en-US", { timeZone: EASTERN_TIMEZONE, month: "long" });
  const dayNum = d2 ?? 1;
  const ord =
    dayNum === 1 || dayNum === 21 || dayNum === 31
      ? "st"
      : dayNum === 2 || dayNum === 22
        ? "nd"
        : dayNum === 3 || dayNum === 23
          ? "rd"
          : "th";
  return `${month} ${dayNum}${ord}, ${timeOnly}`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function getDurationMs(item: { timeInRoomMs?: number; durationMs?: number }): number {
  return item.durationMs ?? item.timeInRoomMs ?? 0;
}

export function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  const mins = Math.round(Number(totalMinutes)) || 0;
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h\n${minutes}m`;
}

/** Entering cohort year for this academic year's freshmen (year of FALL_SEMESTER_FIRST_DAY). */
export function freshmanCohortYear(): number {
  return Number.parseInt(FALL_SEMESTER_FIRST_DAY.slice(0, 4), 10);
}

/** Entering cohort year for this academic year's sophomores. */
export function sophomoreCohortYear(): number {
  return freshmanCohortYear() - 1;
}

/** Front-desk / study-session hours apply only to current freshmen and sophomores. */
export function isHourEligibleCohort(cohort: number | null | undefined): boolean {
  if (cohort == null || !Number.isFinite(Number(cohort))) return false;
  const year = Number(cohort);
  return year === freshmanCohortYear() || year === sophomoreCohortYear();
}

export type ScholarYearLabel = "Freshman" | "Sophomore";
export type ScholarYearGroupLabel = "Freshmen" | "Sophomores";

/** Class-year label for hour-eligible cohorts; null for juniors+ or missing cohort. */
export function scholarYearLabel(cohort: number | null | undefined): ScholarYearLabel | null {
  if (cohort == null || !Number.isFinite(Number(cohort))) return null;
  const year = Number(cohort);
  if (year === freshmanCohortYear()) return "Freshman";
  if (year === sophomoreCohortYear()) return "Sophomore";
  return null;
}

/** Plural class-year label for cohort groups (print snapshot, roster headings). */
export function scholarYearGroupLabel(cohort: number | null | undefined): ScholarYearGroupLabel | null {
  const label = scholarYearLabel(cohort);
  if (label === "Freshman") return "Freshmen";
  if (label === "Sophomore") return "Sophomores";
  return null;
}
