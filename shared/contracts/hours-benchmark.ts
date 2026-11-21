/**
 * @file contracts/hours-benchmark.ts
 * @module shared/contracts
 *
 * Contract for /api/hours-benchmark — the Hours Benchmark Report (developer
 * only): front desk and study session completion per scholar and week, and
 * the same report as a PDF.
 */
import { download, endpoint, Schema } from "../contract.js";

export const hoursBenchmarkArea = Schema.Literals(["front_desk", "study_session"]);
export type HoursBenchmarkArea = typeof hoursBenchmarkArea.Type;

/** Which heatmap the PDF prints: scholars at or below 50% ("low") or every eligible scholar ("all"). */
export const hoursBenchmarkHeatmapScope = Schema.Literals(["low", "all"]);
export type HoursBenchmarkHeatmapScope = typeof hoursBenchmarkHeatmapScope.Type;

export const hoursBenchmarkScoredWeeks = Schema.Struct({
  fromWeek: Schema.Number,
  throughWeek: Schema.Number,
});
export type HoursBenchmarkScoredWeeks = typeof hoursBenchmarkScoredWeeks.Type;

export const hoursBenchmarkCell = Schema.Struct({
  weekNum: Schema.Number,
  /** Rounded completion %. Null when the scholar is not scored for that kind/week. */
  completionPercent: Schema.NullOr(Schema.Number),
  excuseApplied: Schema.Boolean,
});
export type HoursBenchmarkCell = typeof hoursBenchmarkCell.Type;

export const hoursBenchmarkScholarRow = Schema.Struct({
  scholarId: Schema.String,
  scholarName: Schema.String,
  isSophomore: Schema.Boolean,
  classYear: Schema.NullOr(Schema.Literals(["Freshman", "Sophomore"])),
  teamLeader: Schema.String,
  /** Count of (week × area) events at ≤50%. */
  atOrBelow50Count: Schema.Number,
  frontDeskByWeek: Schema.Array(hoursBenchmarkCell),
  studySessionByWeek: Schema.Array(hoursBenchmarkCell),
});
export type HoursBenchmarkScholarRow = typeof hoursBenchmarkScholarRow.Type;

export const hoursBenchmarkTeamLeaderRow = Schema.Struct({
  teamLeader: Schema.String,
  atOrBelow50Events: Schema.Number,
  studentCount: Schema.Number,
});
export type HoursBenchmarkTeamLeaderRow = typeof hoursBenchmarkTeamLeaderRow.Type;

export const hoursBenchmarkLowEvent = Schema.Struct({
  weekNum: Schema.Number,
  weekDateLabel: Schema.String,
  area: hoursBenchmarkArea,
  areaLabel: Schema.String,
  scholarName: Schema.String,
  classYear: Schema.String,
  teamLeader: Schema.String,
  completionPercent: Schema.Number,
  excuseApplied: Schema.Boolean,
});
export type HoursBenchmarkLowEvent = typeof hoursBenchmarkLowEvent.Type;

export const hoursBenchmarkSummary = Schema.Struct({
  studentsAtOrBelow50AtLeastOnce: Schema.Number,
  atOrBelow50Events: Schema.Number,
  zeroPercentEvents: Schema.Number,
  studentsMissed80AtLeastOnce: Schema.Number,
});
export type HoursBenchmarkSummary = typeof hoursBenchmarkSummary.Type;

export const hoursBenchmarkTutoringSession = Schema.Struct({
  id: Schema.Number,
  scholarId: Schema.String,
  scholarName: Schema.String,
  tutorName: Schema.String,
  dayOfWeek: Schema.String,
  /** Short Eastern date for multi-week disambiguation (e.g. "Sep 8"). */
  dateLabel: Schema.String,
  /** YYYY-MM-DD (Eastern) for stable within-group date sorting. */
  dateKey: Schema.String,
});
export type HoursBenchmarkTutoringSession = typeof hoursBenchmarkTutoringSession.Type;

export const hoursBenchmarkTutoringGroup = Schema.Struct({
  key: Schema.String,
  title: Schema.String,
  sessions: Schema.Array(hoursBenchmarkTutoringSession),
});
export type HoursBenchmarkTutoringGroup = typeof hoursBenchmarkTutoringGroup.Type;

export const hoursBenchmarkReport = Schema.Struct({
  currentCampusWeek: Schema.Number,
  scoredWeeks: Schema.NullOr(hoursBenchmarkScoredWeeks),
  weekNumbers: Schema.Array(Schema.Number),
  weekRangeLabel: Schema.String,
  dateRangeLabel: Schema.String,
  preparedAtLabel: Schema.String,
  printedAtSlug: Schema.String,
  summary: hoursBenchmarkSummary,
  /** Scholars with at least one ≤50% week×area event (default PDF / on-screen heatmap). */
  heatmapScholars: Schema.Array(hoursBenchmarkScholarRow),
  /** Every enrolled hour-eligible scholar for the scored weeks (all-scholars PDF). */
  allHeatmapScholars: Schema.Array(hoursBenchmarkScholarRow),
  byTeamLeader: Schema.Array(hoursBenchmarkTeamLeaderRow),
  lowEvents: Schema.Array(hoursBenchmarkLowEvent),
  tutoringByScholar: Schema.Array(hoursBenchmarkTutoringGroup),
  tutoringByTutor: Schema.Array(hoursBenchmarkTutoringGroup),
  tutoringByDay: Schema.Array(hoursBenchmarkTutoringGroup),
});
export type HoursBenchmarkReport = typeof hoursBenchmarkReport.Type;

/** Build the report. Never cached. */
export const getReport = endpoint({
  method: "GET",
  path: "/api/hours-benchmark",
  access: "developer",
  headers: { "Cache-Control": "no-store, max-age=0" },
  output: hoursBenchmarkReport,
});

/** The report as a PDF. Any `scope` other than "all" prints the ≤50% heatmap. */
export const getPdf = download({
  method: "GET",
  path: "/api/hours-benchmark/pdf",
  access: "developer",
  headers: { "Cache-Control": "no-store, max-age=0" },
  query: Schema.Struct({ scope: Schema.optional(Schema.String) }),
});
