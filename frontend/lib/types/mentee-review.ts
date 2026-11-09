/**
 * API response shapes for the mentee review endpoints (not Postgres mirrors).
 * Mirrors backend/src/models/mentee-review.model.ts, but `Date` fields are the
 * ISO strings that actually cross the wire.
 */

export type ShiftSessionKind = "front_desk" | "study_session";

export type HourBand = "green" | "orange" | "red";
export type GradeBand = "green" | "neutral" | "orange" | "red";
export type ShiftStatus =
  | "attended"
  | "short"
  | "no_show"
  | "active"
  | "upcoming"
  /** Would be a no-show but the day has open/unmatched evidence; never a confirmed miss. */
  | "unconfirmed";
export type WeekPhase = "current" | "past" | "future";
/** Display-only completion tier earned independently by an hourly requirement. */
export type WeekTier = "rare" | "epic" | "legendary";
export type WahfStatus = "pending" | "submitted" | "missing" | "unknown";
export type TutoringStatus = "recorded" | "none" | "unknown";
export type GradesStatus = "grades" | "empty" | "error";

/** Independently recoverable section; never a successful empty after an error. */
export type SectionResult<T> =
  | { ok: true; data: T; loadedAt: string }
  | { ok: false; error: { code: string; message: string; retriable: boolean } };

export interface ShiftEvidence {
  sourceId: string;
  kind: ShiftSessionKind;
  date: string;
  /** ISO instants. */
  scheduledStart: string;
  scheduledEnd: string;
  scheduledMinutes: number;
  /** Matched logged interval clipped to the shift; null when nothing overlapped. */
  loggedStart: string | null;
  loggedEnd: string | null;
  overlapMinutes: number;
  status: ShiftStatus;
}

export interface OffShiftLogEvidence {
  kind: ShiftSessionKind;
  start: string;
  end: string;
  minutes: number;
  sourceIds: string[];
}

export interface HourWeekSummary {
  kind: ShiftSessionKind;
  /** Derived from this requirement's logged minutes by `applyWeekTiers`; not an API field. */
  tier?: WeekTier | null;
  assignmentAvailable: boolean;
  loggedMinutes: number;
  /** TL excuse minutes; count toward percent/band, not tiers. */
  excuseMinutes: number;
  excuseDescription: string | null;
  targetMinutes: number | null;
  /** Unrounded percent using logged + excuse. */
  percent: number | null;
  band: HourBand | null;
  displayHours: number;
  overageMinutes: number;
  pending: boolean;
  noShowCount: number;
  hasActivity: boolean;
  shifts: ShiftEvidence[];
  offShiftLogs: OffShiftLogEvidence[];
}

export interface WahfWeekSummary {
  status: WahfStatus;
  dueAt: string;
  submittedAt: string | null;
  onTime: boolean | null;
  submissionId: string | null;
}

/** One recorded tutoring attendance report; multiple courses stay on one line. */
export interface TutoringSessionLine {
  reportId: string;
  courses: string[];
  date: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface TutoringWeekSummary {
  status: TutoringStatus;
  recordedAttendance: boolean;
  reports: TutoringSessionLine[];
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

export interface GradeComparison {
  direction: "up" | "down" | "equal";
  priorPercent: number;
  priorAssessment: string | null;
}

export interface LatestGradeEntry {
  /** Always emitted by the evaluator; optional for legacy single-submission DTOs. */
  submissionId?: string;
  submittedAt?: string;
  course: string;
  assessment: string;
  rawGrade: string;
  percent: number | null;
  band: GradeBand | null;
  comparison: GradeComparison | null;
  firstGrade: boolean;
}

export interface LatestGradesSummary {
  status: GradesStatus;
  /** Latest submission within the recent window, including one with no grades. */
  submissionId: string | null;
  submittedAt: string | null;
  /** All recent entries, newest submission first and observed order within each. */
  entries: LatestGradeEntry[];
}

export interface WeekDescriptor {
  weekNumber: number;
  /** Program-local Monday/Sunday, ISO. */
  startDate: string;
  endDate: string;
  isBreak: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  isSelectable: boolean;
}

export interface SemesterCalendar {
  semesterId: string | null;
  semesterStart: string | null;
  semesterEnd: string | null;
  currentWeek: number | null;
  weeks: WeekDescriptor[];
  noActiveWeek: boolean;
}

export interface MenteeReviewIdentity {
  uid: string;
  fullName: string;
  /** Roster contact for follow-up drafts; null disables launch. */
  email: string | null;
  /**
   * Entering cohort year from the roster. Optional for older API responses;
   * those retain the freshman-cutoff fallback.
   */
  cohort?: number | null;
}

/** Output DTO for the meeting preference (normalized HH:MM). */
export interface MeetingPreferenceOutput {
  weekday: number;
  meetingTime: string;
}

/** Input DTO for saving the meeting preference (no owner field). */
export interface MeetingPreferenceInput {
  weekday: number;
  meetingTime: string;
}

/** Result of GET /api/auth/mentees/:uid/mcf-prefill (constructed at click time; never submits). */
export interface McfPrefill {
  /** Fully encoded Google Forms URL, ready to open in a new tab. */
  url: string;
  /** Program-local current-week Monday, YYYY-MM-DD. */
  weekStart: string;
  /** ISO instant the URL was constructed. */
  generatedAt: string;
}

export interface MenteeReview {
  asOf: string;
  mentee: MenteeReviewIdentity;
  calendar: SemesterCalendar;
  currentWeek: number | null;
  selectedWeek: number | null;
  semesterGrid: SectionResult<WeekReviewSummary[]>;
  selectedWeekReview: SectionResult<WeekReviewSummary | null>;
  latestGrades: SectionResult<LatestGradesSummary>;
  meetingPreference: SectionResult<MeetingPreferenceOutput | null>;
}

/** Switcher option from GET /api/auth/mentees (no compliance data). */
export interface MenteeOption {
  uid: string;
  fullName: string;
  email: string | null;
}

export interface MenteeReviewClientProps {
  mentees: MenteeOption[];
  /** Null when the caller has no assigned mentees. */
  review: MenteeReview | null;
  /** Selected campus week from the URL `week` param. */
  selectedWeek: number | null;
  /**
   * Directory detail view path. When present, hides the mentee switcher and
   * MCF bar and keeps week navigation on that path.
   */
  detailPath?: string;
}
