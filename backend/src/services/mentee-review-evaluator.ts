/**
 * @file mentee-review-evaluator.ts
 * @module backend/services
 *
 * Pure weekly-review evaluator. No Supabase, no HTTP, no ambient clock —
 * callers pass normalized evidence and one injected `asOf` instant. The same
 * output is consumed by the semester grid, the requirement cards, and the
 * click-time MCF prefill so they cannot disagree.
 *
 * ## Responsibilities
 * - Program-local week bounds with [Monday 00:00, next Monday 00:00) containment
 * - Interval normalization (clip, merge overlaps, preserve source IDs)
 * - Hour totals, nullable targets, unrounded percent, 60/90 bands
 * - Scheduled-shift classification (attended/short/no-show/active/upcoming)
 * - WAHF, recorded-tutoring, and latest-grade derivation
 *
 * ## What belongs here
 * - evaluateWeek, deriveLatestGrades, and their pure helpers
 *
 * ## What does NOT belong here
 * - Roster/authorization queries (mentee.service)
 * - Source adapters that fetch rows (activity/attendance adapters)
 * - Notification or memo semantics (other consumers keep their own contracts)
 */
import {
  addEasternCalendarDays,
  campusWeekToDateRange,
  dateToCampusWeek,
  parseEasternDate,
  WINTER_BREAK_CAMPUS_WEEK_NUMBER,
} from "./time.service.js";
import { easternTimestamp } from "./shift-occurrence.service.js";
import {
  GRADE_BAND_GREEN_MIN_PERCENT,
  GRADE_BAND_NEUTRAL_MIN_PERCENT,
  GRADE_BAND_ORANGE_MIN_PERCENT,
  HOUR_BAND_GREEN_MIN_PERCENT,
  HOUR_BAND_ORANGE_MIN_PERCENT,
  HOUR_DISPLAY_DECIMALS,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  SHORT_SHIFT_THRESHOLD_RATIO,
} from "../models/mentee-review.model.js";
import type {
  EvaluateWeekInput,
  GradeBand,
  GradeSubmissionInput,
  GradesEvidenceInput,
  HourBand,
  HourWeekSummary,
  LatestGradeEntry,
  LatestGradesSummary,
  LoggedIntervalInput,
  NormalizedInterval,
  OffShiftLogEvidence,
  ScheduledShiftInput,
  ShiftEvidence,
  ShiftStatus,
  ShiftSessionKind,
  TutoringEvidenceInput,
  TutoringSessionLine,
  TutoringWeekSummary,
  WahfEvidence,
  WahfWeekSummary,
  WeekDescriptor,
  WeekPhase,
  WeekReviewSummary,
} from "../models/mentee-review.model.js";

const HOUR_KINDS: ShiftSessionKind[] = ["front_desk", "study_session"];

// ---------------------------------------------------------------------------
// Interval helpers (task 2.3)
// ---------------------------------------------------------------------------

/**
 * Clip intervals to [start, end) and merge strictly-overlapping ones.
 * A boundary touch (next.start === current.end) is NOT an overlap and does
 * not merge. All inputs must share one `kind`. Source IDs are preserved.
 */
export function normalizeWeekIntervals(
  intervals: LoggedIntervalInput[],
  weekStartMs: number,
  weekEndExclusiveMs: number
): NormalizedInterval[] {
  const clipped = intervals
    .map((iv) => ({
      kind: iv.kind,
      startMs: Math.max(iv.start.getTime(), weekStartMs),
      endMs: Math.min(iv.end.getTime(), weekEndExclusiveMs),
      sourceId: iv.sourceId,
    }))
    .filter((iv) => iv.endMs > iv.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const merged: NormalizedInterval[] = [];
  for (const iv of clipped) {
    const last = merged[merged.length - 1];
    if (last && iv.startMs < last.end.getTime()) {
      if (iv.endMs > last.end.getTime()) last.end = new Date(iv.endMs);
      if (!last.sourceIds.includes(iv.sourceId)) last.sourceIds.push(iv.sourceId);
    } else {
      merged.push({
        kind: iv.kind,
        start: new Date(iv.startMs),
        end: new Date(iv.endMs),
        sourceIds: [iv.sourceId],
      });
    }
  }
  return merged;
}

/** Positive overlap in ms; returns 0 for a boundary touch or disjoint ranges. */
export function positiveOverlapMs(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number
): number {
  return Math.max(0, Math.min(aEndMs, bEndMs) - Math.max(aStartMs, bStartMs));
}

// ---------------------------------------------------------------------------
// Display / band helpers (task 2.4)
// ---------------------------------------------------------------------------

export function hourBandForPercent(percent: number): HourBand {
  if (percent >= HOUR_BAND_GREEN_MIN_PERCENT) return "green";
  if (percent >= HOUR_BAND_ORANGE_MIN_PERCENT) return "orange";
  return "red";
}

export function gradeBandForPercent(percent: number): GradeBand {
  if (percent >= GRADE_BAND_GREEN_MIN_PERCENT) return "green";
  if (percent >= GRADE_BAND_NEUTRAL_MIN_PERCENT) return "neutral";
  if (percent >= GRADE_BAND_ORANGE_MIN_PERCENT) return "orange";
  return "red";
}

/** One-decimal display value of a duration in hours. */
export function displayHoursFor(loggedMs: number): number {
  const factor = 10 ** HOUR_DISPLAY_DECIMALS;
  return Math.round((loggedMs / MS_PER_HOUR) * factor) / factor;
}

// ---------------------------------------------------------------------------
// Hour + shift evaluation (tasks 2.4, 2.5, 2.9)
// ---------------------------------------------------------------------------

interface ShiftClassification {
  scheduledStartMs: number;
  scheduledEndMs: number;
  scheduledMs: number;
  overlapMs: number;
  status: ShiftStatus;
}

function classifyShift(
  shift: ScheduledShiftInput,
  normalized: NormalizedInterval[],
  asOfMs: number,
  nonTerminalDates: ReadonlySet<string>
): ShiftClassification {
  const occurrenceDate = parseEasternDate(shift.date);
  const scheduledStartMs = easternTimestamp(occurrenceDate, shift.startTime).getTime();
  const scheduledEndMs = easternTimestamp(occurrenceDate, shift.endTime).getTime();
  const scheduledMs = Math.max(0, scheduledEndMs - scheduledStartMs);

  let overlapMs = 0;
  for (const iv of normalized) {
    overlapMs += positiveOverlapMs(
      iv.start.getTime(),
      iv.end.getTime(),
      scheduledStartMs,
      scheduledEndMs
    );
  }

  let status: ShiftStatus;
  if (asOfMs < scheduledStartMs) status = "upcoming";
  else if (asOfMs < scheduledEndMs) status = "active";
  else if (overlapMs <= 0) status = "no_show";
  else if (overlapMs < SHORT_SHIFT_THRESHOLD_RATIO * scheduledMs) status = "short";
  else status = "attended";

  // Open/unmatched evidence on the day means the miss cannot be confirmed.
  if (status === "no_show" && nonTerminalDates.has(shift.date)) status = "unconfirmed";

  return { scheduledStartMs, scheduledEndMs, scheduledMs, overlapMs, status };
}

export function evaluateHours(params: {
  kind: ShiftSessionKind;
  targetHours: number | null;
  shifts: ScheduledShiftInput[];
  logs: LoggedIntervalInput[];
  weekStartMs: number;
  weekEndExclusiveMs: number;
  asOfMs: number;
  phase: WeekPhase;
  nonTerminalDates: ReadonlySet<string>;
}): HourWeekSummary {
  const {
    kind,
    targetHours,
    shifts,
    logs,
    weekStartMs,
    weekEndExclusiveMs,
    asOfMs,
    phase,
    nonTerminalDates,
  } = params;

  const normalized = normalizeWeekIntervals(logs, weekStartMs, weekEndExclusiveMs);
  const loggedMs = normalized.reduce((sum, iv) => sum + (iv.end.getTime() - iv.start.getTime()), 0);
  const loggedMinutes = loggedMs / MS_PER_MINUTE;

  const targetMinutes =
    targetHours != null && Number.isFinite(targetHours) && targetHours > 0 ? targetHours * 60 : null;
  const percent =
    targetMinutes != null ? (loggedMinutes / targetMinutes) * 100 : null;
  const band = percent == null ? null : hourBandForPercent(percent);
  const overageMinutes =
    targetMinutes != null && loggedMinutes > targetMinutes
      ? Math.round(loggedMinutes - targetMinutes)
      : 0;
  const pending = phase === "current" && band !== null && band !== "green";

  const shiftEvidence: ShiftEvidence[] = shifts
    .map((shift): ShiftEvidence => {
      const c = classifyShift(shift, normalized, asOfMs, nonTerminalDates);
      return {
        sourceId: shift.sourceId,
        kind,
        date: shift.date,
        scheduledStart: new Date(c.scheduledStartMs),
        scheduledEnd: new Date(c.scheduledEndMs),
        scheduledMinutes: Math.round(c.scheduledMs / MS_PER_MINUTE),
        overlapMinutes: c.overlapMs / MS_PER_MINUTE,
        status: c.status,
      };
    })
    .sort(
      (a, b) =>
        a.scheduledStart.getTime() - b.scheduledStart.getTime() ||
        a.sourceId.localeCompare(b.sourceId)
    );

  const offShiftLogs: OffShiftLogEvidence[] = normalized
    .filter((iv) => {
      const startMs = iv.start.getTime();
      const endMs = iv.end.getTime();
      return !shiftEvidence.some((s) =>
        positiveOverlapMs(
          startMs,
          endMs,
          s.scheduledStart.getTime(),
          s.scheduledEnd.getTime()
        ) > 0
      );
    })
    .map((iv) => ({
      kind,
      start: iv.start,
      end: iv.end,
      minutes: (iv.end.getTime() - iv.start.getTime()) / MS_PER_MINUTE,
      sourceIds: iv.sourceIds,
    }));

  return {
    kind,
    assignmentAvailable: shifts.length > 0,
    loggedMinutes,
    targetMinutes,
    percent,
    band,
    displayHours: displayHoursFor(loggedMs),
    overageMinutes,
    pending,
    noShowCount: shiftEvidence.filter((s) => s.status === "no_show").length,
    hasActivity: normalized.length > 0 || shifts.length > 0,
    shifts: shiftEvidence,
    offShiftLogs,
  };
}

// ---------------------------------------------------------------------------
// WAHF (task 2.6)
// ---------------------------------------------------------------------------

export function evaluateWahf(evidence: WahfEvidence, asOf: Date): WahfWeekSummary {
  if (!evidence.available) {
    return {
      status: "unknown",
      dueAt: evidence.dueAt,
      submittedAt: null,
      onTime: null,
      submissionId: null,
    };
  }
  if (evidence.submission) {
    const onTime = evidence.submission.submittedAt.getTime() <= evidence.dueAt.getTime();
    return {
      status: "submitted",
      dueAt: evidence.dueAt,
      submittedAt: evidence.submission.submittedAt,
      onTime,
      submissionId: evidence.submission.sourceId,
    };
  }
  const status = asOf.getTime() > evidence.dueAt.getTime() ? "missing" : "pending";
  return { status, dueAt: evidence.dueAt, submittedAt: null, onTime: null, submissionId: null };
}

// ---------------------------------------------------------------------------
// Recorded tutoring attendance (task 2.7)
// ---------------------------------------------------------------------------

export function evaluateTutoring(evidence: TutoringEvidenceInput): TutoringWeekSummary {
  if (!evidence.available) {
    return { status: "unknown", recordedAttendance: false, reports: [] };
  }

  // Group by report ID so multiple courses (or repeated rows) stay one session.
  const byId = new Map<string, TutoringSessionLine>();
  for (const r of evidence.reports) {
    const existing = byId.get(r.reportId);
    if (existing) {
      for (const course of r.courses) {
        if (!existing.courses.includes(course)) existing.courses.push(course);
      }
      if (existing.date == null) existing.date = r.date;
      if (existing.startTime == null) existing.startTime = r.startTime;
      if (existing.endTime == null) existing.endTime = r.endTime;
    } else {
      byId.set(r.reportId, {
        reportId: r.reportId,
        courses: [...r.courses],
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
      });
    }
  }

  const reports = [...byId.values()];
  return reports.length > 0
    ? { status: "recorded", recordedAttendance: true, reports }
    : { status: "none", recordedAttendance: false, reports: [] };
}

// ---------------------------------------------------------------------------
// Latest grades (task 2.8)
// ---------------------------------------------------------------------------

const PERCENT_PATTERN = /^(\d+(?:\.\d+)?)\s*%$/;
const BARE_NUMBER_PATTERN = /^(\d+(?:\.\d+)?)$/;

/**
 * Parse an unambiguous numeric percent. Accepts "90%" or a bare 0–100 number;
 * rejects letters, fractions (e.g. "9/10"), ranges, and out-of-range values.
 */
export function parseGradePercent(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const percentMatch = PERCENT_PATTERN.exec(trimmed);
  if (percentMatch) {
    const value = Number(percentMatch[1]);
    return Number.isFinite(value) ? value : null;
  }
  const bareMatch = BARE_NUMBER_PATTERN.exec(trimmed);
  if (bareMatch) {
    const value = Number(bareMatch[1]);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  }
  return null;
}

interface OrderedGradeEntry {
  submissionIndex: number;
  entryIndex: number;
  submittedAtMs: number;
  course: string;
  assessment: string;
  percent: number | null;
}

/**
 * Latest grades come from the latest WAHF submission only (by submittedAt),
 * even when it has no grades. Comparison uses the most recent earlier
 * same-course entry; ordering across submissions is by submittedAt and within
 * a submission by observed scholar-entry order (no source order metadata).
 */
export function deriveLatestGrades(evidence: GradesEvidenceInput): LatestGradesSummary {
  if (!evidence.available) {
    return { status: "error", submissionId: null, submittedAt: null, entries: [] };
  }
  if (evidence.submissions.length === 0) {
    return { status: "empty", submissionId: null, submittedAt: null, entries: [] };
  }

  const sorted: GradeSubmissionInput[] = [...evidence.submissions].sort(
    (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()
  );
  const latest = sorted[sorted.length - 1]!;
  const latestIndex = sorted.length - 1;

  if (latest.entries.length === 0) {
    return {
      status: "empty",
      submissionId: latest.sourceId,
      submittedAt: latest.submittedAt,
      entries: [],
    };
  }

  // Flatten every entry with a stable global order for comparison lookups.
  const ordered: OrderedGradeEntry[] = [];
  sorted.forEach((submission, submissionIndex) => {
    submission.entries.forEach((entry, entryIndex) => {
      ordered.push({
        submissionIndex,
        entryIndex,
        submittedAtMs: submission.submittedAt.getTime(),
        course: entry.course,
        assessment: entry.assessment,
        percent: parseGradePercent(entry.rawGrade),
      });
    });
  });

  const entries: LatestGradeEntry[] = latest.entries.map((entry, entryIndex) => {
    const percent = parseGradePercent(entry.rawGrade);
    const band = percent == null ? null : gradeBandForPercent(percent);
    const selfId = { submissionIndex: latestIndex, entryIndex };

    const priors = ordered.filter(
      (o) =>
        o.course === entry.course &&
        !(o.submissionIndex === selfId.submissionIndex && o.entryIndex === selfId.entryIndex) &&
        (o.submissionIndex < selfId.submissionIndex ||
          (o.submissionIndex === selfId.submissionIndex && o.entryIndex < selfId.entryIndex))
    );

    let comparison: LatestGradeEntry["comparison"] = null;
    let firstGrade = false;
    if (percent == null) {
      // Unsupported score: keep raw text only, no speculative comparison.
      firstGrade = false;
    } else if (priors.length === 0) {
      firstGrade = true;
    } else {
      const mostRecentPrior = priors
        .filter((o) => o.percent != null)
        .sort(
          (a, b) =>
            a.submittedAtMs - b.submittedAtMs ||
            a.submissionIndex - b.submissionIndex ||
            a.entryIndex - b.entryIndex
        )
        .pop();
      if (mostRecentPrior && mostRecentPrior.percent != null) {
        const priorPercent = mostRecentPrior.percent;
        comparison = {
          direction:
            percent > priorPercent ? "up" : percent < priorPercent ? "down" : "equal",
          priorPercent,
          priorAssessment: mostRecentPrior.assessment || null,
        };
      }
      // A prior same-course grade exists but is unsupported: no fake direction.
    }

    return {
      course: entry.course,
      assessment: entry.assessment,
      rawGrade: entry.rawGrade,
      percent,
      band,
      comparison,
      firstGrade,
    };
  });

  return {
    status: "grades",
    submissionId: latest.sourceId,
    submittedAt: latest.submittedAt,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Week composition (tasks 2.1, 2.2, 2.9)
// ---------------------------------------------------------------------------

export function evaluateWeek(input: EvaluateWeekInput): WeekReviewSummary {
  const weekStartMs = input.weekStart.getTime();
  const nextMonday = addEasternCalendarDays(input.weekEnd, 1);
  const weekEndExclusiveMs = nextMonday.getTime();
  const asOfMs = input.asOf.getTime();

  const phase: WeekPhase =
    asOfMs < weekStartMs ? "future" : asOfMs >= weekEndExclusiveMs ? "past" : "current";

  const nonTerminalDates = new Set(input.nonTerminalDates ?? []);

  const hours = HOUR_KINDS.map((kind) =>
    evaluateHours({
      kind,
      targetHours: input.targets[kind] ?? null,
      shifts: input.shifts.filter((s) => s.kind === kind),
      logs: input.logs.filter((l) => l.kind === kind),
      weekStartMs,
      weekEndExclusiveMs,
      asOfMs,
      phase,
      nonTerminalDates,
    })
  );

  return {
    weekNumber: input.weekNumber,
    weekStart: input.weekStart.toISOString(),
    weekEnd: input.weekEnd.toISOString(),
    phase,
    hours,
    wahf: evaluateWahf(input.wahf, input.asOf),
    tutoring: evaluateTutoring(input.tutoring),
  };
}

/**
 * Program-local instructional weeks for the grid, derived from real semester
 * bounds plus the campus calendar. The collapsed winter-break week is included
 * as a neutral, non-selectable Break week rather than one giant Mon–Sun week.
 * Future weeks are non-selectable. Returns [] when there is no active semester.
 */
export function buildSemesterWeeks(params: {
  semesterStart: Date | null;
  semesterEnd: Date | null;
  asOf: Date;
  currentWeek: number | null;
}): WeekDescriptor[] {
  const { semesterStart, semesterEnd, asOf, currentWeek } = params;
  if (!semesterStart || !semesterEnd) return [];

  const firstWeek = dateToCampusWeek(semesterStart);
  const lastWeek = dateToCampusWeek(semesterEnd);
  if (firstWeek == null || lastWeek == null || lastWeek < firstWeek) return [];

  const weeks: WeekDescriptor[] = [];
  for (let week = firstWeek; week <= lastWeek; week += 1) {
    const range = campusWeekToDateRange(week);
    if (!range) continue;
    const isBreak = week === WINTER_BREAK_CAMPUS_WEEK_NUMBER;
    const isFuture = range.startDate.getTime() > asOf.getTime();
    weeks.push({
      weekNumber: week,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      isBreak,
      isCurrent: currentWeek != null && week === currentWeek,
      isFuture,
      isSelectable: !isBreak && !isFuture,
    });
  }
  return weeks;
}
