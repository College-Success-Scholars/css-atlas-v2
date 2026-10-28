import { describe, expect, it } from "vitest";
import {
  assembleHoursBenchmark,
  hoursBenchmarkPdfFilename,
  hoursBenchmarkPreparedAt,
  hoursBenchmarkScoredWeeks,
  type HoursBenchmarkScholarInput,
  type HoursBenchmarkWeekInput,
} from "../services/hours-benchmark.service.js";
import { hoursBenchmarkLeadBlurb } from "../services/hours-benchmark-pdf.service.js";
import { freshmanCohortYear, sophomoreCohortYear } from "../services/time.service.js";

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
