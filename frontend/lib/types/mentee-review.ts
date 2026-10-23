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
  assignmentAvailable: boolean;
  loggedMinutes: number;
  targetMinutes: number | null;
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
  submissionId: string | null;
  submittedAt: string | null;
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
