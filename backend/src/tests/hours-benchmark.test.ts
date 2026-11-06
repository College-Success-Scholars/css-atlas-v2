import { describe, expect, it } from "vitest";
import {
  assembleHoursBenchmark,
  buildHoursBenchmarkTutoringBreakdowns,
  hoursBenchmarkPdfFilename,
  hoursBenchmarkPreparedAt,
  hoursBenchmarkScoredWeeks,
  type HoursBenchmarkScholarInput,
  type HoursBenchmarkWeekInput,
} from "../services/hours-benchmark.service.js";
import {
  hoursBenchmarkLeadBlurb,
  renderHoursBenchmarkHtml,
} from "../services/hours-benchmark-pdf.service.js";
import { freshmanCohortYear, sophomoreCohortYear } from "../services/time.service.js";
import type { TutorReportWeekRow } from "../models/tutor-report-log.model.js";

const freshman = freshmanCohortYear();
const sophomore = sophomoreCohortYear();

function week(overrides: Partial<HoursBenchmarkWeekInput> = {}): HoursBenchmarkWeekInput {
  return {
    weekNum: 2,
    fdLoggedMinutes: 100,
    fdExcuseMinutes: 0,
    fdRequiredMinutes: 100,
    ssLoggedMinutes: 100,
    ssExcuseMinutes: 0,
    ssRequiredMinutes: 100,
    ...overrides,
  };
}

function scholar(overrides: Partial<HoursBenchmarkScholarInput> = {}): HoursBenchmarkScholarInput {
  return {
    uid: "s-1",
    first_name: "Ada",
    last_name: "Lovelace",
    cohort: freshman,
    program_role: "scholar",
    status: "enrolled",
    fd_required: 100,
    ss_required: 100,
    teamLeader: "Jordan Kim",
    weeks: [],
    ...overrides,
  };
}

describe("hoursBenchmarkScoredWeeks", () => {
  it("scores week 2 through the previous campus week", () => {
    expect(hoursBenchmarkScoredWeeks(9)).toEqual({ fromWeek: 2, throughWeek: 8 });
    expect(hoursBenchmarkScoredWeeks(2)).toBeNull();
    expect(hoursBenchmarkScoredWeeks(3)).toEqual({ fromWeek: 2, throughWeek: 2 });
  });
});

describe("assembleHoursBenchmark", () => {
  it("builds KPIs, heatmap, TL rollup, and low events for ≤50% weeks", () => {
    const report = assembleHoursBenchmark(
      [
        scholar({
          uid: "s-low",
          first_name: "Duke",
          last_name: "Boateng",
          cohort: sophomore,
          teamLeader: "Jeffrey Beamer Jr.",
          weeks: [
            week({ weekNum: 2, fdLoggedMinutes: 0, ssLoggedMinutes: 0 }),
            week({ weekNum: 3, fdLoggedMinutes: 50, ssLoggedMinutes: 100 }),
            week({ weekNum: 4, fdLoggedMinutes: 80, ssLoggedMinutes: 80 }),
          ],
        }),
        scholar({
          uid: "s-ok",
          first_name: "On",
          last_name: "Track",
          teamLeader: "Jordan Kim",
          weeks: [
            week({ weekNum: 2, fdLoggedMinutes: 100, ssLoggedMinutes: 100 }),
            week({ weekNum: 3, fdLoggedMinutes: 90, ssLoggedMinutes: 90 }),
            week({ weekNum: 4, fdLoggedMinutes: 100, ssLoggedMinutes: 100 }),
          ],
        }),
        scholar({
          uid: "s-amber",
          first_name: "Almost",
          last_name: "There",
          teamLeader: "Jeffrey Beamer Jr.",
          weeks: [
            week({ weekNum: 2, fdLoggedMinutes: 60, ssLoggedMinutes: 100 }),
            week({ weekNum: 3, fdLoggedMinutes: 100, ssLoggedMinutes: 100 }),
            week({ weekNum: 4, fdLoggedMinutes: 100, ssLoggedMinutes: 100 }),
          ],
        }),
      ],
      5,
      new Date("2026-10-27T16:00:00.000Z"),
    );

    expect(report.scoredWeeks).toEqual({ fromWeek: 2, throughWeek: 4 });
    expect(report.weekNumbers).toEqual([2, 3, 4]);
    expect(report.summary).toEqual({
      studentsAtOrBelow50AtLeastOnce: 1,
      atOrBelow50Events: 3,
      zeroPercentEvents: 2,
      studentsMissed80AtLeastOnce: 2,
    });

    expect(report.heatmapScholars).toHaveLength(1);
    expect(report.heatmapScholars[0]).toMatchObject({
      scholarName: "Duke Boateng",
      isSophomore: true,
      teamLeader: "Jeffrey Beamer Jr.",
      atOrBelow50Count: 3,
    });
    expect(report.heatmapScholars[0]?.frontDeskByWeek.map((cell) => cell.completionPercent)).toEqual([0, 50, 80]);
    expect(report.heatmapScholars[0]?.studySessionByWeek.map((cell) => cell.completionPercent)).toEqual([0, 100, 80]);

    expect(report.allHeatmapScholars.map((row) => row.scholarName)).toEqual([
      "Almost There",
      "Duke Boateng",
      "On Track",
    ]);
    expect(report.allHeatmapScholars.find((row) => row.scholarName === "On Track")?.atOrBelow50Count).toBe(0);

    expect(report.byTeamLeader).toEqual([
      { teamLeader: "Jeffrey Beamer Jr.", atOrBelow50Events: 3, studentCount: 1 },
    ]);

    expect(report.lowEvents.map((event) => ({
      weekNum: event.weekNum,
      area: event.area,
      pct: event.completionPercent,
    }))).toEqual([
      { weekNum: 2, area: "front_desk", pct: 0 },
      { weekNum: 2, area: "study_session", pct: 0 },
      { weekNum: 3, area: "front_desk", pct: 50 },
    ]);
  });

  it("marks excuseApplied and counts excused minutes toward completion", () => {
    const report = assembleHoursBenchmark(
      [
        scholar({
          weeks: [
            week({
              weekNum: 2,
              fdLoggedMinutes: 40,
              fdExcuseMinutes: 10,
              fdRequiredMinutes: 100,
              ssLoggedMinutes: 100,
            }),
          ],
        }),
      ],
      3,
    );

    expect(report.heatmapScholars[0]?.frontDeskByWeek[0]).toEqual({
      weekNum: 2,
      completionPercent: 50,
      excuseApplied: true,
    });
    expect(report.lowEvents[0]?.excuseApplied).toBe(true);
  });

  it("returns an empty report when there are no scored weeks", () => {
    const report = assembleHoursBenchmark([scholar({ weeks: [week()] })], 2);
    expect(report.scoredWeeks).toBeNull();
    expect(report.heatmapScholars).toEqual([]);
    expect(report.allHeatmapScholars).toHaveLength(1);
    expect(report.summary.atOrBelow50Events).toBe(0);
    expect(report.tutoringByScholar).toEqual([]);
    expect(report.tutoringByTutor).toEqual([]);
    expect(report.tutoringByDay).toEqual([]);
  });
});

function tutorRow(overrides: Partial<TutorReportWeekRow> = {}): TutorReportWeekRow {
  return {
    id: 1,
    created_at: null,
    date: "2026-09-08",
    tutor_name: "Alex Tutor",
    scholar_uid: "s-ada",
    end_time: "2026-09-08T19:00:00.000Z",
    start_time: "2026-09-08T18:00:00.000Z",
    courses: ["MATH140"],
    scholar_name: "Ada Lovelace",
    day_of_week: "Tue",
    ...overrides,
  };
}

describe("buildHoursBenchmarkTutoringBreakdowns", () => {
  it("drops empty sessions and sorts scholar/tutor alpha and days Mon–Sun", () => {
    const breakdowns = buildHoursBenchmarkTutoringBreakdowns([
      tutorRow({
        id: 1,
        tutor_name: "Zoe Tutor",
        scholar_uid: "s-zoe-scholar",
        scholar_name: "Zoe Scholar",
        date: "2026-09-11",
        day_of_week: "Fri",
      }),
      tutorRow({
        id: 2,
        tutor_name: "Alex Tutor",
        scholar_uid: "s-ada",
        scholar_name: "Ada Lovelace",
        date: "2026-09-08",
        day_of_week: "Tue",
      }),
      tutorRow({
        id: 3,
        tutor_name: "Alex Tutor",
        scholar_uid: "s-blake",
        scholar_name: "Blake Scholar",
        date: "2026-09-07",
        day_of_week: "Mon",
      }),
      tutorRow({
        id: 4,
        tutor_name: "Mia Tutor",
        scholar_uid: "n/a",
        scholar_name: "EMPTY SESSION",
        date: "2026-09-09",
        day_of_week: "Wed",
      }),
      tutorRow({
        id: 5,
        tutor_name: "Alex Tutor",
        scholar_uid: "s-ada",
        scholar_name: "Ada Lovelace",
        date: "2026-09-14",
        day_of_week: "Mon",
      }),
    ]);

    expect(breakdowns.tutoringByScholar.map((group) => group.title)).toEqual([
      "Ada Lovelace",
      "Blake Scholar",
      "Zoe Scholar",
    ]);
    expect(breakdowns.tutoringByTutor.map((group) => group.title)).toEqual([
      "Alex Tutor",
      "Zoe Tutor",
    ]);
    expect(breakdowns.tutoringByDay.map((group) => group.title)).toEqual(["Mon", "Tue", "Fri"]);

    const ada = breakdowns.tutoringByScholar[0];
    expect(ada?.sessions.map((session) => session.tutorName)).toEqual(["Alex Tutor", "Alex Tutor"]);
    expect(ada?.sessions.map((session) => session.dateKey)).toEqual(["2026-09-08", "2026-09-14"]);

    const alex = breakdowns.tutoringByTutor[0];
    expect(alex?.sessions.map((session) => session.scholarName)).toEqual([
      "Ada Lovelace",
      "Ada Lovelace",
      "Blake Scholar",
    ]);

    expect(breakdowns.tutoringByDay[0]?.sessions.map((session) => session.scholarName)).toEqual([
      "Ada Lovelace",
      "Blake Scholar",
    ]);
  });

  it("returns empty groups when only empty sessions exist", () => {
    expect(
      buildHoursBenchmarkTutoringBreakdowns([
        tutorRow({ scholar_uid: "111111111", scholar_name: "EMPTY SESSION" }),
      ]),
    ).toEqual({
      tutoringByScholar: [],
      tutoringByTutor: [],
      tutoringByDay: [],
    });
  });
});

describe("renderHoursBenchmarkHtml tutoring appendices", () => {
  it("includes the three tutoring headings and printout-style day rows", () => {
    const report = {
      ...assembleHoursBenchmark([], 5, new Date("2026-10-27T16:00:00.000Z")),
      ...buildHoursBenchmarkTutoringBreakdowns([
        tutorRow({
          id: 10,
          tutor_name: "Alex Tutor",
          scholar_name: "Ada Lovelace",
          day_of_week: "Tue",
          date: "2026-09-08",
        }),
      ]),
    };
    const html = renderHoursBenchmarkHtml(report, "low");
    expect(html).toContain("Tutoring by scholar");
    expect(html).toContain("Tutoring by tutor");
    expect(html).toContain("Tutoring by day");
    expect(html).toContain('<div class="tutoring-day"><div>Tue</div>');
    expect(html).toContain("<span>Alex Tutor</span><b>Ada Lovelace</b>");
  });
});

describe("hoursBenchmarkPreparedAt and filename", () => {
  it("builds an Eastern prepared label and filename slug", () => {
    const printed = hoursBenchmarkPreparedAt(new Date("2026-10-27T16:00:00.000Z"));
    expect(printed.label).toMatch(/Oct 27, 2026/);
    expect(hoursBenchmarkPdfFilename({ fromWeek: 2, throughWeek: 8 }, printed.slug)).toBe(
      `hours-benchmark-weeks-2-8-${printed.slug}.pdf`,
    );
    expect(hoursBenchmarkPdfFilename({ fromWeek: 2, throughWeek: 8 }, printed.slug, "all")).toBe(
      `hours-benchmark-weeks-2-8-all-${printed.slug}.pdf`,
    );
  });
});

describe("hoursBenchmarkLeadBlurb", () => {
  it("names the top scholars like the reference paper", () => {
    const report = assembleHoursBenchmark(
      [
        scholar({
          uid: "a",
          first_name: "Duke",
          last_name: "Boateng",
          cohort: sophomore,
          weeks: [
            week({ weekNum: 2, fdLoggedMinutes: 0, ssLoggedMinutes: 0 }),
            week({ weekNum: 3, fdLoggedMinutes: 0, ssLoggedMinutes: 0 }),
          ],
        }),
        scholar({
          uid: "b",
          first_name: "Johnny",
          last_name: "Yameny",
          weeks: [week({ weekNum: 2, fdLoggedMinutes: 0, ssLoggedMinutes: 100 })],
        }),
      ],
      4,
    );
    expect(hoursBenchmarkLeadBlurb(report)).toContain("fell to 50% or lower");
    expect(hoursBenchmarkLeadBlurb(report)).toContain("Duke Boateng");
    expect(hoursBenchmarkLeadBlurb(report)).toContain("The benchmark is 80%");
  });
});
