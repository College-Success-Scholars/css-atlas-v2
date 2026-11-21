/**
 * @file mentee-review-wire.ts
 * @module backend/services
 *
 * Turns the composed mentee review, whose evidence carries `Date`, into the
 * contract's wire form, where every instant is an ISO string. Pure: the
 * review services and the evaluator keep working in `Date`.
 *
 * ## What does NOT belong here
 * - Composing or evaluating a review (mentee-review-activity.service,
 *   mentee-review-evaluator)
 */
import type * as wire from "@css-atlas/shared/contracts/mentees";
import type {
  HourWeekSummary,
  LatestGradeEntry,
  LatestGradesSummary,
  MenteeReview,
  OffShiftLogEvidence,
  OpenSignInEvidence,
  SectionResult,
  ShiftEvidence,
  WahfWeekSummary,
  WeekReviewSummary,
} from "../models/mentee-review.model.js";

/** `toJSON`, so an instant reads exactly as `JSON.stringify` wrote it before the contract. */
const iso = (date: Date): string => date.toJSON();
const isoOrNull = (date: Date | null): string | null => (date ? iso(date) : null);

function section<T, U>(result: SectionResult<T>, map: (data: T) => U): SectionResult<U> {
  return result.ok ? { ok: true, data: map(result.data), loadedAt: result.loadedAt } : result;
}

const shift = (s: ShiftEvidence): wire.ShiftEvidence => ({
  ...s,
  scheduledStart: iso(s.scheduledStart),
  scheduledEnd: iso(s.scheduledEnd),
  loggedStart: isoOrNull(s.loggedStart),
  loggedEnd: isoOrNull(s.loggedEnd),
});

const offShiftLog = (log: OffShiftLogEvidence): wire.OffShiftLogEvidence => ({
  ...log,
  start: iso(log.start),
  end: iso(log.end),
});

const openSignIn = (signIn: OpenSignInEvidence): wire.OpenSignInEvidence => ({ ...signIn, start: iso(signIn.start) });

const hours = (h: HourWeekSummary): wire.HourWeekSummary => ({
  ...h,
  shifts: h.shifts.map(shift),
  offShiftLogs: h.offShiftLogs.map(offShiftLog),
  openSignIns: h.openSignIns.map(openSignIn),
});

const wahf = (w: WahfWeekSummary): wire.WahfWeekSummary => ({
  ...w,
  dueAt: iso(w.dueAt),
  submittedAt: isoOrNull(w.submittedAt),
});

const weekSummary = (week: WeekReviewSummary): wire.WeekReviewSummary => ({
  ...week,
  hours: week.hours.map(hours),
  wahf: wahf(week.wahf),
});

const gradeEntry = (entry: LatestGradeEntry): wire.LatestGradeEntry => ({
  ...entry,
  submittedAt: entry.submittedAt && iso(entry.submittedAt),
});

const latestGrades = (grades: LatestGradesSummary): wire.LatestGradesSummary => ({
  ...grades,
  submittedAt: isoOrNull(grades.submittedAt),
  entries: grades.entries.map(gradeEntry),
});

export function toWireMenteeReview(review: MenteeReview): wire.MenteeReview {
  return {
    ...review,
    semesterGrid: section(review.semesterGrid, (weeks) => weeks.map(weekSummary)),
    selectedWeekReview: section(review.selectedWeekReview, (week) => week && weekSummary(week)),
    latestGrades: section(review.latestGrades, latestGrades),
  };
}
