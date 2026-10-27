/**
 * @file hours-benchmark.service.ts
 * @module backend/services
 *
 * Multi-week CSS Hours Benchmark Report: front desk and study session
 * completion for enrolled hour-eligible scholars from campus week 2 through
 * the previous week.
 *
 * ## Responsibilities
 * - Assemble heatmap rows, KPIs, team-leader rollups, and ≤50% event lists
 * - Reuse compute-on-read attendance (tickets + scholar_week_excuses)
 *
 * ## What belongs here
 * - Pure aggregation math and the report assembler
 * - Reads of campus-week attendance and mentor labels
 *
 * ## What does NOT belong here
 * - HTML/PDF rendering
 * - HTTP request/response logic
 */
import { completionPct, effectiveMinutes, getCampusWeekAttendance } from "./attendance-week.service.js";
import { fetchMenteeTeamLeaderNames, teamLeaderLabelForScholar } from "./mentee.service.js";
import {
  campusWeekToDateRange,
  dateToCampusWeek,
  scholarYearLabel,
} from "./time.service.js";
import { fetchAllUsersForMemo, isEligibleScholar } from "./user.service.js";

/** Campus week 1 is omitted; scoring starts the following week. */
export const HOURS_BENCHMARK_FIRST_SCORED_WEEK = 2;

/** Red / “at or below” band in the template. */
export const HOURS_BENCHMARK_AT_OR_BELOW_PERCENT = 50;

/** Blank cells and “met” band; below this counts as missed 80%. */
export const HOURS_BENCHMARK_MET_PERCENT = 80;

export type HoursBenchmarkArea = "front_desk" | "study_session";

export type HoursBenchmarkScoredWeeks = {
  fromWeek: number;
  throughWeek: number;
};

export type HoursBenchmarkWeekInput = {
  weekNum: number;
  fdLoggedMinutes: number;
  fdExcuseMinutes: number;
  fdRequiredMinutes: number | null;
  ssLoggedMinutes: number;
  ssExcuseMinutes: number;
  ssRequiredMinutes: number | null;
};

export type HoursBenchmarkScholarInput = {
  uid: string;
  first_name: string | null;
  last_name: string | null;
  cohort: number | null;
  program_role: string | null;
  status: string | null;
  fd_required: number | null;
  ss_required: number | null;
  teamLeader: string;
  weeks: HoursBenchmarkWeekInput[];
};

export type HoursBenchmarkCell = {
  weekNum: number;
  /** Rounded completion %. Null when the scholar is not scored for that kind/week. */
  completionPercent: number | null;
  excuseApplied: boolean;
};

export type HoursBenchmarkScholarRow = {
  scholarId: string;
  scholarName: string;
  isSophomore: boolean;
  classYear: "Freshman" | "Sophomore" | null;
  teamLeader: string;
  /** Count of (week × area) events at ≤50%. */
  atOrBelow50Count: number;
  frontDeskByWeek: HoursBenchmarkCell[];
  studySessionByWeek: HoursBenchmarkCell[];
};

export type HoursBenchmarkTeamLeaderRow = {
  teamLeader: string;
  atOrBelow50Events: number;
  studentCount: number;
};

export type HoursBenchmarkLowEvent = {
  weekNum: number;
  weekDateLabel: string;
  area: HoursBenchmarkArea;
  areaLabel: string;
  scholarName: string;
  classYear: string;
  teamLeader: string;
  completionPercent: number;
  excuseApplied: boolean;
};

export type HoursBenchmarkSummary = {
  studentsAtOrBelow50AtLeastOnce: number;
  atOrBelow50Events: number;
  zeroPercentEvents: number;
  studentsMissed80AtLeastOnce: number;
};

export type HoursBenchmarkReport = {
  currentCampusWeek: number;
  scoredWeeks: HoursBenchmarkScoredWeeks | null;
  weekNumbers: number[];
  weekRangeLabel: string;
  dateRangeLabel: string;
  preparedAtLabel: string;
  printedAtSlug: string;
  summary: HoursBenchmarkSummary;
  heatmapScholars: HoursBenchmarkScholarRow[];
  byTeamLeader: HoursBenchmarkTeamLeaderRow[];
  lowEvents: HoursBenchmarkLowEvent[];
};

/** Weeks 2 through the previous campus week. Null when that range is empty. */
export function hoursBenchmarkScoredWeeks(currentCampusWeek: number): HoursBenchmarkScoredWeeks | null {
  const last = currentCampusWeek - 1;
  if (last < HOURS_BENCHMARK_FIRST_SCORED_WEEK) return null;
  return { fromWeek: HOURS_BENCHMARK_FIRST_SCORED_WEEK, throughWeek: last };
}

function scholarDisplayName(scholar: HoursBenchmarkScholarInput): string {
  const name = [scholar.first_name, scholar.last_name].filter(Boolean).join(" ").trim();
  return name || scholar.uid;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((entry) => entry.type === type)?.value ?? "";
}

/** Eastern prepared-at stamp shared by the PDF filename and the printout. */
export function hoursBenchmarkPreparedAt(now = new Date()) {
  const labelParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const label = `${part(labelParts, "month")} ${part(labelParts, "day")}, ${part(labelParts, "year")}`;
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

export function hoursBenchmarkPdfFilename(
  scoredWeeks: HoursBenchmarkScoredWeeks | null,
  printedAtSlug: string,
) {
  if (scoredWeeks == null) {
    return `hours-benchmark-${printedAtSlug}.pdf`;
  }
  return `hours-benchmark-weeks-${scoredWeeks.fromWeek}-${scoredWeeks.throughWeek}-${printedAtSlug}.pdf`;
}

function formatMonthDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).formatToParts(date);
  return `${part(parts, "month")} ${part(parts, "day")}`;
}

function formatMonthDayYear(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(date);
  return `${part(parts, "month")} ${part(parts, "day")}, ${part(parts, "year")}`;
}

/** e.g. "Week 2 (Sep 7–13)". */
export function hoursBenchmarkWeekDateLabel(weekNum: number): string {
  const range = campusWeekToDateRange(weekNum);
  if (!range) return `Week ${weekNum}`;
  return `Week ${weekNum} (${formatMonthDay(range.startDate)}–${formatMonthDay(range.endDate)})`;
}

export function hoursBenchmarkWeekRangeLabel(scoredWeeks: HoursBenchmarkScoredWeeks | null): string {
  if (scoredWeeks == null) return "No scored weeks";
  if (scoredWeeks.fromWeek === scoredWeeks.throughWeek) {
    return `Week ${scoredWeeks.fromWeek}`;
  }
  return `Weeks ${scoredWeeks.fromWeek}–${scoredWeeks.throughWeek}`;
}

export function hoursBenchmarkDateRangeLabel(scoredWeeks: HoursBenchmarkScoredWeeks | null): string {
  if (scoredWeeks == null) return "";
  const start = campusWeekToDateRange(scoredWeeks.fromWeek);
  const end = campusWeekToDateRange(scoredWeeks.throughWeek);
  if (!start || !end) return "";
  return `${formatMonthDay(start.startDate)} – ${formatMonthDayYear(end.endDate)}`;
}

function areaLabel(area: HoursBenchmarkArea): string {
  return area === "front_desk" ? "Front desk" : "Study session";
}

function cellForKind(
  weekNum: number,
  loggedMinutes: number,
  excuseMinutes: number,
  requiredMinutes: number | null,
): HoursBenchmarkCell {
  const pct = completionPct(effectiveMinutes(loggedMinutes, excuseMinutes), requiredMinutes);
  return {
    weekNum,
    completionPercent: pct,
    excuseApplied: excuseMinutes > 0,
  };
}

function emptySummary(): HoursBenchmarkSummary {
  return {
    studentsAtOrBelow50AtLeastOnce: 0,
    atOrBelow50Events: 0,
    zeroPercentEvents: 0,
    studentsMissed80AtLeastOnce: 0,
  };
}

/**
 * Enrolled hour-eligible scholars with FD/SS completion for scored weeks.
 * Heatmap includes only scholars with at least one ≤50% week×area event.
 */
export function assembleHoursBenchmark(
  scholars: HoursBenchmarkScholarInput[],
  currentCampusWeek: number,
  now = new Date(),
): HoursBenchmarkReport {
  const scoredWeeks = hoursBenchmarkScoredWeeks(currentCampusWeek);
  const prepared = hoursBenchmarkPreparedAt(now);
  const weekNumbers =
    scoredWeeks == null
      ? []
      : Array.from(
          { length: scoredWeeks.throughWeek - scoredWeeks.fromWeek + 1 },
          (_, index) => scoredWeeks.fromWeek + index,
        );

  const summary = emptySummary();
  const heatmapScholars: HoursBenchmarkScholarRow[] = [];
  const lowEvents: HoursBenchmarkLowEvent[] = [];
  const tlEvents = new Map<string, { events: number; scholars: Set<string> }>();

  for (const scholar of scholars) {
    if (!isEligibleScholar(scholar)) continue;

    const classYear = scholarYearLabel(scholar.cohort);
    const scholarName = scholarDisplayName(scholar);
    const weeksInRange = scholar.weeks
      .filter(
        (week) =>
          scoredWeeks != null &&
          week.weekNum >= scoredWeeks.fromWeek &&
          week.weekNum <= scoredWeeks.throughWeek,
      )
      .sort((a, b) => a.weekNum - b.weekNum);

    const weekByNum = new Map(weeksInRange.map((week) => [week.weekNum, week]));
    const frontDeskByWeek: HoursBenchmarkCell[] = [];
    const studySessionByWeek: HoursBenchmarkCell[] = [];
    let atOrBelow50Count = 0;
    let missed80 = false;

    for (const weekNum of weekNumbers) {
      const week = weekByNum.get(weekNum);
      const fd = cellForKind(
        weekNum,
        week?.fdLoggedMinutes ?? 0,
        week?.fdExcuseMinutes ?? 0,
        week?.fdRequiredMinutes ?? scholar.fd_required,
      );
      const ss = cellForKind(
        weekNum,
        week?.ssLoggedMinutes ?? 0,
        week?.ssExcuseMinutes ?? 0,
        week?.ssRequiredMinutes ?? scholar.ss_required,
      );
      frontDeskByWeek.push(fd);
      studySessionByWeek.push(ss);

      const scored: Array<{ cell: HoursBenchmarkCell; area: HoursBenchmarkArea }> = [
        { cell: fd, area: "front_desk" },
        { cell: ss, area: "study_session" },
      ];

      for (const { cell, area } of scored) {
        if (cell.completionPercent == null) continue;
        if (cell.completionPercent < HOURS_BENCHMARK_MET_PERCENT) {
          missed80 = true;
        }
        if (cell.completionPercent > HOURS_BENCHMARK_AT_OR_BELOW_PERCENT) continue;

        atOrBelow50Count += 1;
        summary.atOrBelow50Events += 1;
        if (cell.completionPercent === 0) summary.zeroPercentEvents += 1;

        lowEvents.push({
          weekNum,
          weekDateLabel: hoursBenchmarkWeekDateLabel(weekNum),
          area,
          areaLabel: areaLabel(area),
          scholarName,
          classYear: classYear ?? "—",
          teamLeader: scholar.teamLeader,
          completionPercent: cell.completionPercent,
          excuseApplied: cell.excuseApplied,
        });

        const tl = tlEvents.get(scholar.teamLeader) ?? { events: 0, scholars: new Set<string>() };
        tl.events += 1;
        tl.scholars.add(scholar.uid);
        tlEvents.set(scholar.teamLeader, tl);
      }
    }

    if (missed80) summary.studentsMissed80AtLeastOnce += 1;
    if (atOrBelow50Count === 0) continue;

    summary.studentsAtOrBelow50AtLeastOnce += 1;
    heatmapScholars.push({
      scholarId: scholar.uid,
      scholarName,
      isSophomore: classYear === "Sophomore",
      classYear,
      teamLeader: scholar.teamLeader,
      atOrBelow50Count,
      frontDeskByWeek,
      studySessionByWeek,
    });
  }

  heatmapScholars.sort((a, b) => {
    if (b.atOrBelow50Count !== a.atOrBelow50Count) return b.atOrBelow50Count - a.atOrBelow50Count;
    return a.scholarName.localeCompare(b.scholarName, undefined, { sensitivity: "base" });
  });

  lowEvents.sort((a, b) => {
    if (a.completionPercent !== b.completionPercent) return a.completionPercent - b.completionPercent;
    if (a.weekNum !== b.weekNum) return a.weekNum - b.weekNum;
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    return a.scholarName.localeCompare(b.scholarName, undefined, { sensitivity: "base" });
  });

  const byTeamLeader: HoursBenchmarkTeamLeaderRow[] = [...tlEvents.entries()]
    .map(([teamLeader, value]) => ({
      teamLeader,
      atOrBelow50Events: value.events,
      studentCount: value.scholars.size,
    }))
    .sort((a, b) => {
      if (b.atOrBelow50Events !== a.atOrBelow50Events) return b.atOrBelow50Events - a.atOrBelow50Events;
      if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount;
      return a.teamLeader.localeCompare(b.teamLeader, undefined, { sensitivity: "base" });
    });

  return {
    currentCampusWeek,
    scoredWeeks,
    weekNumbers,
    weekRangeLabel: hoursBenchmarkWeekRangeLabel(scoredWeeks),
    dateRangeLabel: hoursBenchmarkDateRangeLabel(scoredWeeks),
    preparedAtLabel: prepared.label,
    printedAtSlug: prepared.slug,
    summary,
    heatmapScholars,
    byTeamLeader,
    lowEvents,
  };
}

/**
 * Hours benchmark from campus week 2 through the previous week.
 * The current week and week 1 are ignored. Minutes come from tickets plus
 * scholar_week_excuses (effective = logged + excuse).
 */
export async function getHoursBenchmarkReport(now = new Date()): Promise<HoursBenchmarkReport> {
  const currentWeek = dateToCampusWeek(now);
  const currentCampusWeek = currentWeek != null && currentWeek >= 1 ? currentWeek : 0;
  if (currentCampusWeek < 1) {
    return assembleHoursBenchmark([], currentCampusWeek, now);
  }

  const scoredWeeks = hoursBenchmarkScoredWeeks(currentCampusWeek);
  const scoredWeekNums =
    scoredWeeks == null
      ? []
      : Array.from(
          { length: scoredWeeks.throughWeek - scoredWeeks.fromWeek + 1 },
          (_, index) => scoredWeeks.fromWeek + index,
        );

  const [weekAttendances, mentorByMenteeUid, users] = await Promise.all([
    Promise.all(scoredWeekNums.map((weekNum) => getCampusWeekAttendance(weekNum))),
    fetchMenteeTeamLeaderNames(),
    fetchAllUsersForMemo(),
  ]);

  const inputs: HoursBenchmarkScholarInput[] = users.map((user) => ({
    uid: user.uid,
    first_name: user.first_name,
    last_name: user.last_name,
    cohort: user.cohort,
    program_role: user.program_role,
    status: user.status,
    fd_required: user.fd_required,
    ss_required: user.ss_required,
    teamLeader: teamLeaderLabelForScholar(user.uid, mentorByMenteeUid),
    weeks: weekAttendances.map((attendance) => {
      const fd = attendance.fdByUid.get(user.uid);
      const ss = attendance.ssByUid.get(user.uid);
      return {
        weekNum: attendance.week_num,
        fdLoggedMinutes: fd?.loggedMin ?? 0,
        fdExcuseMinutes: fd?.excuseMin ?? 0,
        fdRequiredMinutes: user.fd_required,
        ssLoggedMinutes: ss?.loggedMin ?? 0,
        ssExcuseMinutes: ss?.excuseMin ?? 0,
        ssRequiredMinutes: user.ss_required,
      };
    }),
  }));

  return assembleHoursBenchmark(inputs, currentCampusWeek, now);
}
