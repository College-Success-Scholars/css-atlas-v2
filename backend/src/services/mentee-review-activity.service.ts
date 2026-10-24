/**
 * @file mentee-review-activity.service.ts
 * @module backend/services
 *
 * Composes the authorized mentee review DTO (task 3.1). Roster/authorization
 * stays in mentee.service; this service batches bounded semester reads, maps
 * each source into evaluator evidence, and derives one shared weekly summary so
 * the grid, cards, and prefill cannot disagree.
 *
 * Each independently recoverable source is wrapped in a SectionResult (task
 * 3.7): a failed read becomes an explicit error or an "unknown" status, never a
 * confirmed zero or a fabricated completion. Grades are scoped to the latest
 * WHAF independently of the selected week.
 *
 * ## Responsibilities
 * - getMenteeReviewByMentorKey: authorize, batch reads, compose MenteeReview
 * - Pure mappers from WHAF/tutoring rows into evaluator evidence
 *
 * ## What does NOT belong here
 * - Weekly classification/totals (mentee-review-evaluator)
 * - Attendance row reading (mentee-review-attendance.adapter)
 * - HTTP request/response logic
 */
import { getMenteeByUid, getMenteesByMentorKey } from "./mentee.service.js";
import { getWhafDeadlineForWeek, getWhafFormLogsByUid } from "./form-log.service.js";
import {
  filterTutorReportsForCampusWeek,
  getTutorReportLogsByUid,
} from "./tutor-report-log.service.js";
import { getActiveSemesterRow } from "./semester.service.js";
import { getMeetingPreference } from "./mentee-meeting-preference.service.js";
import {
  fetchMenteeAttendanceEvidence,
  type AttendanceEvidence,
} from "./mentee-review-attendance.adapter.js";
import {
  buildSemesterWeeks,
  deriveLatestGrades,
  evaluateWeek,
} from "./mentee-review-evaluator.js";
import { campusWeekToDateRange, dateToCampusWeek, parseEasternDate } from "./time.service.js";
import type { WahfFormLogRow } from "../models/form-log.model.js";
import type { MenteeRow } from "../models/mentee.model.js";
import type { TutorReportLogRow } from "../models/tutor-report-log.model.js";
import type { MeetingPreferenceOutput } from "../models/meeting-preference.model.js";
import type {
  GradeEntryInput,
  GradesEvidenceInput,
  MenteeReview,
  MenteeReviewIdentity,
  SectionResult,
  SemesterCalendar,
  ShiftSessionKind,
  TutoringEvidenceInput,
  WahfEvidence,
  WeekReviewSummary,
} from "../models/mentee-review.model.js";

// ---------------------------------------------------------------------------
// Pure mappers (task 3.4, 3.5, 2.8 input)
// ---------------------------------------------------------------------------

/**
 * WHAF has no reporting-week column, so the week is attributed from
 * `created_at`. Returns the latest submission attributed to `weekNum`.
 */
export function latestWahfInWeek(
  rows: WahfFormLogRow[],
  weekNum: number
): { sourceId: string; submittedAt: Date } | null {
  let latest: WahfFormLogRow | null = null;
  for (const row of rows) {
    if (dateToCampusWeek(new Date(row.created_at)) !== weekNum) continue;
    if (!latest || new Date(row.created_at).getTime() > new Date(latest.created_at).getTime()) {
      latest = row;
    }
  }
  return latest ? { sourceId: String(latest.id), submittedAt: new Date(latest.created_at) } : null;
}

export function buildWahfEvidenceForWeek(
  rows: WahfFormLogRow[],
  weekNum: number,
  available: boolean
): WahfEvidence {
  const range = campusWeekToDateRange(weekNum);
  const dueAt = getWhafDeadlineForWeek(weekNum) ?? (range ? range.endDate : new Date(0));
  return {
    available,
    dueAt,
    submission: available ? latestWahfInWeek(rows, weekNum) : null,
  };
}

/** Flatten `assignment_grades` (course → assessment → raw string) preserving observed order. */
export function gradeEntriesFromAssignmentGrades(value: unknown): GradeEntryInput[] {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return [];
  const entries: GradeEntryInput[] = [];
  for (const [course, assessments] of Object.entries(value as Record<string, unknown>)) {
    if (assessments == null || typeof assessments !== "object" || Array.isArray(assessments)) continue;
    for (const [assessment, raw] of Object.entries(assessments as Record<string, unknown>)) {
      const rawGrade = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
      if (!rawGrade.trim()) continue;
      entries.push({ course, assessment, rawGrade });
    }
  }
  return entries;
}

export function buildGradesEvidence(rows: WahfFormLogRow[], available: boolean): GradesEvidenceInput {
  if (!available) return { available: false, submissions: [] };
  return {
    available: true,
    submissions: rows.map((row) => ({
      sourceId: String(row.id),
      submittedAt: new Date(row.created_at),
      entries: gradeEntriesFromAssignmentGrades(row.assignment_grades),
    })),
  };
}

export function buildTutoringEvidenceForWeek(
  rows: TutorReportLogRow[],
  weekNum: number,
  available: boolean
): TutoringEvidenceInput {
  if (!available) return { available: false, reports: [] };
  return {
    available: true,
    reports: filterTutorReportsForCampusWeek(rows, weekNum).map((row) => ({
      reportId: String(row.id),
      date: row.date ? row.date.slice(0, 10) : null,
      startTime: row.start_time ?? null,
      endTime: row.end_time ?? null,
      courses: Array.isArray(row.courses) ? row.courses : [],
    })),
  };
}

// ---------------------------------------------------------------------------
// Composition (tasks 3.1, 3.6, 3.7)
// ---------------------------------------------------------------------------

export function buildSemesterCalendar(params: {
  semester: { id: number; start_date: string; end_date: string } | null;
  asOf: Date;
}): SemesterCalendar {
  const { semester, asOf } = params;
  const currentWeek = dateToCampusWeek(asOf);
  if (!semester) {
    return {
      semesterId: null,
      semesterStart: null,
      semesterEnd: null,
      currentWeek,
      weeks: [],
      noActiveWeek: true,
    };
  }
  const semesterStart = parseEasternDate(semester.start_date.slice(0, 10));
  const semesterEnd = parseEasternDate(semester.end_date.slice(0, 10));
  const weeks = buildSemesterWeeks({ semesterStart, semesterEnd, asOf, currentWeek });
  return {
    semesterId: String(semester.id),
    semesterStart: semesterStart.toISOString(),
    semesterEnd: semesterEnd.toISOString(),
    currentWeek,
    weeks,
    noActiveWeek: weeks.length === 0,
  };
}

export interface ComposeMenteeReviewInput {
  asOf: Date;
  mentee: MenteeReviewIdentity;
  calendar: SemesterCalendar;
  selectedWeek: number | null;
  /** Required minutes per session kind, straight from the roster. */
  targets: Partial<Record<ShiftSessionKind, number | null>>;
  attendance: SectionResult<AttendanceEvidence>;
  wahf: SectionResult<WahfFormLogRow[]>;
  tutoring: SectionResult<TutorReportLogRow[]>;
  meetingPreference: SectionResult<MeetingPreferenceOutput | null>;
}

function evaluateInstructionalWeeks(input: ComposeMenteeReviewInput): WeekReviewSummary[] {
  const { asOf, calendar, targets, attendance, wahf, tutoring } = input;
  if (!attendance.ok) return [];

  const summaries: WeekReviewSummary[] = [];
  for (const week of calendar.weeks) {
    // Break weeks are neutral and left to the grid; future weeks stay empty.
    if (week.isBreak || week.isFuture) continue;
    const range = campusWeekToDateRange(week.weekNumber);
    if (!range) continue;
    summaries.push(
      evaluateWeek({
        weekNumber: week.weekNumber,
        weekStart: range.startDate,
        weekEnd: range.endDate,
        asOf,
        shifts: attendance.data.shifts,
        logs: attendance.data.logs,
        nonTerminalDates: attendance.data.nonTerminalDates,
        targets,
        wahf: buildWahfEvidenceForWeek(wahf.ok ? wahf.data : [], week.weekNumber, wahf.ok),
        tutoring: buildTutoringEvidenceForWeek(
          tutoring.ok ? tutoring.data : [],
          week.weekNumber,
          tutoring.ok
        ),
      })
    );
  }
  return summaries;
}

export function composeMenteeReview(input: ComposeMenteeReviewInput): MenteeReview {
  const { asOf, mentee, calendar, selectedWeek, attendance } = input;

  const weeks = evaluateInstructionalWeeks(input);
  const loadedAt = new Date().toISOString();

  const semesterGrid: SectionResult<WeekReviewSummary[]> = attendance.ok
    ? { ok: true, data: weeks, loadedAt }
    : { ok: false, error: attendance.error };

  const selectedSummary = weeks.find((w) => w.weekNumber === selectedWeek) ?? null;
  const selectedWeekReview: SectionResult<WeekReviewSummary | null> = attendance.ok
    ? { ok: true, data: selectedSummary, loadedAt }
    : { ok: false, error: attendance.error };

  const latestGrades: SectionResult<ReturnType<typeof deriveLatestGrades>> = input.wahf.ok
    ? {
        ok: true,
        data: deriveLatestGrades(buildGradesEvidence(input.wahf.data, true)),
        loadedAt,
      }
    : { ok: false, error: input.wahf.error };

  return {
    asOf: asOf.toISOString(),
    mentee,
    calendar,
    currentWeek: calendar.currentWeek,
    selectedWeek,
    semesterGrid,
    selectedWeekReview,
    latestGrades,
    meetingPreference: input.meetingPreference,
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function toSection<T>(label: string, run: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    const data = await run();
    return { ok: true, data, loadedAt: new Date().toISOString() };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: `mentee_review_${label}_failed`,
        message: error instanceof Error ? error.message : `Failed to read ${label}`,
        retriable: true,
      },
    };
  }
}

/** Shared review composition once the mentee and viewer-specific preference are known. */
async function composeReviewForMentee(params: {
  mentee: MenteeRow;
  menteeUid: string;
  selectedWeek: number | null;
  asOf: Date;
  meetingPreference: SectionResult<MeetingPreferenceOutput | null>;
}): Promise<MenteeReview> {
  const { mentee, menteeUid, asOf, meetingPreference } = params;

  const semester = await getActiveSemesterRow();
  const calendar = buildSemesterCalendar({ semester, asOf });

  const identity: MenteeReviewIdentity = {
    uid: menteeUid,
    fullName: [mentee.first_name, mentee.last_name].filter(Boolean).join(" ").trim(),
    email: mentee.email ?? null,
  };
  const targets: Partial<Record<ShiftSessionKind, number | null>> = {
    front_desk: mentee.fd_required,
    study_session: mentee.ss_required,
  };
  const selectedWeek = params.selectedWeek ?? calendar.currentWeek;

  if (calendar.noActiveWeek) {
    return composeMenteeReview({
      asOf,
      mentee: identity,
      calendar,
      selectedWeek,
      targets,
      attendance: { ok: true, data: { shifts: [], logs: [], nonTerminalDates: [] }, loadedAt: asOf.toISOString() },
      wahf: { ok: true, data: [], loadedAt: asOf.toISOString() },
      tutoring: { ok: true, data: [], loadedAt: asOf.toISOString() },
      meetingPreference,
    });
  }

  const [attendance, wahf, tutoring] = await Promise.all([
    toSection("attendance", () =>
      fetchMenteeAttendanceEvidence({
        scholarUid: menteeUid,
        semesterId: calendar.semesterId,
        semesterStart: calendar.semesterStart ? new Date(calendar.semesterStart) : null,
        semesterEnd: calendar.semesterEnd ? new Date(calendar.semesterEnd) : null,
        asOf,
      })
    ),
    toSection("wahf", () => getWhafFormLogsByUid(menteeUid)),
    toSection("tutoring", () => getTutorReportLogsByUid(menteeUid)),
  ]);

  return composeMenteeReview({
    asOf,
    mentee: identity,
    calendar,
    selectedWeek,
    targets,
    attendance,
    wahf,
    tutoring,
    meetingPreference,
  });
}

/**
 * Authorized review for one mentee. Returns null when the mentee is not among
 * the caller's assignments (RLS-scoped roster) so the controller can 404 without
 * enumerating records.
 */
export async function getMenteeReviewByMentorKey(params: {
  mentorKey: string;
  menteeUid: string;
  selectedWeek: number | null;
  asOf?: Date;
}): Promise<MenteeReview | null> {
  const { mentorKey, menteeUid } = params;
  const asOf = params.asOf ?? new Date();

  const mentees = await getMenteesByMentorKey(mentorKey);
  const mentee = mentees.find((m) => m.scholar_uid === menteeUid);
  if (!mentee) return null;

  // The caller's own preference is part of the review response (no standalone
  // read endpoint); a read failure is an explicit section error, not "not set".
  const meetingPreference = await toSection("meeting_preference", () =>
    getMeetingPreference(mentorKey, menteeUid)
  );

  return composeReviewForMentee({ mentee, menteeUid, selectedWeek: params.selectedWeek, asOf, meetingPreference });
}

/**
 * Team-leader review for any scholar with a `mentor_mentee` assignment, used by
 * the directory detail page. The viewer is not necessarily the mentor, so no
 * meeting preference is read; the field is null and the UI omits its editor.
 */
export async function getMenteeReviewByUid(params: {
  menteeUid: string;
  selectedWeek: number | null;
  asOf?: Date;
}): Promise<MenteeReview | null> {
  const asOf = params.asOf ?? new Date();
  const mentee = await getMenteeByUid(params.menteeUid);
  if (!mentee) return null;

  return composeReviewForMentee({
    mentee,
    menteeUid: params.menteeUid,
    selectedWeek: params.selectedWeek,
    asOf,
    meetingPreference: { ok: true, data: null, loadedAt: asOf.toISOString() },
  });
}
