/**
 * @file mentee-review.model.ts
 * @module backend/models
 *
 * Types and centralized constants for the mentee weekly-review evaluator.
 * The evaluator itself is pure (no Supabase, no HTTP); callers pass already
 * normalized evidence plus one injected `asOf` instant.
 *
 * ## What belongs here
 * - Band/threshold/display constants (single source of truth)
 * - Normalized evidence input types (logs, shifts, WAHF, tutoring, grades)
 * - Weekly summary output types consumed by the grid and cards
 * - SectionResult<T> for independently recoverable adapter sections
 *
 * ## What does NOT belong here
 * - Queries, HTTP handlers, or any runtime logic
 * - Roster/authorization data
 */
import type {
  GradeBand,
  GradeComparison,
  GradesStatus,
  HourBand,
  MeetingPreferenceOutput,
  MenteeReviewIdentity,
  SectionResult,
  SemesterCalendar,
  ShiftStatus,
  TutoringSessionLine,
  TutoringStatus,
  TutoringWeekSummary,
  WahfStatus,
  WeekDescriptor,
  WeekPhase,
} from "@css-atlas/shared/contracts/mentees";
import type { ShiftSessionKind } from "./session-log.model.js";

export type { ShiftSessionKind } from "./session-log.model.js";

// Shapes that cross the wire unchanged are defined once, in the API contract.
// The review types below that carry `Date` are the evaluator's own; the
// contract has their ISO-string twins (see services/mentee-review-wire.ts).
export type {
  GradeBand,
  GradeComparison,
  GradesStatus,
  HourBand,
  MenteeReviewIdentity,
  SectionResult,
  SemesterCalendar,
  ShiftStatus,
  TutoringSessionLine,
  TutoringStatus,
  TutoringWeekSummary,
  WahfStatus,
  WeekDescriptor,
  WeekPhase,
} from "@css-atlas/shared/contracts/mentees";

// ---------------------------------------------------------------------------
// Centralized constants (task 2.4 / design D2)
// ---------------------------------------------------------------------------

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const HOUR_DISPLAY_DECIMALS = 1;

/** Green at >= 90%, orange at 60–<90%, red below 60% (unrounded percent). */
export const HOUR_BAND_GREEN_MIN_PERCENT = 90;
export const HOUR_BAND_ORANGE_MIN_PERCENT = 60;

/** A partial shift is "noticeably short" below this fraction of scheduled time. */
export const SHORT_SHIFT_THRESHOLD_RATIO = 0.75;

/** Grade pill cutoffs: green >= 90, neutral 80–<90, orange 70–<80, red < 70. */
export const GRADE_BAND_GREEN_MIN_PERCENT = 90;
export const GRADE_BAND_NEUTRAL_MIN_PERCENT = 80;
export const GRADE_BAND_ORANGE_MIN_PERCENT = 70;

// ---------------------------------------------------------------------------
// Normalized evidence inputs
// ---------------------------------------------------------------------------

/** A logged attendance interval already resolved to instants; clipped/merged by the evaluator. */
export interface LoggedIntervalInput {
  sourceId: string;
  kind: ShiftSessionKind;
  start: Date;
  end: Date;
}

/**
 * A sign-in with no matching sign-out. Shown for visibility only: it never
 * contributes minutes or shift overlap, matching the Weekly Memo's completed-pair math.
 */
export interface OpenSignInEvidence {
  sourceId: string;
  kind: ShiftSessionKind;
  start: Date;
}

/** A standing scheduled shift occurrence (one date of a weekday assignment). */
export interface ScheduledShiftInput {
  sourceId: string;
  kind: ShiftSessionKind;
  /** Program-local calendar date, YYYY-MM-DD. */
  date: string;
  /** Program-local 24-hour start, HH:MM. */
  startTime: string;
  /** Program-local 24-hour end, HH:MM. */
  endTime: string;
}

export interface WahfEvidence {
  /** False when the source read failed; status becomes "unknown", never "missing". */
  available: boolean;
  dueAt: Date;
  submission: { sourceId: string; submittedAt: Date } | null;
}

export interface TutoringReportInput {
  reportId: string;
  /** Program-local session date (YYYY-MM-DD) or null when unavailable. */
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  courses: string[];
}

export interface TutoringEvidenceInput {
  /** False when the source read failed; status becomes "unknown", never "none". */
  available: boolean;
  reports: TutoringReportInput[];
}

export interface GradeEntryInput {
  course: string;
  assessment: string;
  /** Raw grade text as stored (percent, bare number, letter, etc.). */
  rawGrade: string;
}

export interface GradeSubmissionInput {
  sourceId: string;
  submittedAt: Date;
  /** Entries in observed scholar-entry order (no authoritative order metadata exists). */
  entries: GradeEntryInput[];
}

export interface GradesEvidenceInput {
  /** False when the submission-history read failed; status becomes "error". */
  available: boolean;
  submissions: GradeSubmissionInput[];
}

// ---------------------------------------------------------------------------
// Weekly summary outputs
// ---------------------------------------------------------------------------

/** A logged interval after clipping to the week and merging overlaps; source IDs preserved. */
export interface NormalizedInterval {
  kind: ShiftSessionKind;
  start: Date;
  end: Date;
  sourceIds: string[];
}

export interface ShiftEvidence {
  sourceId: string;
  kind: ShiftSessionKind;
  date: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  scheduledMinutes: number;
  /** Matched logged interval clipped to the shift, merged across overlapping logs; null when none overlapped. */
  loggedStart: Date | null;
  loggedEnd: Date | null;
  /** Positive raw overlap with logged intervals; a boundary touch is 0. */
  overlapMinutes: number;
  status: ShiftStatus;
}

export interface OffShiftLogEvidence {
  kind: ShiftSessionKind;
  start: Date;
  end: Date;
  minutes: number;
  sourceIds: string[];
}

export interface HourWeekSummary {
  kind: ShiftSessionKind;
  /** True when at least one scheduled shift applies to this week. */
  assignmentAvailable: boolean;
  /** Exact logged minutes (unrounded). */
  loggedMinutes: number;
  /**
   * TL-entered excuse minutes for this campus week (`scholar_week_excuses`).
   * Count toward percent/band/overage; tiers still use logged only.
   */
  excuseMinutes: number;
  /** Free-text reason from scholar_week_excuses; null when unset. */
  excuseDescription: string | null;
  /** Null when no positive target is configured. */
  targetMinutes: number | null;
  /** Unrounded percent of target using logged + excuse; null when no positive target. */
  percent: number | null;
  band: HourBand | null;
  /** One-decimal display value of logged hours. */
  displayHours: number;
  /** Whole minutes above target (logged + excuse); 0 when at or below. */
  overageMinutes: number;
  /** True only for an unfinished current week that is not yet green. */
  pending: boolean;
  noShowCount: number;
  hasActivity: boolean;
  shifts: ShiftEvidence[];
  offShiftLogs: OffShiftLogEvidence[];
  /** Sign-ins this week with no sign-out; not counted toward minutes. */
  openSignIns: OpenSignInEvidence[];
}

export interface WahfWeekSummary {
  status: WahfStatus;
  dueAt: Date;
  submittedAt: Date | null;
  onTime: boolean | null;
  submissionId: string | null;
}

export interface WeekReviewSummary {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  phase: WeekPhase;
  /** [front_desk, study_session] in stable order. */
  hours: HourWeekSummary[];
  wahf: WahfWeekSummary;
  tutoring: TutoringWeekSummary;
}

export interface LatestGradeEntry {
  /** Always emitted by the evaluator; optional for legacy single-submission DTOs. */
  submissionId?: string;
  submittedAt?: Date;
  course: string;
  assessment: string;
  rawGrade: string;
  /** Unambiguously parsed percent, or null when unsupported (letter, fraction, etc.). */
  percent: number | null;
  band: GradeBand | null;
  comparison: GradeComparison | null;
  /** True only when no earlier same-course entry exists at all. */
  firstGrade: boolean;
}

export interface LatestGradesSummary {
  status: GradesStatus;
  /** Latest submission within the recent window, including one with no grades. */
  submissionId: string | null;
  submittedAt: Date | null;
  /** All recent entries, newest submission first and observed order within each. */
  entries: LatestGradeEntry[];
}

/** Per-kind campus-week excuse from `scholar_week_excuses`. */
export interface WeekExcuseInput {
  minutes: number;
  description: string | null;
}

export interface EvaluateWeekInput {
  weekNumber: number;
  /** Program-local Monday 00:00. */
  weekStart: Date;
  /** Program-local Sunday 00:00 (display end). */
  weekEnd: Date;
  /** Single injected instant; all temporal decisions derive from it. */
  asOf: Date;
  shifts: ScheduledShiftInput[];
  logs: LoggedIntervalInput[];
  /** Sign-ins with no sign-out; displayed but never counted. */
  openSignIns?: OpenSignInEvidence[];
  /**
   * Program-local dates (YYYY-MM-DD) carrying open or unmatched evidence.
   * A no-show is never confirmed on these dates (task 3.3).
   */
  nonTerminalDates?: string[];
  /** Required minutes per session kind (roster `fd_required` / `ss_required`). */
  targets: Partial<Record<ShiftSessionKind, number | null>>;
  /** Excuse minutes + note per kind for this campus week (missing → 0 / null). */
  excuses?: Partial<Record<ShiftSessionKind, WeekExcuseInput>>;
  wahf: WahfEvidence;
  tutoring: TutoringEvidenceInput;
}

// ---------------------------------------------------------------------------
// Semester calendar and composed review DTO (tasks 3.1, 3.6, 3.7)
// ---------------------------------------------------------------------------

/**
 * Authorized selected-week review as the services compose it, with `Date`
 * evidence. The contract's `MenteeReview` is the wire form.
 */
export interface MenteeReview {
  asOf: string;
  mentee: MenteeReviewIdentity;
  calendar: SemesterCalendar;
  currentWeek: number | null;
  selectedWeek: number | null;
  /** Per-instructional-week summaries for the grid; error when attendance could not be read. */
  semesterGrid: SectionResult<WeekReviewSummary[]>;
  /** The selected week's shared summary consumed by the four cards. */
  selectedWeekReview: SectionResult<WeekReviewSummary | null>;
  /** This and last Eastern calendar week's grades, independent of the selected week. */
  latestGrades: SectionResult<LatestGradesSummary>;
  /** The signed-in TL's own weekday/time for this pair (independent of the selected week). */
  meetingPreference: SectionResult<MeetingPreferenceOutput | null>;
}
