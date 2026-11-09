/**
 * @file freshman-grades.service.ts
 * @module backend/services
 *
 * Temporary developer view of freshman and sophomore semester-to-date FD, SS,
 * and WAHF completion. Each campus week is capped at 100% before averaging so
 * extra hours in one week cannot make up a missed week.
 *
 * ## Responsibilities
 * - Cap and average weekly FD/SS completion and WAHF submission
 * - Assemble enrolled freshmen and sophomores who owe hours for weeks 1 through the current week
 *
 * ## What belongs here
 * - Pure grade math and the developer report assembler
 * - Reads of campus-week attendance and WAHF form logs
 *
 * ## What does NOT belong here
 * - Coordinator auth, letter grades, or a summed 100-point semester total
 * - HTTP request/response logic
 * - daily_scholar_activity or frozen *_records_legacy tables
 */
import { completionPct, effectiveMinutes, getCampusWeekAttendance } from "./attendance-week.service.js";
import { getWhafFormLogsForWeekWithLate } from "./form-log.service.js";
import { scholarWahfStatus, type ScholarWahfStatus } from "./memo-page.service.js";
import { fetchMenteeTeamLeaderIndex, teamLeaderLabelForScholar } from "./mentee.service.js";
import { dateToCampusWeek } from "./time.service.js";
import { fetchAllUsersForMemo, isEligibleScholar } from "./user.service.js";

/** Campus week 1 is omitted from freshman and sophomore grades. Scoring starts the following week. */
export const FRESHMAN_GRADES_FIRST_SCORED_WEEK = 2;

/** In-app slices from the coordinator grades spec. The other 70% is not scored here. */
export const FRESHMAN_GRADE_WEIGHTS = {
  fd: 10,
  ss: 10,
  wahf: 10,
  outOfApp: 70,
} as const;

export type FreshmanGradeWeekInput = {
  weekNum: number;
  fdLoggedMinutes: number;
  fdExcuseMinutes: number;
  fdRequiredMinutes: number | null;
  ssLoggedMinutes: number;
  ssExcuseMinutes: number;
  ssRequiredMinutes: number | null;
  wahfStatus: ScholarWahfStatus;
};

export type FreshmanGradeHoursWeek = {
  loggedMinutes: number;
  excuseMinutes: number;
  effectiveMinutes: number;
  requiredMinutes: number | null;
  /** Uncapped completion. Null when required minutes are missing or zero. */
  rawPct: number | null;
  /** Capped at 100. Null when the week is not scored. */
  cappedPct: number | null;
};

export type FreshmanGradeWeekBreakdown = {
  weekNum: number;
  fd: FreshmanGradeHoursWeek;
  ss: FreshmanGradeHoursWeek;
  wahfStatus: ScholarWahfStatus;
  wahfPct: number;
};

export type FreshmanGradeScholarInput = {
  uid: string;
  first_name: string | null;
  last_name: string | null;
  cohort: number | null;
  program_role: string | null;
  status: string | null;
  fd_required: number | null;
  ss_required: number | null;
  /** Display name from mentor_mentee. "Unassigned" when the scholar has no mentor. */
  mentor: string;
  weeks: FreshmanGradeWeekInput[];
};

export type FreshmanGradeRow = {
  scholarId: string;
  scholarName: string;
  mentor: string;
  cohort: number;
  fdPct: number | null;
  ssPct: number | null;
  wahfPct: number | null;
  weeks: FreshmanGradeWeekBreakdown[];
};

export type FreshmanGradesScoredWeeks = {
  fromWeek: number;
  throughWeek: number;
};

export type FreshmanGradesReport = {
  /** Current campus week. 0 before the semester starts. */
  throughWeek: number;
  /** Weeks that are scored: week 2 through the week before throughWeek. */
  scoredWeeks: FreshmanGradesScoredWeeks | null;
  weights: typeof FRESHMAN_GRADE_WEIGHTS;
  scholars: FreshmanGradeRow[];
};

/** Weeks 2 through the previous campus week. Null when that range is empty. */
export function freshmanGradesScoredWeeks(throughWeek: number): FreshmanGradesScoredWeeks | null {
  const last = throughWeek - 1;
  if (last < FRESHMAN_GRADES_FIRST_SCORED_WEEK) return null;
  return { fromWeek: FRESHMAN_GRADES_FIRST_SCORED_WEEK, throughWeek: last };
}

/** Weekly hours completion, capped at 100. Null or non-positive required is unscored. */
export function cappedWeeklyCompletionPct(
  effectiveMinutesValue: number,
  requiredMinutes: number | null,
): number | null {
  const pct = completionPct(effectiveMinutesValue, requiredMinutes);
  if (pct == null) return null;
  return Math.min(100, pct);
}

/** Mean of scored weeks. Weeks with a null percent are omitted, not treated as 0. */
export function averageCappedWeeklyPct(weekPcts: Array<number | null>): number | null {
  const scored = weekPcts.filter((pct): pct is number => pct != null);
  if (scored.length === 0) return null;
  const sum = scored.reduce((total, pct) => total + pct, 0);
  return Math.round(sum / scored.length);
}

/** Missing WAHF is 0% that week. On-time and late submissions are both 100%. */
export function wahfWeekCompletionPct(status: ScholarWahfStatus): number {
  return status === "missing" ? 0 : 100;
}

function scholarDisplayName(scholar: FreshmanGradeScholarInput): string {
  const name = [scholar.first_name, scholar.last_name].filter(Boolean).join(" ").trim();
  return name || scholar.uid;
}

function hoursWeek(
  loggedMinutes: number,
  excuseMinutes: number,
  requiredMinutes: number | null,
): FreshmanGradeHoursWeek {
  const effective = effectiveMinutes(loggedMinutes, excuseMinutes);
  return {
    loggedMinutes,
    excuseMinutes,
    effectiveMinutes: effective,
    requiredMinutes,
    rawPct: completionPct(effective, requiredMinutes),
    cappedPct: cappedWeeklyCompletionPct(effective, requiredMinutes),
  };
}

function weekBreakdown(week: FreshmanGradeWeekInput): FreshmanGradeWeekBreakdown {
  return {
    weekNum: week.weekNum,
    fd: hoursWeek(week.fdLoggedMinutes, week.fdExcuseMinutes, week.fdRequiredMinutes),
    ss: hoursWeek(week.ssLoggedMinutes, week.ssExcuseMinutes, week.ssRequiredMinutes),
    wahfStatus: week.wahfStatus,
    wahfPct: wahfWeekCompletionPct(week.wahfStatus),
  };
}

/**
 * Enrolled freshmen and sophomores with required hours, FD/SS/WAHF as capped
 * weekly averages. Other cohorts and scholars who owe no hours are omitted.
 * No semester total.
 */
export function assembleFreshmanGrades(
  scholars: FreshmanGradeScholarInput[],
  throughWeek: number,
): FreshmanGradesReport {
  const rows: FreshmanGradeRow[] = [];
  const scoredWeeks = freshmanGradesScoredWeeks(throughWeek);

  for (const scholar of scholars) {
    if (!isEligibleScholar(scholar)) continue;
    if (scholar.cohort == null) continue;

    const weeks = scholar.weeks
      .filter(
        (week) =>
          scoredWeeks != null &&
          week.weekNum >= scoredWeeks.fromWeek &&
          week.weekNum <= scoredWeeks.throughWeek,
      )
      .sort((a, b) => a.weekNum - b.weekNum)
      .map(weekBreakdown);
    rows.push({
      scholarId: scholar.uid,
      scholarName: scholarDisplayName(scholar),
      mentor: scholar.mentor,
      cohort: scholar.cohort,
      fdPct: averageCappedWeeklyPct(weeks.map((week) => week.fd.cappedPct)),
      ssPct: averageCappedWeeklyPct(weeks.map((week) => week.ss.cappedPct)),
      wahfPct: averageCappedWeeklyPct(weeks.map((week) => week.wahfPct)),
      weeks,
    });
  }

  rows.sort((a, b) => {
    if (a.cohort !== b.cohort) return b.cohort - a.cohort;
    return a.scholarName.localeCompare(b.scholarName, undefined, { sensitivity: "base" });
  });

  return {
    throughWeek,
    scoredWeeks,
    weights: FRESHMAN_GRADE_WEIGHTS,
    scholars: rows,
  };
}

/**
 * Freshman and sophomore grades from campus week 2 through the previous week.
 * Week 6 scores weeks 2–5. The current week and week 1 are ignored.
 * Minutes come from tickets plus scholar_week_excuses. WAHF uses the latest log for each week.
 */
export async function getFreshmanGradesReport(now = new Date()): Promise<FreshmanGradesReport> {
  const currentWeek = dateToCampusWeek(now);
  const throughWeek = currentWeek != null && currentWeek >= 1 ? currentWeek : 0;
  if (throughWeek < 1) {
    return assembleFreshmanGrades([], throughWeek);
  }

  const scoredWeeks = freshmanGradesScoredWeeks(throughWeek);
  const scoredWeekNums =
    scoredWeeks == null
      ? []
      : Array.from(
          { length: scoredWeeks.throughWeek - scoredWeeks.fromWeek + 1 },
          (_, index) => scoredWeeks.fromWeek + index,
        );
  const [weekPayloads, menteeTeamLeaderIndex, users] = await Promise.all([
    Promise.all(
      scoredWeekNums.map(async (weekNum) => {
        const [attendance, wahfRows] = await Promise.all([
          getCampusWeekAttendance(weekNum),
          getWhafFormLogsForWeekWithLate(weekNum),
        ]);
        return { attendance, wahfRows };
      }),
    ),
    fetchMenteeTeamLeaderIndex(),
    fetchAllUsersForMemo(),
  ]);
  const { labelByMenteeUid: mentorByMenteeUid } = menteeTeamLeaderIndex;
  const inputs: FreshmanGradeScholarInput[] = users.map((user) => ({
    uid: user.uid,
    first_name: user.first_name,
    last_name: user.last_name,
    cohort: user.cohort,
    program_role: user.program_role,
    status: user.status,
    fd_required: user.fd_required,
    ss_required: user.ss_required,
    mentor: teamLeaderLabelForScholar(user.uid, mentorByMenteeUid),
    weeks: weekPayloads.map((week) => {
      const fd = week.attendance.fdByUid.get(user.uid);
      const ss = week.attendance.ssByUid.get(user.uid);
      return {
        weekNum: week.attendance.week_num,
        fdLoggedMinutes: fd?.loggedMin ?? 0,
        fdExcuseMinutes: fd?.excuseMin ?? 0,
        fdRequiredMinutes: user.fd_required,
        ssLoggedMinutes: ss?.loggedMin ?? 0,
        ssExcuseMinutes: ss?.excuseMin ?? 0,
        ssRequiredMinutes: user.ss_required,
        wahfStatus: scholarWahfStatus(user.uid, week.wahfRows),
      };
    }),
  }));

  return assembleFreshmanGrades(inputs, throughWeek);
}
