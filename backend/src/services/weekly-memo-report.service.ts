import { completionPct, effectiveMinutes } from "./attendance-week.service.js";
import { campusWeekToDateRange, freshmanCohortYear, sophomoreCohortYear } from "./time.service.js";
import { getMemoPageData } from "./memo-page.service.js";
import { toPrintTrafficSeries } from "./weekly-memo-pdf-charts.js";

export type MemoPageData = Awaited<ReturnType<typeof getMemoPageData>>;

export type WeeklyMemoRosterRow = {
  scholarName: string;
  cohort: number | null;
  completedMinutes: number;
  requiredMinutes: number;
  completionPercent: number;
};

export const WEEKLY_MEMO_ATTENTION_THRESHOLD_PERCENT = 60;
/** Program Snapshot FD/SS bars count a scholar complete at this percent or higher. */
export const WEEKLY_MEMO_SNAPSHOT_COMPLETE_PERCENT = 80;

type WeeklyMemoGrade = {
  scholarName: string;
  course: string;
  assessment: string;
  grade: string;
  percent: number;
};

export type WeeklyMemoReport = {
  weekNumber: number;
  weekLabel: string;
  dateRange: string;
  printedAtLabel: string;
  printedAtSlug: string;
  attentionThresholdPercent: number;
  snapshotCompletePercent: number;
  overview: {
    traffic: {
      thisWeek: number;
      thisSemester: number;
      weekly: Array<{ week: number; visits: number }>;
      sessions: Array<{ entryAt: string; exitAt: string }>;
    };
    frontDesk: Array<{ cohort: number; completed: number; total: number }>;
    studySession: Array<{ cohort: number; completed: number; total: number }>;
    tutoring: { sessionsLogged: number; noShowCount: number };
    submissions: {
      wahf: { onTime: number; late: number; missing: number };
      tlWahf: { onTime: number; late: number; missing: number };
      wpl: { onTime: number; late: number; missing: number };
      mcf: { onTime: number; late: number; missing: number };
    };
  };
  studyRoster: WeeklyMemoRosterRow[];
  frontDeskRoster: WeeklyMemoRosterRow[];
  attention: {
    wahf: Array<{ scholarName: string; cohort: number | null; status: "late" | "missing" }>;
    tlSubmissions: Array<{ leaderName: string; issues: string[] }>;
    studyCompletion: WeeklyMemoRosterRow[];
    frontDeskCompletion: WeeklyMemoRosterRow[];
    tutoringNoShows: MemoPageData["tutorReports"];
    lowGrades: WeeklyMemoGrade[];
  };
  tutoringByDay: Array<{ day: string; sessions: MemoPageData["tutorReports"] }>;
  recognition: {
    high: WeeklyMemoGrade[];
    mid: WeeklyMemoGrade[];
  };
};

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((entry) => entry.type === type)?.value ?? "";
}

/** Eastern printed-at stamp shared by the PDF filename and the printout. */
export function weeklyMemoPrintedAt(now = new Date()) {
  const labelParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now);
  const label = `${part(labelParts, "month")} ${part(labelParts, "day")}, ${part(labelParts, "year")}, ${part(labelParts, "hour")}:${part(labelParts, "minute")} ${part(labelParts, "dayPeriod")} ET`;
  const slugParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const slug = `${part(slugParts, "year")}-${part(slugParts, "month")}-${part(slugParts, "day")}-${part(slugParts, "hour")}${part(slugParts, "minute")}`;
  return { label, slug };
}

export function weeklyMemoPdfFilename(weekNumber: number, printedAtSlug: string) {
  return `weekly-memo-week-${weekNumber}-${printedAtSlug}.pdf`;
}

/** Same hours math as the weekly memo page: logged + excuse, integer %, capped at 100. */
function rosterCompletionPercent(completedMinutes: number, requiredMinutes: number): number {
  return Math.max(0, Math.min(100, completionPct(completedMinutes, requiredMinutes) ?? 0));
}

function toRosterRow(
  scholar: MemoPageData["scholars"][number],
  type: "study" | "frontDesk"
): WeeklyMemoRosterRow | null {
  const requiredMinutes = type === "study" ? scholar.ssRequired : scholar.fdRequired;
  if (requiredMinutes == null || requiredMinutes <= 0) return null;
  const loggedMinutes = type === "study" ? scholar.ssTotal : scholar.fdTotal;
  const excuseMinutes = type === "study" ? scholar.ssExcuseMin : scholar.fdExcuseMin;
  const completedMinutes = effectiveMinutes(loggedMinutes, excuseMinutes);
  return {
    scholarName: scholar.scholarName,
    cohort: scholar.cohort,
    completedMinutes,
    requiredMinutes,
    completionPercent: rosterCompletionPercent(completedMinutes, requiredMinutes),
  };
}

function compareRosterCohort(left: number | null, right: number | null): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return right - left;
}

/** Newer cohort first, then completed minutes descending, then name. */
export function sortRosterByMinutesDesc(rows: WeeklyMemoRosterRow[]): WeeklyMemoRosterRow[] {
  return [...rows].sort((a, b) => {
    const cohort = compareRosterCohort(a.cohort, b.cohort);
    if (cohort !== 0) return cohort;
    if (b.completedMinutes !== a.completedMinutes) return b.completedMinutes - a.completedMinutes;
    return a.scholarName.localeCompare(b.scholarName);
  });
}

export function groupRosterByCohort(rows: WeeklyMemoRosterRow[]): Array<{ cohort: number | null; rows: WeeklyMemoRosterRow[] }> {
  const groups: Array<{ cohort: number | null; rows: WeeklyMemoRosterRow[] }> = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.cohort === row.cohort) last.rows.push(row);
    else groups.push({ cohort: row.cohort, rows: [row] });
  }
  return groups;
}

function snapshotHoursOverview(
  scholars: MemoPageData["scholars"],
  type: "study" | "frontDesk",
  cohorts: number[],
): Array<{ cohort: number; completed: number; total: number }> {
  return cohorts.map((cohort) => {
    const inCohort = scholars.filter((scholar) => scholar.cohort === cohort);
    const completed = inCohort.filter((scholar) => {
      const row = toRosterRow(scholar, type);
      return row != null && row.completionPercent >= WEEKLY_MEMO_SNAPSHOT_COMPLETE_PERCENT;
    }).length;
    return { cohort, completed, total: inCohort.length };
  });
}

function toSubmissionOverview(completed: number, required: number, late: number) {
  return {
    onTime: Math.max(0, Math.min(completed, required) - late),
    late,
    missing: Math.max(0, required - completed),
  };
}

function toScholarWahfOverview(scholars: MemoPageData["scholars"]) {
  return {
    onTime: scholars.filter((scholar) => scholar.wahfStatus === "on-time").length,
    late: scholars.filter((scholar) => scholar.wahfStatus === "late").length,
    missing: scholars.filter((scholar) => scholar.wahfStatus === "missing").length,
  };
}

function toWahfAttention(scholars: MemoPageData["scholars"]) {
  return scholars
    .filter((scholar): scholar is typeof scholar & { wahfStatus: "late" | "missing" } =>
      scholar.wahfStatus === "missing" || scholar.wahfStatus === "late"
    )
    .map((scholar) => ({
      scholarName: scholar.scholarName,
      cohort: scholar.cohort,
      status: scholar.wahfStatus,
    }))
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "missing" ? -1 : 1;
      return left.scholarName.localeCompare(right.scholarName);
    });
}

function tlFormIssue(completed: number, required: number, late: boolean, label: string): string | null {
  const need = Math.max(0, required);
  if (need <= 0) return null;
  if (completed < need) return `${label} missing`;
  if (late) return `${label} late`;
  return null;
}

function toTlSubmissionAttention(rows: MemoPageData["teamLeaderFormStats"]) {
  return rows
    .map((row) => {
      const issues = [
        tlFormIssue(row.mcfCompleted, row.mcfRequired, row.mcfLate, "MCF"),
        tlFormIssue(row.wplCompleted, row.wplRequired, row.wplLate, "WPL"),
        tlFormIssue(row.wahfCompleted, row.wahfRequired, row.wahfLate, "WAHF"),
      ].filter((issue): issue is string => issue != null);
      return { leaderName: row.name, issues };
    })
    .filter((row) => row.issues.length > 0)
    .sort((left, right) => left.leaderName.localeCompare(right.leaderName));
}

/**
 * Converts the selected-week memo source model into the print-only report model.
 * The source model is assembled from weekly attendance, completed-session, tutor,
 * grade, and form-log queries; this projection intentionally does not consume the
 * dashboard's client-side PDF adapter.
 */
export function createWeeklyMemoReport(data: MemoPageData): WeeklyMemoReport {
  const studyRoster = sortRosterByMinutesDesc(data.scholars.map((scholar) => toRosterRow(scholar, "study")).filter((row): row is WeeklyMemoRosterRow => row != null));
  const frontDeskRoster = sortRosterByMinutesDesc(data.scholars.map((scholar) => toRosterRow(scholar, "frontDesk")).filter((row): row is WeeklyMemoRosterRow => row != null));
  const sophomore = sophomoreCohortYear();
  const freshman = freshmanCohortYear();
  const allGrades = [...data.gradeBreakdown.high, ...data.gradeBreakdown.mid, ...data.gradeBreakdown.low];
  const tutoringNoShows = data.tutorReports.filter((report) => report.scholarName === "EMPTY SESSION");
  const tutoringByDay = Array.from(
    data.tutorReports.reduce((groups, report) => {
      const sessions = groups.get(report.dayOfWeek) ?? [];
      sessions.push(report);
      groups.set(report.dayOfWeek, sessions);
      return groups;
    }, new Map<string, MemoPageData["tutorReports"]>())
  ).map(([day, sessions]) => ({ day, sessions }));

  const range = campusWeekToDateRange(data.selectedWeekNumber);
  const printedAt = weeklyMemoPrintedAt();
  const dateRange = range == null
    ? data.weekLabel
    : `${range.startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })} - ${range.endDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}`;

  return {
    weekNumber: data.selectedWeekNumber,
    weekLabel: `Week ${data.selectedWeekNumber}`,
    dateRange,
    printedAtLabel: printedAt.label,
    printedAtSlug: printedAt.slug,
    attentionThresholdPercent: WEEKLY_MEMO_ATTENTION_THRESHOLD_PERCENT,
    snapshotCompletePercent: WEEKLY_MEMO_SNAPSHOT_COMPLETE_PERCENT,
    overview: {
      traffic: {
        thisWeek: data.trafficEntryCountForSelectedWeek,
        thisSemester: data.trafficWeeklyData.reduce((total, row) => total + row.entryCount, 0),
        weekly: toPrintTrafficSeries(data.trafficWeeklyData, data.selectedWeekNumber),
        sessions: data.trafficSessions.map((session) => ({ entryAt: session.entryAt, exitAt: session.exitAt })),
      },
      frontDesk: snapshotHoursOverview(data.scholars, "frontDesk", [sophomore, freshman]),
      studySession: snapshotHoursOverview(data.scholars, "study", [sophomore, freshman]),
      tutoring: { sessionsLogged: data.tutorReports.length - tutoringNoShows.length, noShowCount: tutoringNoShows.length },
      submissions: {
        wahf: toScholarWahfOverview(data.scholars),
        tlWahf: toSubmissionOverview(data.formCompletionOverall.wahfCompleted, data.formCompletionOverall.wahfRequired, data.formCompletionOverall.wahfLateCount),
        wpl: toSubmissionOverview(data.formCompletionOverall.wplCompleted, data.formCompletionOverall.wplRequired, data.formCompletionOverall.wplLateCount),
        mcf: toSubmissionOverview(data.formCompletionOverall.mcfCompleted, data.formCompletionOverall.mcfRequired, data.formCompletionOverall.mcfLateCount),
      },
    },
    studyRoster,
    frontDeskRoster,
    attention: {
      wahf: toWahfAttention(data.scholars),
      tlSubmissions: toTlSubmissionAttention(data.teamLeaderFormStats),
      studyCompletion: studyRoster.filter((row) => row.completionPercent < WEEKLY_MEMO_ATTENTION_THRESHOLD_PERCENT).sort((a, b) => a.completionPercent - b.completionPercent),
      frontDeskCompletion: frontDeskRoster.filter((row) => row.completionPercent < WEEKLY_MEMO_ATTENTION_THRESHOLD_PERCENT).sort((a, b) => a.completionPercent - b.completionPercent),
      tutoringNoShows,
      lowGrades: allGrades.filter((grade) => grade.percent <= 77),
    },
    tutoringByDay,
    recognition: {
      high: allGrades.filter((grade) => grade.percent >= 90),
      mid: allGrades.filter((grade) => grade.percent >= 80 && grade.percent < 90),
    },
  };
}

export async function getWeeklyMemoReport(weekNumber: number): Promise<WeeklyMemoReport> {
  return createWeeklyMemoReport(await getMemoPageData(weekNumber));
}
