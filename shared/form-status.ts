/**
 * @file form-status.ts
 * @module shared
 *
 * The one place that knows when each required form is due and what state a
 * team leader's or scholar's submissions are in. See "Time and compliance
 * windows" in docs/agents/ubiquitous_language.md.
 *
 *   WAHF   due Thursday 11:59:59.999 PM (Eastern) of its campus week
 *   WPL    due Friday 5:00 PM (Eastern)
 *   MCF    due Friday 5:00 PM (Eastern), one per assigned mentee
 */
import { campusWeekToDateRange, dateToCampusWeek, ONE_DAY_MS } from "./time.js";

export type RequiredForm = "WAHF" | "WPL" | "MCF";

/** The normalized state of a required form for one campus week. "incomplete" only arises for MCF. */
export type FormStatus = "on-time" | "late" | "incomplete" | "missing";

const HOUR_MS = 60 * 60 * 1000;

/** Offset of each form's deadline from the start (Monday 12:00 AM Eastern) of its campus week. */
const DUE_AFTER_WEEK_START: Record<RequiredForm, number> = {
  WAHF: 4 * ONE_DAY_MS - 1,
  WPL: 4 * ONE_DAY_MS + 17 * HOUR_MS,
  MCF: 4 * ONE_DAY_MS + 17 * HOUR_MS,
};

/** When `form` is due for campus week `weekNum`, or null if the week is outside the calendar. */
export function formDeadline(form: RequiredForm, weekNum: number): Date | null {
  const range = campusWeekToDateRange(weekNum);
  return range ? new Date(range.startDate.getTime() + DUE_AFTER_WEEK_START[form]) : null;
}

/**
 * Whether a submission made at `submittedAt` is late: after the deadline of
 * campus week `weekNum` when given, otherwise of the week it was submitted in.
 * A submission outside the campus calendar is never late.
 */
export function isLate(form: RequiredForm, submittedAt: string | Date, weekNum?: number): boolean {
  const submitted = typeof submittedAt === "string" ? new Date(submittedAt) : submittedAt;
  const week = weekNum ?? dateToCampusWeek(submitted);
  const deadline = week == null ? null : formDeadline(form, week);
  return deadline != null && submitted.getTime() > deadline.getTime();
}

/**
 * The state of a form owed `required` times (1 for WAHF and WPL, one per
 * mentee for MCF) given how many arrived and whether any arrived late.
 */
export function formStatus(submissions: { required: number; completed: number; late: boolean }): FormStatus {
  const { required, completed, late } = submissions;
  if (required <= 0) return "on-time";
  if (completed <= 0) return "missing";
  if (completed < required) return "incomplete";
  return late ? "late" : "on-time";
}
