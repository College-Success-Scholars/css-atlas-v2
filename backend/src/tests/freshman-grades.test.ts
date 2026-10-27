import { describe, expect, it } from "vitest";
import {
  assembleFreshmanGrades,
  averageCappedWeeklyPct,
  cappedWeeklyCompletionPct,
  FRESHMAN_GRADE_WEIGHTS,
  wahfWeekCompletionPct,
  type FreshmanGradeScholarInput,
  type FreshmanGradeWeekInput,
} from "../services/freshman-grades.service.js";
import { freshmanCohortYear, sophomoreCohortYear } from "../services/time.service.js";

const freshman = freshmanCohortYear();
const sophomore = sophomoreCohortYear();

function week(overrides: Partial<FreshmanGradeWeekInput> = {}): FreshmanGradeWeekInput {
  return {
    weekNum: 1,
    fdLoggedMinutes: 0,
    fdExcuseMinutes: 0,
    fdRequiredMinutes: 100,
    ssLoggedMinutes: 0,
    ssExcuseMinutes: 0,
    ssRequiredMinutes: 100,
    wahfStatus: "missing",
    ...overrides,
  };
}

function scholar(overrides: Partial<FreshmanGradeScholarInput> = {}): FreshmanGradeScholarInput {
  return {
    uid: "f-1",
    first_name: "Ada",
    last_name: "Lovelace",
    cohort: freshman,
    program_role: "scholar",
    status: "enrolled",
    fd_required: 100,
    ss_required: 100,
    mentor: "Unassigned",
    weeks: [],
    ...overrides,
  };
}

describe("freshman grade weekly cap", () => {
  it("caps a week above 100% before averaging", () => {
    expect(cappedWeeklyCompletionPct(200, 100)).toBe(100);
    expect(cappedWeeklyCompletionPct(150, 100)).toBe(100);
    expect(averageCappedWeeklyPct([cappedWeeklyCompletionPct(150, 100), cappedWeeklyCompletionPct(150, 100)])).toBe(100);
  });

  it("averages weeks 2 through the previous week and caps each at 100%", () => {
    const report = assembleFreshmanGrades(
      [
        scholar({
          mentor: "Jordan Kim",
          weeks: [
            week({ weekNum: 1, fdLoggedMinutes: 0, fdRequiredMinutes: 100 }),
            week({ weekNum: 2, fdLoggedMinutes: 0, fdRequiredMinutes: 100 }),
            week({ weekNum: 3, fdLoggedMinutes: 100, fdRequiredMinutes: 100 }),
            week({ weekNum: 4, fdLoggedMinutes: 0, fdRequiredMinutes: 100 }),
            week({ weekNum: 5, fdLoggedMinutes: 180, fdExcuseMinutes: 20, fdRequiredMinutes: 100 }),
            week({ weekNum: 6, fdLoggedMinutes: 100, fdRequiredMinutes: 100 }),
          ],
        }),
      ],
      6,
    );
    expect(report.scoredWeeks).toEqual({ fromWeek: 2, throughWeek: 5 });
    expect(report.scholars[0]?.fdPct).toBe(50);
    expect(report.scholars[0]?.scholarId).toBe("f-1");
    expect(report.scholars[0]?.mentor).toBe("Jordan Kim");
    expect(report.scholars[0]?.weeks.map((weekRow) => weekRow.weekNum)).toEqual([2, 3, 4, 5]);
    expect(report.scholars[0]?.weeks[3]).toEqual(
      expect.objectContaining({
        weekNum: 5,
        fd: expect.objectContaining({
          loggedMinutes: 180,
          excuseMinutes: 20,
          effectiveMinutes: 200,
          rawPct: 200,
          cappedPct: 100,
        }),
      }),
    );
  });

  it("skips weeks with null or zero required minutes", () => {
    const report = assembleFreshmanGrades(
      [
        scholar({
          weeks: [
            week({ weekNum: 1, fdLoggedMinutes: 0, fdRequiredMinutes: null }),
            week({ weekNum: 2, fdLoggedMinutes: 0, fdRequiredMinutes: 0 }),
            week({ weekNum: 3, fdLoggedMinutes: 50, fdRequiredMinutes: 100 }),
            week({ weekNum: 4, fdLoggedMinutes: 100, fdRequiredMinutes: 100 }),
          ],
        }),
      ],
      4,
    );
    expect(report.scoredWeeks).toEqual({ fromWeek: 2, throughWeek: 3 });
    expect(report.scholars[0]?.fdPct).toBe(50);
    expect(report.scholars[0]?.weeks.map((weekRow) => weekRow.fd.cappedPct)).toEqual([null, 50]);
  });

  it("leaves a component blank when every week is unscored", () => {
    const report = assembleFreshmanGrades(
      [
        scholar({
          ss_required: 0,
          weeks: [week({ weekNum: 2, ssLoggedMinutes: 80, ssRequiredMinutes: null })],
        }),
      ],
      3,
    );
    expect(report.scholars[0]?.ssPct).toBeNull();
  });
});

describe("freshman grade WAHF and roster", () => {
  it("scores missing WAHF as 0% and late or on-time as 100%", () => {
    expect(wahfWeekCompletionPct("missing")).toBe(0);
    expect(wahfWeekCompletionPct("late")).toBe(100);
    expect(wahfWeekCompletionPct("on-time")).toBe(100);

    const report = assembleFreshmanGrades(
      [
        scholar({
          weeks: [
            week({ weekNum: 1, wahfStatus: "missing" }),
            week({ weekNum: 2, wahfStatus: "missing" }),
            week({ weekNum: 3, wahfStatus: "late" }),
          ],
        }),
      ],
      4,
    );
    expect(report.scoredWeeks).toEqual({ fromWeek: 2, throughWeek: 3 });
    expect(report.scholars[0]?.wahfPct).toBe(50);
    expect(report.scholars[0]?.weeks.map((weekRow) => weekRow.wahfPct)).toEqual([0, 100]);
    expect(report.scholars[0]?.weeks.map((weekRow) => weekRow.weekNum)).toEqual([2, 3]);
    expect(report.scholars[0]?.weeks.map((weekRow) => weekRow.wahfStatus)).toEqual(["missing", "late"]);
  });

  it("keeps 10/10/10 weights and does not emit a semester total", () => {
    const report = assembleFreshmanGrades([scholar({ weeks: [week()] })], 1);
    expect(report.weights).toEqual(FRESHMAN_GRADE_WEIGHTS);
    expect(report.weights).toEqual({ fd: 10, ss: 10, wahf: 10, outOfApp: 70 });
    expect(report).not.toHaveProperty("semesterGrade");
    expect(report.scholars[0]).not.toHaveProperty("semesterGrade");
  });

  it("scores sophomores the same way and omits other cohorts and scholars with no required hours", () => {
    const weeks = [
      week({ weekNum: 2, fdLoggedMinutes: 0 }),
      week({ weekNum: 3, fdLoggedMinutes: 100 }),
    ];
    const report = assembleFreshmanGrades(
      [
        scholar({ uid: "fresh", first_name: "Ada", weeks }),
        scholar({
          uid: "soph",
          first_name: "Grace",
          last_name: "Hopper",
          cohort: sophomore,
          weeks,
        }),
        scholar({
          uid: "junior",
          first_name: "Lin",
          last_name: "Junior",
          cohort: freshman - 2,
          weeks,
        }),
        scholar({
          uid: "no-hours",
          first_name: "Lin",
          fd_required: 0,
          ss_required: 0,
          weeks: [week()],
        }),
        scholar({
          uid: "inactive",
          first_name: "Inactive",
          status: "inactive",
          weeks: [week()],
        }),
      ],
      4,
    );

    expect(report.scholars.map((row) => row.scholarId)).toEqual(["fresh", "soph"]);
    expect(report.scholars.map((row) => row.cohort)).toEqual([freshman, sophomore]);
    expect(report.scholars.map((row) => row.fdPct)).toEqual([50, 50]);
    expect(report.throughWeek).toBe(4);
  });
});
