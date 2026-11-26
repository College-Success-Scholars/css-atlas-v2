/**
 * @file contracts/mentees.ts
 * @module shared/contracts
 *
 * Contract for /api/auth/mentees — the signed-in mentor's roster, the weekly
 * review of one mentee, the mentor's meeting preference, and the check-in
 * form prefill. Dates are ISO strings on the wire.
 */
import { endpoint, Schema, scholarId, wholeNumber, type ContractSchema } from "../contract.js";

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export const menteeRow = Schema.Struct({
  scholar_uid: Schema.NullOr(Schema.String),
  first_name: Schema.NullOr(Schema.String),
  last_name: Schema.NullOr(Schema.String),
  /** Roster contact for follow-up drafts; null disables launch. */
  email: Schema.NullOr(Schema.String),
  /** Entering cohort year for class-year-specific tier thresholds. */
  cohort: Schema.optional(Schema.NullOr(Schema.Number)),
  fd_required: Schema.NullOr(Schema.Number),
  ss_required: Schema.NullOr(Schema.Number),
});
export type MenteeRow = typeof menteeRow.Type;

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export const shiftSessionKind = Schema.Literals(["front_desk", "study_session"]);
export type ShiftSessionKind = typeof shiftSessionKind.Type;

export const hourBand = Schema.Literals(["green", "orange", "red"]);
export type HourBand = typeof hourBand.Type;

export const gradeBand = Schema.Literals(["green", "neutral", "orange", "red"]);
export type GradeBand = typeof gradeBand.Type;

/** "unconfirmed": would be a no-show but the day has open or unmatched evidence; never a confirmed miss. */
export const shiftStatus = Schema.Literals(["attended", "short", "no_show", "active", "upcoming", "unconfirmed"]);
export type ShiftStatus = typeof shiftStatus.Type;

export const weekPhase = Schema.Literals(["current", "past", "future"]);
export type WeekPhase = typeof weekPhase.Type;

export const wahfStatus = Schema.Literals(["pending", "submitted", "missing", "unknown"]);
export type WahfStatus = typeof wahfStatus.Type;

export const tutoringStatus = Schema.Literals(["recorded", "none", "unknown"]);
export type TutoringStatus = typeof tutoringStatus.Type;

export const gradesStatus = Schema.Literals(["grades", "empty", "error"]);
export type GradesStatus = typeof gradesStatus.Type;

const sectionError = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  retriable: Schema.Boolean,
});

/** An independently recoverable section; never a successful empty after an error. */
export type SectionResult<T> =
  | { readonly ok: true; readonly data: T; readonly loadedAt: string }
  | { readonly ok: false; readonly error: typeof sectionError.Type };

function sectionResult<S extends ContractSchema>(data: S) {
  return Schema.Union([
    Schema.Struct({ ok: Schema.Literal(true), data, loadedAt: Schema.String }),
    Schema.Struct({ ok: Schema.Literal(false), error: sectionError }),
  ]);
}

export const shiftEvidence = Schema.Struct({
  sourceId: Schema.String,
  kind: shiftSessionKind,
  date: Schema.String,
  /** ISO instants. */
  scheduledStart: Schema.String,
  scheduledEnd: Schema.String,
  scheduledMinutes: Schema.Number,
  /** Matched logged interval clipped to the shift; null when nothing overlapped. */
  loggedStart: Schema.NullOr(Schema.String),
  loggedEnd: Schema.NullOr(Schema.String),
  overlapMinutes: Schema.Number,
  status: shiftStatus,
});
export type ShiftEvidence = typeof shiftEvidence.Type;

export const offShiftLogEvidence = Schema.Struct({
  kind: shiftSessionKind,
  start: Schema.String,
  end: Schema.String,
  minutes: Schema.Number,
  sourceIds: Schema.Array(Schema.String),
});
export type OffShiftLogEvidence = typeof offShiftLogEvidence.Type;

/** A sign-in with no sign-out: shown, never counted toward hours. */
export const openSignInEvidence = Schema.Struct({
  sourceId: Schema.String,
  kind: shiftSessionKind,
  start: Schema.String,
});
export type OpenSignInEvidence = typeof openSignInEvidence.Type;

export const hourWeekSummary = Schema.Struct({
  kind: shiftSessionKind,
  assignmentAvailable: Schema.Boolean,
  loggedMinutes: Schema.Number,
  /** TL excuse minutes; count toward percent and band, not tiers. */
  excuseMinutes: Schema.Number,
  excuseDescription: Schema.NullOr(Schema.String),
  targetMinutes: Schema.NullOr(Schema.Number),
  /** Unrounded percent using logged + excuse. */
  percent: Schema.NullOr(Schema.Number),
  band: Schema.NullOr(hourBand),
  displayHours: Schema.Number,
  overageMinutes: Schema.Number,
  pending: Schema.Boolean,
  noShowCount: Schema.Number,
  hasActivity: Schema.Boolean,
  shifts: Schema.Array(shiftEvidence),
  offShiftLogs: Schema.Array(offShiftLogEvidence),
  /** Optional so older payloads still render. */
  openSignIns: Schema.optional(Schema.Array(openSignInEvidence)),
});
export type HourWeekSummary = typeof hourWeekSummary.Type;

export const wahfWeekSummary = Schema.Struct({
  status: wahfStatus,
  dueAt: Schema.String,
  submittedAt: Schema.NullOr(Schema.String),
  onTime: Schema.NullOr(Schema.Boolean),
  submissionId: Schema.NullOr(Schema.String),
});
export type WahfWeekSummary = typeof wahfWeekSummary.Type;

/** One recorded tutoring attendance report; multiple courses stay on one line. */
export const tutoringSessionLine = Schema.Struct({
  reportId: Schema.String,
  courses: Schema.Array(Schema.String),
  date: Schema.NullOr(Schema.String),
  startTime: Schema.NullOr(Schema.String),
  endTime: Schema.NullOr(Schema.String),
});
export type TutoringSessionLine = typeof tutoringSessionLine.Type;

export const tutoringWeekSummary = Schema.Struct({
  status: tutoringStatus,
  recordedAttendance: Schema.Boolean,
  reports: Schema.Array(tutoringSessionLine),
});
export type TutoringWeekSummary = typeof tutoringWeekSummary.Type;

export const weekReviewSummary = Schema.Struct({
  weekNumber: Schema.Number,
  weekStart: Schema.String,
  weekEnd: Schema.String,
  phase: weekPhase,
  /** [front_desk, study_session] in stable order. */
  hours: Schema.Array(hourWeekSummary),
  wahf: wahfWeekSummary,
  tutoring: tutoringWeekSummary,
});
export type WeekReviewSummary = typeof weekReviewSummary.Type;

export const gradeComparison = Schema.Struct({
  direction: Schema.Literals(["up", "down", "equal"]),
  priorPercent: Schema.Number,
  priorAssessment: Schema.NullOr(Schema.String),
});
export type GradeComparison = typeof gradeComparison.Type;

export const latestGradeEntry = Schema.Struct({
  /** Always emitted by the evaluator; optional for legacy single-submission DTOs. */
  submissionId: Schema.optional(Schema.String),
  submittedAt: Schema.optional(Schema.String),
  course: Schema.String,
  assessment: Schema.String,
  rawGrade: Schema.String,
  percent: Schema.NullOr(Schema.Number),
  band: Schema.NullOr(gradeBand),
  comparison: Schema.NullOr(gradeComparison),
  firstGrade: Schema.Boolean,
});
export type LatestGradeEntry = typeof latestGradeEntry.Type;

export const latestGradesSummary = Schema.Struct({
  status: gradesStatus,
  /** Latest submission within the recent window, including one with no grades. */
  submissionId: Schema.NullOr(Schema.String),
  submittedAt: Schema.NullOr(Schema.String),
  /** All recent entries, newest submission first and observed order within each. */
  entries: Schema.Array(latestGradeEntry),
});
export type LatestGradesSummary = typeof latestGradesSummary.Type;

export const weekDescriptor = Schema.Struct({
  weekNumber: Schema.Number,
  /** Program-local Monday and Sunday, ISO. */
  startDate: Schema.String,
  endDate: Schema.String,
  /** The collapsed winter-break week: neutral and not selectable. */
  isBreak: Schema.Boolean,
  isCurrent: Schema.Boolean,
  isFuture: Schema.Boolean,
  isSelectable: Schema.Boolean,
});
export type WeekDescriptor = typeof weekDescriptor.Type;

export const semesterCalendar = Schema.Struct({
  semesterId: Schema.NullOr(Schema.String),
  /** Program-local semester bounds, ISO, or null when there is no active semester. */
  semesterStart: Schema.NullOr(Schema.String),
  semesterEnd: Schema.NullOr(Schema.String),
  currentWeek: Schema.NullOr(Schema.Number),
  weeks: Schema.Array(weekDescriptor),
  /** True when there is no active semester or the collection year has not started. */
  noActiveWeek: Schema.Boolean,
});
export type SemesterCalendar = typeof semesterCalendar.Type;

export const menteeReviewIdentity = Schema.Struct({
  uid: Schema.String,
  fullName: Schema.String,
  /** Roster contact for follow-up drafts; null disables launch. */
  email: Schema.NullOr(Schema.String),
  /** Entering cohort year from the roster. Optional so older responses keep the freshman-cutoff fallback. */
  cohort: Schema.optional(Schema.NullOr(Schema.Number)),
});
export type MenteeReviewIdentity = typeof menteeReviewIdentity.Type;

/** The mentor's own weekday and program-local time for one mentee. */
export const meetingPreferenceOutput = Schema.Struct({
  /** ISO weekday 1-7. */
  weekday: Schema.Number,
  /** Program-local 24-hour "HH:MM". */
  meetingTime: Schema.String,
});
export type MeetingPreferenceOutput = typeof meetingPreferenceOutput.Type;

/** The authorized weekly review of one mentee, including the caller's own meeting preference. */
export const menteeReview = Schema.Struct({
  asOf: Schema.String,
  mentee: menteeReviewIdentity,
  calendar: semesterCalendar,
  currentWeek: Schema.NullOr(Schema.Number),
  selectedWeek: Schema.NullOr(Schema.Number),
  /** Per-instructional-week summaries for the grid; an error when attendance could not be read. */
  semesterGrid: sectionResult(Schema.Array(weekReviewSummary)),
  /** The selected week's summary, shared by the four cards. */
  selectedWeekReview: sectionResult(Schema.NullOr(weekReviewSummary)),
  /** This and last Eastern calendar week's grades, independent of the selected week. */
  latestGrades: sectionResult(latestGradesSummary),
  /** The signed-in TL's own weekday and time for this pair (independent of the selected week). */
  meetingPreference: sectionResult(Schema.NullOr(meetingPreferenceOutput)),
});
export type MenteeReview = typeof menteeReview.Type;

// ---------------------------------------------------------------------------
// Meeting preference and check-in form
// ---------------------------------------------------------------------------

const WEEKDAY_MESSAGE = "must be an integer from 1 to 7";

/** The mentor's usual meeting day and time; the owner is always the caller. */
export const meetingPreferenceInput = Schema.Struct({
  weekday: Schema.Number.annotate({ message: WEEKDAY_MESSAGE }).check(
    Schema.isInt({ message: WEEKDAY_MESSAGE }),
    Schema.isBetween({ minimum: 1, maximum: 7 }, { message: WEEKDAY_MESSAGE }),
  ),
  meetingTime: Schema.Trim.check(
    Schema.isPattern(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "must be 24-hour HH:MM" }),
  ),
});
export type MeetingPreferenceInput = typeof meetingPreferenceInput.Type;

/** A click-time prefill of the mentor check-in form; it never submits. */
export const mcfPrefill = Schema.Struct({
  /** Fully encoded Google Forms URL, ready to open in a new tab. */
  url: Schema.String,
  /** Program-local current-week Monday, YYYY-MM-DD. */
  weekStart: Schema.String,
  /** ISO instant the URL was constructed. */
  generatedAt: Schema.String,
});
export type McfPrefill = typeof mcfPrefill.Type;

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

const menteeParams = Schema.Struct({ uid: scholarId });

/** The week to review. Defaults to the current week; a future week is rejected by the handler. */
const reviewQuery = Schema.Struct({
  week: Schema.optional(wholeNumber(1, "must be a positive integer")),
});

/** The signed-in mentor's assigned mentees. */
export const getMentees = endpoint({
  method: "GET",
  path: "/api/auth/mentees",
  access: "authenticated",
  output: Schema.Array(menteeRow),
});

/** The review of one of the caller's mentees. A mentee outside the caller's roster is a non-enumerating 404. */
export const getMenteeReview = endpoint({
  method: "GET",
  path: "/api/auth/mentees/:uid/review",
  access: "authenticated",
  params: menteeParams,
  query: reviewQuery,
  output: menteeReview,
});

/** Team-leader read of any scholar with a mentor assignment, for the directory detail page. */
export const getDirectoryMenteeReview = endpoint({
  method: "GET",
  path: "/api/auth/mentees/:uid/directory-review",
  access: "team_leader",
  params: menteeParams,
  query: reviewQuery,
  output: menteeReview,
});

/** Save the caller's own meeting weekday and time for one of their mentees. */
export const saveMeetingPreference = endpoint({
  method: "PUT",
  path: "/api/auth/mentees/:uid/meeting-preference",
  access: "authenticated",
  params: menteeParams,
  body: meetingPreferenceInput,
  output: meetingPreferenceOutput,
});

/** A fresh prefill of the check-in form for the current week. Never cached. */
export const getMenteeMcfPrefill = endpoint({
  method: "GET",
  path: "/api/auth/mentees/:uid/mcf-prefill",
  access: "authenticated",
  params: menteeParams,
  headers: { "Cache-Control": "private, no-store" },
  output: mcfPrefill,
});
