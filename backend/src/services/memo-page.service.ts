/**
 * @file memo-page.service.ts
 * @module backend/services
 *
 * Memo page data assembly service.
 * Aggregates all data needed to render the weekly memo page into a single
 * response object. Calls multiple domain services and merges their results.
 *
 * ## Responsibilities
 * - Fetch and combine campus-week attendance (tickets + excuses), form logs, traffic, and user data
 * - Compute derived metrics (completion rates, traffic trends, etc.)
 * - Return a fully assembled getMemoPageData(weekNum) payload
 *
 * ## What belongs here
 * - Cross-domain data assembly for the /api/memo/page-data endpoint
 *
 * ## What does NOT belong here
 * - Individual domain queries (those live in their own service files)
 * - Memo sync operations (that's memo.service.ts)
 * - HTTP request/response logic
 */
import { campusWeekToDateRange, dateToCampusWeek, freshmanCohortYear, getWeekFetchEnd, sophomoreCohortYear } from "./time.service.js";
import { fetchTeamLeaders, isEligibleScholar, isTeamLeaderForPerformance } from "./user.service.js";
import { fetchMenteeTeamLeaderNames, teamLeaderLabelForScholar } from "./mentee.service.js";
import {
  getCampusWeekAttendance,
} from "./attendance-week.service.js";
import type { CampusWeekAttendanceTotals } from "../models/attendance-week.model.js";
import { EMPTY_WEEKLY_MINUTES } from "../models/weekly-minutes.model.js";
import { getTrafficEntryCountsForWeeks, getTrafficEntryCountForWeek, getTrafficEntryCountForWeekThrough, getTrafficSessionsForWeek, comparableLastWeekThroughDate } from "./traffic.service.js";
import {
  getMcfFormLogsForWeekWithLate,
  getWhafFormLogsForWeekWithLate,
  getWplFormLogsForWeekWithLate,
  buildTeamLeaderFormStatsForWeek,
  countableFormRequired,
} from "./form-log.service.js";
import { getTutorReportLogsForWeek } from "./tutor-report-log.service.js";
import type { FormLogRowWithLate, McfFormLogRow, WahfFormLogRow } from "../models/form-log.model.js";
import type { MemoUserRow } from "../models/user.model.js";
import type { ScholarShiftCompliance, ShiftComplianceByKind } from "../models/session-log.model.js";
import { getShiftComplianceForScholars } from "./session-log.service.js";

export type ScholarWahfStatus = "on-time" | "late" | "missing";

/** Latest weekly WAHF form-log row for a scholar, or null if none. */
export function latestScholarWahf(
  scholarId: string,
  wahfRows: FormLogRowWithLate<WahfFormLogRow>[]
): FormLogRowWithLate<WahfFormLogRow> | null {
  const mine = wahfRows.filter((row) => row.scholar_uid === scholarId);
  if (mine.length === 0) return null;
  return mine.reduce((best, row) =>
    (row.created_at ?? "") > (best.created_at ?? "") ? row : best
  );
}

/** Latest WAHF for a scholar this week: missing, on-time, or late. */
export function scholarWahfStatus(
  scholarId: string,
  wahfRows: FormLogRowWithLate<WahfFormLogRow>[]
): ScholarWahfStatus {
  const latest = latestScholarWahf(scholarId, wahfRows);
  if (!latest) return "missing";
  return latest.isLate ? "late" : "on-time";
}

/** `created_at` of the latest weekly WAHF log for that scholar, or null if none. */
export function scholarWahfSubmittedAt(
  scholarId: string,
  wahfRows: FormLogRowWithLate<WahfFormLogRow>[]
): string | null {
  const createdAt = latestScholarWahf(scholarId, wahfRows)?.created_at;
  return createdAt ? createdAt : null;
}

export type MemoGradeEntry = {
  scholarName: string;
  course: string;
  assessment: string;
  grade: string;
  percent: number;
};

export type MemoGradeBreakdown = {
  high: MemoGradeEntry[];
  mid: MemoGradeEntry[];
  low: MemoGradeEntry[];
};

function parseGradeEntriesFromWahf(row: FormLogRowWithLate<WahfFormLogRow>): MemoGradeEntry[] {
  const grades = row.assignment_grades;
  if (!grades || typeof grades !== "object") return [];
  const scholarName = row.scholar_name ?? row.scholar_uid ?? "Unknown";
  const entries: MemoGradeEntry[] = [];
  for (const [course, assessments] of Object.entries(grades)) {
    if (!assessments || typeof assessments !== "object") continue;
    for (const [assessment, gradeStr] of Object.entries(assessments)) {
      const match = String(gradeStr).match(/(\d+(?:\.\d+)?)/);
      if (!match) continue;
      const percent = parseFloat(match[1]!);
      entries.push({ scholarName, course, assessment, grade: String(gradeStr), percent });
    }
  }
  return entries;
}

/**
 * Parse assignment grades from the latest WAHF per submitter so resubmits do not
 * duplicate. Defaults to every WAHF uid for the week (scholars and team leaders).
 * Pass `submitterIds` only when a caller needs a narrower roster.
 */
export function buildGradeBreakdown(
  wahfRows: FormLogRowWithLate<WahfFormLogRow>[],
  submitterIds?: Set<string>,
): MemoGradeBreakdown {
  const breakdown: MemoGradeBreakdown = { high: [], mid: [], low: [] };
  const ids = submitterIds ?? new Set(
    wahfRows.map((row) => row.scholar_uid).filter((uid): uid is string => Boolean(uid))
  );
  for (const scholarId of ids) {
    const latest = latestScholarWahf(scholarId, wahfRows);
    if (!latest) continue;
    for (const entry of parseGradeEntriesFromWahf(latest)) {
      if (entry.percent >= 90) breakdown.high.push(entry);
      else if (entry.percent >= 70) breakdown.mid.push(entry);
      else breakdown.low.push(entry);
    }
  }
  const byPercentDesc = (left: MemoGradeEntry, right: MemoGradeEntry) => {
    if (left.percent !== right.percent) return right.percent - left.percent;
    const byName = left.scholarName.localeCompare(right.scholarName);
    if (byName !== 0) return byName;
    return left.course.localeCompare(right.course);
  };
  breakdown.high.sort(byPercentDesc);
  breakdown.mid.sort(byPercentDesc);
  breakdown.low.sort(byPercentDesc);
  return breakdown;
}

const ZERO_ATTENDANCE: CampusWeekAttendanceTotals = {
  minutes: EMPTY_WEEKLY_MINUTES,
  loggedMin: 0,
  excuseMin: 0,
  description: null,
};

export type MemoScholarAttendanceRow = {
  scholarId: string;
  scholarName: string;
  cohort: number | null;
  teamLeader: string;
  fdTotal: number;
  ssTotal: number;
  fdRequired: number | null;
  ssRequired: number | null;
  fdExcuseMin: number;
  ssExcuseMin: number;
  fdPct: number | null;
  ssPct: number | null;
  wahfStatus: ScholarWahfStatus;
  wahfSubmittedAt: string | null;
  fdCompliance: ShiftComplianceByKind;
  ssCompliance: ShiftComplianceByKind;
};

function emptyShiftCompliance(): ShiftComplianceByKind {
  return { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] };
}

/**
 * Mirrors getMcfFormLogsByUidAndWeek's mentor-or-mentee predicate using the
 * selected week's already-fetched rows, without issuing one query per leader.
 */
export function aggregateTeamLeaderMcfStats(
  teamLeaderUids: string[],
  mcfRowsWithLate: FormLogRowWithLate<McfFormLogRow>[]
): Map<string, { count: number; hasLate: boolean; latestAt: string | null }> {
  const teamLeaderUidSet = new Set(teamLeaderUids);
  const stats = new Map<string, { count: number; hasLate: boolean; latestAt: string | null }>();

  for (const row of mcfRowsWithLate) {
    const matchingUids = new Set([row.mentor_uid, row.mentee_uid]);
    for (const uid of matchingUids) {
      if (!uid || !teamLeaderUidSet.has(uid)) continue;
      const current = stats.get(uid) ?? { count: 0, hasLate: false, latestAt: null };
      const latestAt = !current.latestAt || row.created_at > current.latestAt
        ? row.created_at
        : current.latestAt;
      stats.set(uid, {
        count: current.count + 1,
        hasLate: current.hasLate || row.isLate,
        latestAt,
      });
    }
  }

  return stats;
}

/**
 * Merge roster requirements with compute-on-read minutes + scholar_week_excuses.
 * Empty tickets → 0 logged; excuse-only scholars still get completion from excuse_min.
 */
export function buildMemoScholarAttendanceRows(
  users: MemoUserRow[],
  fdByUid: Map<string, CampusWeekAttendanceTotals>,
  ssByUid: Map<string, CampusWeekAttendanceTotals>,
  wahfRows: FormLogRowWithLate<WahfFormLogRow>[] = [],
  complianceByScholarId: Map<string, ScholarShiftCompliance> = new Map(),
  teamLeaderByMenteeUid: Map<string, string> = new Map(),
): {
  scholars: MemoScholarAttendanceRow[];
  cohort2024: { total: number; fdCompleteCount: number; ssCompleteCount: number };
  cohort2025: { total: number; fdCompleteCount: number; ssCompleteCount: number };
} {
  const scholars: MemoScholarAttendanceRow[] = [];
  const cohort2024 = { total: 0, fdCompleteCount: 0, ssCompleteCount: 0 };
  const cohort2025 = { total: 0, fdCompleteCount: 0, ssCompleteCount: 0 };
  const sophomoreYear = sophomoreCohortYear();
  const freshmanYear = freshmanCohortYear();

  for (const u of users) {
    if (!isEligibleScholar(u)) continue;
    const fd = fdByUid.get(u.uid) ?? ZERO_ATTENDANCE;
    const study = ssByUid.get(u.uid) ?? ZERO_ATTENDANCE;
    const fdReq = u.fd_required ?? null;
    const ssReq = u.ss_required ?? null;
    const fdEffective = fd.loggedMin + fd.excuseMin;
    const ssEffective = study.loggedMin + study.excuseMin;
    const fd_pct = fdReq != null && fdReq > 0 ? (fdEffective / fdReq) * 100 : null;
    const ss_pct = ssReq != null && ssReq > 0 ? (ssEffective / ssReq) * 100 : null;
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.uid;
    const compliance = complianceByScholarId.get(u.uid);

    scholars.push({
      scholarId: u.uid,
      scholarName: name,
      cohort: u.cohort ?? null,
      teamLeader: teamLeaderLabelForScholar(u.uid, teamLeaderByMenteeUid),
      fdTotal: fd.loggedMin,
      ssTotal: study.loggedMin,
      fdRequired: fdReq,
      ssRequired: ssReq,
      fdExcuseMin: fd.excuseMin,
      ssExcuseMin: study.excuseMin,
      fdPct: fd_pct,
      ssPct: ss_pct,
      wahfStatus: scholarWahfStatus(u.uid, wahfRows),
      wahfSubmittedAt: scholarWahfSubmittedAt(u.uid, wahfRows),
      fdCompliance: compliance?.fdCompliance ?? emptyShiftCompliance(),
      ssCompliance: compliance?.ssCompliance ?? emptyShiftCompliance(),
    });

    const fdComplete = fd_pct != null && fd_pct >= 100;
    const ssComplete = ss_pct != null && ss_pct >= 100;
    if (u.cohort === sophomoreYear) {
      cohort2024.total++;
      if (fdComplete) cohort2024.fdCompleteCount++;
      if (ssComplete) cohort2024.ssCompleteCount++;
    } else if (u.cohort === freshmanYear) {
      cohort2025.total++;
      if (fdComplete) cohort2025.fdCompleteCount++;
      if (ssComplete) cohort2025.ssCompleteCount++;
    }
  }

  return { scholars, cohort2024, cohort2025 };
}

/**
 * Build the complete weekly memo page data for a given campus week.
 *
 * Flow:
 * 1. Resolve the campus week date range and prepare query boundaries.
 * 2. Fetch all data sources in parallel:
 *    - campus-week attendance (tickets + scholar_week_excuses), completed sessions,
 *      trafficWeeklyData, trafficEntryCount, same-weekday last-week traffic count, trafficSessions,
 *      teamLeaders, mentor_mentee → TL names, mcf/whaf/wpl form logs (with late flags),
 *      tutorReportLogs.
 * 3. Parse assignment grades from the latest WHAF per submitter (scholars and
 *    team leaders) into a grade breakdown (high ≥90%, mid 70-89%, low <70%)
 *    so resubmits do not duplicate.
 * 4. Compute WHAF submission donut stats for enrolled eligible scholars (submitted, late).
 * 5. Build team leader form stats (MCF/WHAF/WPL completion per TL).
 * 6. Aggregate form completion totals across all team leaders.
 * 7. Build scholar rows: merge FD/SS compute-on-read minutes + excuses with
 *    roster requirements, compute completion percentages, attach WAHF status
 *    and latest form-log submitted-at from form logs, attach team-leader name
 *    from mentor_mentee (or "Unassigned"), and track cohort-level stats for
 *    pie charts (2024 vs 2025).
 * 8. Build team leader MCF rows: per-TL MCF count, late flag, latest date.
 * 9. Resolve tutor report scholar names and derive day-of-week.
 * 10. Return everything as a single object for the frontend to render.
 */
export async function getMemoPageData(weekNum: number) {
  const currentCampusWeek = dateToCampusWeek(new Date());
  const range = campusWeekToDateRange(weekNum);
  const endDate = range ? getWeekFetchEnd(range) : undefined;

  const weekPickerMax = Math.max(25, currentCampusWeek ?? 1, weekNum);
  const weekNumbers = Array.from({ length: weekPickerMax }, (_, i) => i + 1);
  const now = new Date();
  const lastWeekThrough = comparableLastWeekThroughDate(now, weekNum, currentCampusWeek);

  const [
    attendance,
    trafficWeeklyData,
    trafficEntryCountForSelectedWeek,
    trafficComparableLastWeekCount,
    trafficSessions,
    teamLeadersRaw,
    menteeTeamLeaders,
    mcfRowsWithLate,
    whafRowsWithLate,
    wplRowsWithLate,
    tutorReportLogs,
  ] = await Promise.all([
    getCampusWeekAttendance(weekNum),
    getTrafficEntryCountsForWeeks(weekNumbers),
    getTrafficEntryCountForWeek(weekNum),
    lastWeekThrough == null
      ? Promise.resolve(0)
      : getTrafficEntryCountForWeekThrough(weekNum - 1, lastWeekThrough),
    getTrafficSessionsForWeek(weekNum),
    fetchTeamLeaders(),
    fetchMenteeTeamLeaderNames(),
    getMcfFormLogsForWeekWithLate(weekNum),
    getWhafFormLogsForWeekWithLate(weekNum),
    getWplFormLogsForWeekWithLate(weekNum),
    getTutorReportLogsForWeek(weekNum),
  ]);

  const allUsers = attendance.users;
  const enrolledScholars = allUsers.filter(isEligibleScholar);
  const completedStudy = attendance.ssSessions;
  const completedFd = attendance.fdSessions;
  const complianceByScholarId = range
    ? await getShiftComplianceForScholars(
      enrolledScholars.map((user) => user.uid),
      range
    )
    : new Map<string, ScholarShiftCompliance>();

  const gradeBreakdown = buildGradeBreakdown(whafRowsWithLate);

  // WAHF census — enrolled eligible scholars only (`user_roster.status` = enrolled)
  const whafSubmitterUids = new Set(
    whafRowsWithLate
      .map((r) => r.scholar_uid)
      .filter((uid): uid is string => Boolean(uid))
  );
  const totalUsers = enrolledScholars.length;
  const whafSubmittedCount = enrolledScholars.filter((u) => whafSubmitterUids.has(u.uid)).length;
  const whafLateCount = enrolledScholars.filter(
    (u) => scholarWahfStatus(u.uid, whafRowsWithLate) === "late"
  ).length;
  const whafPct = totalUsers > 0 ? Math.round((whafSubmittedCount / totalUsers) * 100) : 0;
  const wahfDonut = {
    total: totalUsers,
    completeCount: whafSubmittedCount,
    lateCount: whafLateCount,
    percentComplete: whafPct,
  };

  const teamLeaderFormRows = buildTeamLeaderFormStatsForWeek(
    teamLeadersRaw,
    mcfRowsWithLate,
    whafRowsWithLate,
    wplRowsWithLate
  );

  const formCompletionOverall = teamLeaderFormRows.reduce(
    (acc, row) => ({
      wahfCompleted: acc.wahfCompleted + Math.min(row.wahfCompleted, row.wahfRequired),
      wahfRequired: acc.wahfRequired + row.wahfRequired,
      wahfLateCount: acc.wahfLateCount + (row.wahfLate ? 1 : 0),
      mcfCompleted: acc.mcfCompleted + Math.min(row.mcfCompleted, countableFormRequired(row.mcfRequired)),
      mcfRequired: acc.mcfRequired + countableFormRequired(row.mcfRequired),
      mcfLateCount: acc.mcfLateCount + (countableFormRequired(row.mcfRequired) > 0 && row.mcfLate ? 1 : 0),
      wplCompleted: acc.wplCompleted + Math.min(row.wplCompleted, row.wplRequired),
      wplRequired: acc.wplRequired + row.wplRequired,
      wplLateCount: acc.wplLateCount + (row.wplLate ? 1 : 0),
    }),
    {
      wahfCompleted: 0, wahfRequired: 0, wahfLateCount: 0,
      mcfCompleted: 0, mcfRequired: 0, mcfLateCount: 0,
      wplCompleted: 0, wplRequired: 0, wplLateCount: 0,
    }
  );

  const { scholars, cohort2024, cohort2025 } = buildMemoScholarAttendanceRows(
    allUsers,
    attendance.fdByUid,
    attendance.ssByUid,
    whafRowsWithLate,
    complianceByScholarId,
    menteeTeamLeaders,
  );

  const pieData = {
    cohort2024: {
      ...cohort2024,
      fdPercent: cohort2024.total > 0 ? (cohort2024.fdCompleteCount / cohort2024.total) * 100 : 0,
      ssPercent: cohort2024.total > 0 ? (cohort2024.ssCompleteCount / cohort2024.total) * 100 : 0,
    },
    cohort2025: {
      ...cohort2025,
      fdPercent: cohort2025.total > 0 ? (cohort2025.fdCompleteCount / cohort2025.total) * 100 : 0,
      ssPercent: cohort2025.total > 0 ? (cohort2025.ssCompleteCount / cohort2025.total) * 100 : 0,
    },
  };

  // Team leaders MCF stats
  const tlUsers = allUsers.filter(isTeamLeaderForPerformance);
  const mcfByTlUid = aggregateTeamLeaderMcfStats(
    tlUsers.map((user) => user.uid),
    mcfRowsWithLate
  );

  const MCF_REQUIRED_PER_WEEK = 1;
  const teamLeaders = tlUsers.map((u) => {
    const mcf = mcfByTlUid.get(u.uid) ?? { count: 0, hasLate: false, latestAt: null };
    const mcf_pct = MCF_REQUIRED_PER_WEEK > 0 ? Math.round((mcf.count / MCF_REQUIRED_PER_WEEK) * 100) : null;
    return {
      scholarId: u.uid,
      name: [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.uid,
      mcfCompleted: mcf.count,
      mcfRequired: MCF_REQUIRED_PER_WEEK,
      mcfLate: mcf.hasLate,
      mcfPct: mcf_pct,
      mcfLatestAt: mcf.latestAt ?? endDate?.toISOString() ?? "",
    };
  });

  // Tutor reports — resolve scholar_uid to scholar_name
  const userNameByUid = new Map(
    allUsers.map(u => [u.uid, [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.uid])
  );
  const tutorReports = tutorReportLogs.map(log => {
    // Derive day of week from created_at in Eastern time
    let dayOfWeek: string = "—";
    if (log.created_at) {
      dayOfWeek = new Date(log.created_at).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "America/New_York",
      });
    }
    return {
      id: log.id,
      scholarId: log.scholar_uid,
      scholarName: (!log.scholar_uid || log.scholar_uid.toLowerCase() === "n/a")
        ? "EMPTY SESSION"
        : (userNameByUid.get(log.scholar_uid) ?? log.scholar_uid),
      tutorName: log.tutor_name,
      courses: log.courses,
      startTime: log.start_time,
      endTime: log.end_time,
      dayOfWeek,
    };
  });

  const weekLabel = range != null
    ? `Week ${range.weekNumber} (${range.startDate.toLocaleDateString("en-US", { timeZone: "America/New_York" })} - ${range.endDate.toLocaleDateString("en-US", { timeZone: "America/New_York" })})`
    : `Week ${weekNum}`;

  return {
    scholars,
    teamLeaders,
    pieData,
    formCompletionOverall,
    completedStudy,
    completedFd,
    trafficWeeklyData,
    trafficEntryCountForSelectedWeek,
    trafficComparableLastWeekCount,
    trafficSessions,
    tutorReports,
    teamLeaderFormStats: teamLeaderFormRows,
    gradeBreakdown,
    wahfDonut,
    weekLabel,
    currentCampusWeek,
    selectedWeekNumber: weekNum,
  };
}
