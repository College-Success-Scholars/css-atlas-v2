/**
 * @file contracts/memo.ts
 * @module shared/contracts
 *
 * Contract for /api/memo — the Weekly Memo for one Campus Week, assembled
 * once on the backend. The dashboard renders `weeklyMemo` as-is; the PDF is
 * rendered from the same backend data.
 */
import { campusWeekNumber, download, endpoint, Schema } from "../contract.js";

const optionalNullable = <S extends Schema.Top>(schema: S) => Schema.optional(Schema.NullOr(schema));

/** Status a team leader's form shows on Team leader performance. */
export const memoFormStatus = Schema.Literals(["submitted", "on-time", "missing", "late", "incomplete", "check-mentees"]);
export type MemoFormStatus = typeof memoFormStatus.Type;

export const weeklyKpiCard = Schema.Struct({
  title: Schema.String,
  primaryValue: Schema.String,
  secondaryText: Schema.String,
  trendText: Schema.String,
  /** Combined 0–100 fill for hours cards. */
  pct: Schema.optional(Schema.Number),
  subStats: Schema.Array(
    Schema.Struct({
      label: Schema.String,
      value: Schema.String,
      /** 0–100 fill for the class-year track. Absent when the card has no slider. */
      pct: Schema.optional(Schema.Number),
    }),
  ),
});
export type WeeklyKpiCard = typeof weeklyKpiCard.Type;
export type WeeklyKpiSubStat = WeeklyKpiCard["subStats"][number];

export const teamLeaderPerformanceRow = Schema.Struct({
  leaderName: Schema.String,
  mcf: memoFormStatus,
  wpl: memoFormStatus,
  wahf: memoFormStatus,
  menteesOk: Schema.Literals(["yes", "check"]),
  /** True when roster mentee_count is 0 or less (including the -1 no-relationship sentinel). */
  hasNoMentee: Schema.Boolean,
});
export type TeamLeaderPerformanceRow = typeof teamLeaderPerformanceRow.Type;

/** Hours issue: glance is the area name; detail is a completion meter. */
const hoursIssue = Schema.Struct({
  kind: Schema.Literals(["front-desk", "study-session"]),
  glance: Schema.String,
  pct: Schema.Number,
  requiredMinutes: Schema.NullOr(Schema.Number),
  insideMinutes: Schema.Number,
  outsideMinutes: Schema.Number,
});
/** Grade issue: glance is the assignment title; detail is the percent. */
const gradeIssue = Schema.Struct({ kind: Schema.Literal("grade"), glance: Schema.String, pct: Schema.Number });
/** WAHF issue: glance is "WAHF"; detail is submitted-at or an empty time state. */
const wahfIssue = Schema.Struct({
  kind: Schema.Literal("wahf"),
  glance: Schema.String,
  status: Schema.Literals(["late", "missing"]),
  submittedAtLabel: Schema.NullOr(Schema.String),
});
export const scholarFollowUpIssue = Schema.Union([hoursIssue, gradeIssue, wahfIssue]);
export type ScholarFollowUpIssue = typeof scholarFollowUpIssue.Type;
export type ScholarFollowUpHoursIssue = typeof hoursIssue.Type;
export type ScholarFollowUpGradeIssue = typeof gradeIssue.Type;
export type ScholarFollowUpWahfIssue = typeof wahfIssue.Type;
export type ScholarFollowUpIssueKind = ScholarFollowUpIssue["kind"];

/** One Scholar follow-up row. Healthy hours are omitted from `issues`. */
export const scholarFollowUpRow = Schema.Struct({
  scholarId: optionalNullable(Schema.String),
  isMentee: Schema.optional(Schema.Boolean),
  scholarName: Schema.String,
  scholarYear: Schema.String,
  cohort: optionalNullable(Schema.Number),
  teamLeader: Schema.String,
  flags: Schema.Array(Schema.String),
  issues: Schema.Array(scholarFollowUpIssue),
  frontDeskPct: Schema.Number,
  studySessionPct: Schema.Number,
  fdRequired: Schema.NullOr(Schema.Number),
  ssRequired: Schema.NullOr(Schema.Number),
});
export type ScholarFollowUpRow = typeof scholarFollowUpRow.Type;

export const memoGradeEntry = Schema.Struct({
  scholarName: Schema.String,
  scholarId: optionalNullable(Schema.String),
  cohort: optionalNullable(Schema.Number),
  isMentee: Schema.optional(Schema.Boolean),
  course: Schema.String,
  assessment: Schema.String,
  grade: Schema.String,
  percent: Schema.Number,
});
export type MemoGradeEntry = typeof memoGradeEntry.Type;

export const recognitionBoardBandId = Schema.Literals(["high", "mid", "low"]);
export type RecognitionBoardBandId = typeof recognitionBoardBandId.Type;

/** The WAHF assignment-grade census in high (90–100%), mid (70–89%) and low (below 70%) bands. */
export const recognitionBoard = Schema.Struct({
  badgeText: Schema.String,
  rightLabel: Schema.String,
  bands: Schema.Array(Schema.Struct({ id: recognitionBoardBandId, label: Schema.String, entries: Schema.Array(memoGradeEntry) })),
});
export type RecognitionBoardSectionData = typeof recognitionBoard.Type;
export type RecognitionBoardBand = RecognitionBoardSectionData["bands"][number];

export const attendanceDetailRow = Schema.Struct({
  scholarId: optionalNullable(Schema.String),
  isMentee: Schema.optional(Schema.Boolean),
  scholarName: Schema.String,
  scholarYear: Schema.String,
  cohort: optionalNullable(Schema.Number),
  completedMinutes: Schema.Number,
  excuseMinutes: Schema.Number,
  requiredMinutes: Schema.Number,
  completionPct: Schema.Number,
});
export type AttendanceDetailRow = typeof attendanceDetailRow.Type;

export const wahfCensusSummary = Schema.Struct({ onTime: Schema.Number, late: Schema.Number, missing: Schema.Number });
export type WahfCensusSummary = typeof wahfCensusSummary.Type;

/** Attendance detail: minutes-based Front desk / Study session completion, plus overall WAHF counts. */
export const fullAttendanceDetail = Schema.Struct({
  rightLabel: Schema.String,
  wahfCensus: wahfCensusSummary,
  tabs: Schema.Array(
    Schema.Struct({
      id: Schema.Literals(["front-desk", "study-sessions"]),
      label: Schema.String,
      rows: Schema.Array(attendanceDetailRow),
    }),
  ),
});
export type FullAttendanceDetailSectionData = typeof fullAttendanceDetail.Type;
export type FullAttendanceDetailTab = FullAttendanceDetailSectionData["tabs"][number];

export const tutoringLogRow = Schema.Struct({
  id: Schema.Number,
  scholarId: optionalNullable(Schema.String),
  isMentee: Schema.optional(Schema.Boolean),
  scholarName: Schema.String,
  cohort: optionalNullable(Schema.Number),
  dayOfWeek: Schema.String,
  tutorName: Schema.String,
  courses: Schema.Array(Schema.String),
  startTime: Schema.String,
  endTime: Schema.String,
});
export type TutoringLogRow = typeof tutoringLogRow.Type;

export const tutoringLog = Schema.Struct({
  badgeText: Schema.String,
  rightLabel: Schema.String,
  tabs: Schema.Array(
    Schema.Struct({
      id: Schema.Literals(["sessions", "empty-sessions"]),
      label: Schema.String,
      rows: Schema.Array(tutoringLogRow),
    }),
  ),
});
export type TutoringLogSectionData = typeof tutoringLog.Type;
export type TutoringLogTab = TutoringLogSectionData["tabs"][number];

/** Which campus weeks the week picker offers, and the neighbours of the selected one. */
export const weekNavigation = Schema.Struct({
  availableWeeks: Schema.Array(Schema.Number),
  prevWeek: Schema.NullOr(Schema.Number),
  nextWeek: Schema.NullOr(Schema.Number),
  currentCampusWeek: Schema.NullOr(Schema.Number),
});
export type WeekNavigation = typeof weekNavigation.Type;

/** The finished Weekly Memo for one Campus Week. */
export const weeklyMemo = Schema.Struct({
  yearNotStarted: Schema.Literal(false),
  weekNumber: Schema.Number,
  weekStartLabel: Schema.String,
  weekEndLabel: Schema.String,
  navigation: weekNavigation,
  kpis: Schema.Array(weeklyKpiCard),
  teamLeaderRows: Schema.Array(teamLeaderPerformanceRow),
  scholarRows: Schema.Array(scholarFollowUpRow),
  tutoringLog,
  recognitionBoard,
  fullAttendanceDetail,
});
export type WeeklyMemo = typeof weeklyMemo.Type;

/** Before the first campus week of the year there is no memo to show. */
export const yearNotStarted = Schema.Struct({ yearNotStarted: Schema.Literal(true) });

/** The Weekly Memo for `week_num`, or for the current campus week when omitted. */
export const getWeeklyMemo = endpoint({
  method: "GET",
  path: "/api/memo",
  access: "team_leader",
  query: Schema.Struct({ week_num: Schema.optional(campusWeekNumber) }),
  output: Schema.Union([weeklyMemo, yearNotStarted]),
});

/** The Weekly Memo printout as a PDF; 503 if rendering fails. */
export const getPdf = download({
  method: "GET",
  path: "/api/memo/pdf",
  access: "team_leader",
  query: Schema.Struct({ week_num: Schema.optional(campusWeekNumber) }),
  headers: { "Cache-Control": "no-store, max-age=0" },
});
