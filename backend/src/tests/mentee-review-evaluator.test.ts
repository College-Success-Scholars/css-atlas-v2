import { describe, expect, it } from "vitest";
import {
  addEasternCalendarDays,
  campusWeekToDateRange,
  getEasternDateParts,
} from "../services/time.service.js";
import { easternTimestamp } from "../services/shift-occurrence.service.js";
import {
  deriveLatestGrades,
  evaluateTutoring,
  evaluateWahf,
  evaluateWeek,
  hourBandForPercent,
  normalizeWeekIntervals,
  parseGradePercent,
  positiveOverlapMs,
} from "../services/mentee-review-evaluator.js";
import type {
  EvaluateWeekInput,
  GradeSubmissionInput,
  LoggedIntervalInput,
  ScheduledShiftInput,
  ShiftSessionKind,
  TutoringEvidenceInput,
} from "../models/mentee-review.model.js";

const WEEK_1 = campusWeekToDateRange(1)!;
const WEEK_9 = campusWeekToDateRange(9)!; // Oct 26 – Nov 1, 2026 (DST fall-back on the Sunday)
const MS_PER_MINUTE = 60_000;

function localDay(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function at(date: Date, time: string): Date {
  return easternTimestamp(date, time);
}

function shift(
  sourceId: string,
  kind: ShiftSessionKind,
  date: Date,
  startTime: string,
  endTime: string
): ScheduledShiftInput {
  return { sourceId, kind, date: localDay(date), startTime, endTime };
}

function logMs(
  sourceId: string,
  kind: ShiftSessionKind,
  start: Date,
  minutes: number
): LoggedIntervalInput {
  return { sourceId, kind, start, end: new Date(start.getTime() + minutes * MS_PER_MINUTE) };
}

function baseInput(overrides: Partial<EvaluateWeekInput> = {}): EvaluateWeekInput {
  const weekStart = WEEK_1.startDate;
  const weekEnd = WEEK_1.endDate;
  return {
    weekNumber: 1,
    weekStart,
    weekEnd,
    asOf: at(weekStart, "12:00"),
    shifts: [],
    logs: [],
    targets: { front_desk: null, study_session: null },
    wahf: { available: true, dueAt: at(weekStart, "23:59"), submission: null },
    tutoring: { available: true, reports: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Task 2.3 — interval normalization
// ---------------------------------------------------------------------------

describe("normalizeWeekIntervals", () => {
  const weekStartMs = WEEK_1.startDate.getTime();
  const weekEndMs = addEasternCalendarDays(WEEK_1.endDate, 1).getTime();

  it("does not merge a boundary touch (zero overlap)", () => {
    const t = weekStartMs + 8 * 60 * MS_PER_MINUTE;
    const merged = normalizeWeekIntervals(
      [
        { sourceId: "a", kind: "front_desk", start: new Date(t), end: new Date(t + 60 * MS_PER_MINUTE) },
        { sourceId: "b", kind: "front_desk", start: new Date(t + 60 * MS_PER_MINUTE), end: new Date(t + 120 * MS_PER_MINUTE) },
      ],
      weekStartMs,
      weekEndMs
    );
    expect(merged).toHaveLength(2);
  });

  it("merges strictly overlapping intervals and preserves source IDs", () => {
    const t = weekStartMs + 8 * 60 * MS_PER_MINUTE;
    const merged = normalizeWeekIntervals(
      [
        { sourceId: "a", kind: "front_desk", start: new Date(t), end: new Date(t + 90 * MS_PER_MINUTE) },
        { sourceId: "b", kind: "front_desk", start: new Date(t + 60 * MS_PER_MINUTE), end: new Date(t + 120 * MS_PER_MINUTE) },
      ],
      weekStartMs,
      weekEndMs
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.end.getTime() - merged[0]!.start.getTime()).toBe(120 * MS_PER_MINUTE);
    expect(merged[0]!.sourceIds.sort()).toEqual(["a", "b"]);
  });

  it("clips intervals to the week and drops intervals entirely outside", () => {
    const merged = normalizeWeekIntervals(
      [
        { sourceId: "before", kind: "front_desk", start: new Date(weekStartMs - 30 * MS_PER_MINUTE), end: new Date(weekStartMs + 30 * MS_PER_MINUTE) },
        { sourceId: "after", kind: "front_desk", start: new Date(weekEndMs - 30 * MS_PER_MINUTE), end: new Date(weekEndMs + 30 * MS_PER_MINUTE) },
        { sourceId: "outside", kind: "front_desk", start: new Date(weekEndMs + 10 * MS_PER_MINUTE), end: new Date(weekEndMs + 60 * MS_PER_MINUTE) },
      ],
      weekStartMs,
      weekEndMs
    );
    expect(merged.map((m) => m.sourceIds[0])).toEqual(["before", "after"]);
    expect(merged[0]!.start.getTime()).toBe(weekStartMs);
    expect(merged[1]!.end.getTime()).toBe(weekEndMs);
  });
});

describe("positiveOverlapMs", () => {
  it("returns 0 for a boundary touch and positive value for real overlap", () => {
    expect(positiveOverlapMs(0, 60, 60, 120)).toBe(0);
    expect(positiveOverlapMs(0, 60, 30, 120)).toBe(30);
    expect(positiveOverlapMs(0, 60, 90, 120)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tasks 2.2 / 2.4 — week bounds, hours, bands, display
// ---------------------------------------------------------------------------

describe("hour bands and display", () => {
  it("is green at exactly 90% with one-decimal display and no pending", () => {
    const start = at(WEEK_1.startDate, "13:00");
    const summary = evaluateWeek(
      baseInput({
        targets: { front_desk: 300 },
        logs: [logMs("l1", "front_desk", start, 270)], // 4.5h = 90% of 5h
      })
    );
    const fd = summary.hours[0]!;
    expect(fd.percent).toBeCloseTo(90, 10);
    expect(fd.band).toBe("green");
    expect(fd.targetMinutes).toBe(300);
    expect(fd.displayHours).toBe(4.5);
    expect(fd.pending).toBe(false);
    expect(fd.overageMinutes).toBe(0);
  });

  it("is orange at exactly 60% and red just below", () => {
    expect(hourBandForPercent(60)).toBe("orange");
    expect(hourBandForPercent(59.999)).toBe("red");
    expect(hourBandForPercent(89.999)).toBe("orange");
    expect(hourBandForPercent(90)).toBe("green");
  });

  it("does not let display rounding change classification just below 90%", () => {
    const start = at(WEEK_1.startDate, "13:00");
    const summary = evaluateWeek(
      baseInput({
        targets: { front_desk: 300 },
        logs: [logMs("l1", "front_desk", start, 269.9)], // 89.97% → orange, displays 4.5
      })
    );
    const fd = summary.hours[0]!;
    expect(fd.band).toBe("orange");
    expect(fd.displayHours).toBe(4.5);
  });

  it("reports overage as whole minutes only above target", () => {
    const start = at(WEEK_1.startDate, "13:00");
    const above = evaluateWeek(
      baseInput({ targets: { front_desk: 300 }, logs: [logMs("l1", "front_desk", start, 336)] }) // 5.6h
    );
    expect(above.hours[0]!.displayHours).toBe(5.6);
    expect(above.hours[0]!.overageMinutes).toBe(36);

    const below = evaluateWeek(
      baseInput({ targets: { front_desk: 300 }, logs: [logMs("l1", "front_desk", start, 270)] })
    );
    expect(below.hours[0]!.overageMinutes).toBe(0);
  });

  it("treats missing or nonpositive targets as unavailable, not divide-by-zero success", () => {
    const start = at(WEEK_1.startDate, "13:00");
    for (const target of [null, 0, -3]) {
      const summary = evaluateWeek(
        baseInput({ targets: { front_desk: target }, logs: [logMs("l1", "front_desk", start, 120)] })
      );
      const fd = summary.hours[0]!;
      expect(fd.percent).toBeNull();
      expect(fd.band).toBeNull();
      expect(fd.targetMinutes).toBeNull();
      expect(fd.pending).toBe(false);
    }
  });

  it("marks an unfinished current week below 90% as pending and green weeks as not pending", () => {
    const start = at(WEEK_1.startDate, "13:00");
    const pending = evaluateWeek(
      baseInput({ targets: { front_desk: 300 }, logs: [logMs("l1", "front_desk", start, 240)] }) // 80% → orange
    );
    expect(pending.hours[0]!.pending).toBe(true);
    expect(pending.hours[0]!.band).toBe("orange");
  });

  it("does not mark a past week as pending", () => {
    const summary = evaluateWeek(
      baseInput({
        asOf: addEasternCalendarDays(WEEK_1.endDate, 3),
        targets: { front_desk: 300 },
        logs: [logMs("l1", "front_desk", at(WEEK_1.startDate, "13:00"), 120)],
      })
    );
    expect(summary.phase).toBe("past");
    expect(summary.hours[0]!.pending).toBe(false);
    expect(summary.hours[0]!.band).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// Task 2.5 — shift classification
// ---------------------------------------------------------------------------

describe("scheduled shift classification", () => {
  it("classifies attended, active, and upcoming around asOf", () => {
    const day = WEEK_1.startDate;
    const summary = evaluateWeek(
      baseInput({
        asOf: at(day, "12:00"),
        shifts: [
          shift("s1", "front_desk", day, "09:00", "11:00"),
          shift("s2", "front_desk", day, "11:00", "13:00"),
          shift("s3", "front_desk", day, "15:00", "16:00"),
        ],
        logs: [logMs("l1", "front_desk", at(day, "09:00"), 120)],
      })
    );
    expect(summary.hours[0]!.shifts.map((s) => s.status)).toEqual([
      "attended",
      "active",
      "upcoming",
    ]);
  });

  it("never marks an active or upcoming shift as a no-show", () => {
    const day = WEEK_1.startDate;
    const summary = evaluateWeek(
      baseInput({
        asOf: at(day, "09:30"),
        shifts: [
          shift("s1", "front_desk", day, "09:00", "11:00"),
          shift("s2", "front_desk", day, "15:00", "16:00"),
        ],
      })
    );
    expect(summary.hours[0]!.noShowCount).toBe(0);
    expect(summary.hours[0]!.shifts.map((s) => s.status)).toEqual(["active", "upcoming"]);
  });

  it("treats exactly 75% as attended and just below as short", () => {
    const day = WEEK_1.startDate;
    const scheduled = [shift("s1", "front_desk", day, "10:00", "12:00")];

    const attended = evaluateWeek(
      baseInput({ asOf: at(day, "12:30"), shifts: scheduled, logs: [logMs("l1", "front_desk", at(day, "10:00"), 90)] })
    );
    expect(attended.hours[0]!.shifts[0]!.status).toBe("attended");

    const short = evaluateWeek(
      baseInput({ asOf: at(day, "12:30"), shifts: scheduled, logs: [logMs("l1", "front_desk", at(day, "10:00"), 89)] })
    );
    expect(short.hours[0]!.shifts[0]!.status).toBe("short");
  });

  it("keeps a no-show independent of a met weekly total", () => {
    const day = WEEK_1.startDate;
    const summary = evaluateWeek(
      baseInput({
        asOf: at(day, "12:00"),
        targets: { front_desk: 300 },
        shifts: [shift("s1", "front_desk", day, "10:00", "11:00")],
        logs: [logMs("l1", "front_desk", at(day, "13:00"), 300)], // 5h off-shift
      })
    );
    const fd = summary.hours[0]!;
    expect(fd.band).toBe("green");
    expect(fd.noShowCount).toBe(1);
    expect(fd.shifts[0]!.status).toBe("no_show");
    expect(fd.offShiftLogs).toHaveLength(1);
  });

  it("does not double count overlapping logs against a shift or the total", () => {
    const day = WEEK_1.startDate;
    const summary = evaluateWeek(
      baseInput({
        targets: { front_desk: 120 },
        shifts: [shift("s1", "front_desk", day, "10:00", "12:00")],
        logs: [
          logMs("l1", "front_desk", at(day, "10:00"), 90),
          logMs("l2", "front_desk", at(day, "10:30"), 90), // overlaps l1
        ],
      })
    );
    const fd = summary.hours[0]!;
    expect(fd.loggedMinutes).toBe(120); // merged, not 180
    expect(fd.shifts[0]!.overlapMinutes).toBe(120);
    expect(fd.shifts[0]!.status).toBe("attended");
  });

  it("reports no assignments neutrally and treats missing activity as absence of activity", () => {
    const summary = evaluateWeek(baseInput({ targets: { front_desk: 300 } }));
    const fd = summary.hours[0]!;
    expect(fd.assignmentAvailable).toBe(false);
    expect(fd.hasActivity).toBe(false);
    expect(fd.noShowCount).toBe(0);
    expect(fd.loggedMinutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tasks 2.6 / 2.7 — WAHF and tutoring
// ---------------------------------------------------------------------------

describe("evaluateWahf", () => {
  const dueAt = at(WEEK_1.endDate, "23:59");

  it("is unknown when the source is unavailable, never missing", () => {
    const s = evaluateWahf({ available: false, dueAt, submission: null }, at(WEEK_1.startDate, "12:00"));
    expect(s.status).toBe("unknown");
  });

  it("is pending before the due instant and missing after with no submission", () => {
    const before = evaluateWahf({ available: true, dueAt, submission: null }, new Date(dueAt.getTime() - MS_PER_MINUTE));
    expect(before.status).toBe("pending");
    const after = evaluateWahf({ available: true, dueAt, submission: null }, new Date(dueAt.getTime() + MS_PER_MINUTE));
    expect(after.status).toBe("missing");
  });

  it("flags on-time and late submissions", () => {
    const onTime = evaluateWahf(
      { available: true, dueAt, submission: { sourceId: "w1", submittedAt: new Date(dueAt.getTime() - 1000) } },
      dueAt
    );
    expect(onTime.status).toBe("submitted");
    expect(onTime.onTime).toBe(true);

    const late = evaluateWahf(
      { available: true, dueAt, submission: { sourceId: "w2", submittedAt: new Date(dueAt.getTime() + 1000) } },
      dueAt
    );
    expect(late.status).toBe("submitted");
    expect(late.onTime).toBe(false);
  });
});

describe("evaluateTutoring", () => {
  it("is unknown on read failure and none on a successful empty read", () => {
    expect(evaluateTutoring({ available: false, reports: [] }).status).toBe("unknown");
    const none = evaluateTutoring({ available: true, reports: [] });
    expect(none.status).toBe("none");
    expect(none.recordedAttendance).toBe(false);
  });

  it("keeps multiple courses in one report as a single session and merges duplicate rows", () => {
    const evidence: TutoringEvidenceInput = {
      available: true,
      reports: [
        { reportId: "r1", date: "2026-08-31", startTime: "10:00", endTime: "11:00", courses: ["CMSC420"] },
        { reportId: "r1", date: "2026-08-31", startTime: "10:00", endTime: "11:00", courses: ["MATH141"] },
      ],
    };
    const summary = evaluateTutoring(evidence);
    expect(summary.status).toBe("recorded");
    expect(summary.recordedAttendance).toBe(true);
    expect(summary.reports).toHaveLength(1);
    expect(summary.reports[0]!.courses.sort()).toEqual(["CMSC420", "MATH141"]);
  });
});

// ---------------------------------------------------------------------------
// Task 2.8 — latest grades
// ---------------------------------------------------------------------------

function submission(
  sourceId: string,
  submittedAt: Date,
  entries: { course: string; assessment: string; rawGrade: string }[]
): GradeSubmissionInput {
  return { sourceId, submittedAt, entries };
}

describe("parseGradePercent", () => {
  it("accepts explicit percents and bare 0–100 numbers, rejects the rest", () => {
    expect(parseGradePercent("90%")).toBe(90);
    expect(parseGradePercent(" 85 ")).toBe(85);
    expect(parseGradePercent("A")).toBeNull();
    expect(parseGradePercent("A-")).toBeNull();
    expect(parseGradePercent("9/10")).toBeNull();
    expect(parseGradePercent("150")).toBeNull();
    expect(parseGradePercent("")).toBeNull();
    expect(parseGradePercent(null)).toBeNull();
  });
});

describe("deriveLatestGrades", () => {
  const asOf = new Date("2026-08-08T12:00:00Z");

  it("keeps other recent grades when the latest submission has no grades", () => {
    const summary = deriveLatestGrades({
      available: true,
      submissions: [
        submission("old", new Date("2026-08-01T00:00:00Z"), [
          { course: "CMSC420", assessment: "Exam", rawGrade: "90%" },
        ]),
        submission("new", new Date("2026-08-08T00:00:00Z"), []),
      ],
    }, asOf);
    expect(summary.status).toBe("grades");
    expect(summary.submissionId).toBe("new");
    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0]).toMatchObject({ submissionId: "old", submittedAt: new Date("2026-08-01T00:00:00Z") });
  });

  it("is an error when unavailable, never empty", () => {
    expect(deriveLatestGrades({ available: false, submissions: [] }, asOf).status).toBe("error");
  });

  it("reports first grade, direction, and equal comparison", () => {
    const first = deriveLatestGrades({
      available: true,
      submissions: [submission("s1", new Date("2026-08-01T00:00:00Z"), [{ course: "C", assessment: "Q1", rawGrade: "80" }])],
    }, asOf);
    expect(first.entries[0]!.firstGrade).toBe(true);
    expect(first.entries[0]!.comparison).toBeNull();

    const up = deriveLatestGrades({
      available: true,
      submissions: [
        submission("s1", new Date("2026-08-01T00:00:00Z"), [{ course: "C", assessment: "Q1", rawGrade: "80" }]),
        submission("s2", new Date("2026-08-08T00:00:00Z"), [{ course: "C", assessment: "Q2", rawGrade: "90" }]),
      ],
    }, asOf);
    expect(up.status).toBe("grades");
    expect(up.entries).toHaveLength(2);
    expect(up.entries[0]!.comparison).toEqual({ direction: "up", priorPercent: 80, priorAssessment: "Q1" });

    const equal = deriveLatestGrades({
      available: true,
      submissions: [
        submission("s1", new Date("2026-08-01T00:00:00Z"), [{ course: "C", assessment: "Q1", rawGrade: "85" }]),
        submission("s2", new Date("2026-08-08T00:00:00Z"), [{ course: "C", assessment: "Q2", rawGrade: "85" }]),
      ],
    }, asOf);
    expect(equal.entries[0]!.comparison!.direction).toBe("equal");
  });

  it("omits comparison for unsupported scores without inventing a direction", () => {
    const summary = deriveLatestGrades({
      available: true,
      submissions: [
        submission("s1", new Date("2026-08-01T00:00:00Z"), [{ course: "C", assessment: "Q1", rawGrade: "90" }]),
        submission("s2", new Date("2026-08-08T00:00:00Z"), [{ course: "C", assessment: "Q2", rawGrade: "A" }]),
      ],
    }, asOf);
    expect(summary.status).toBe("grades");
    expect(summary.entries[0]!.percent).toBeNull();
    expect(summary.entries[0]!.band).toBeNull();
    expect(summary.entries[0]!.comparison).toBeNull();
    expect(summary.entries[0]!.firstGrade).toBe(false);
  });

  it("shows all recent submissions newest first, preserving repeated entries and observed entry order", () => {
    const repeated = { course: "C", assessment: "Quiz", rawGrade: "90" };
    const submissions = [
      submission("previous", new Date("2026-09-08T16:00:00Z"), [repeated]),
      submission("empty", new Date("2026-09-16T16:00:00Z"), []),
      submission("current", new Date("2026-09-15T16:00:00Z"), [
        { course: "Z", assessment: "Exam", rawGrade: "85" }, repeated, repeated,
      ]),
    ];
    const summary = deriveLatestGrades({ available: true, submissions }, new Date("2026-09-17T16:00:00Z"));

    expect(summary.status).toBe("grades");
    expect(summary.submissionId).toBe("empty");
    expect(summary.entries.map((entry) => [entry.submissionId, entry.course])).toEqual([
      ["current", "Z"], ["current", "C"], ["current", "C"], ["previous", "C"],
    ]);
    expect(summary.entries[1]!.comparison?.direction).toBe("equal");
    expect(summary.entries[2]!.comparison?.direction).toBe("equal");
    expect(summary.entries[3]!.firstGrade).toBe(true);
    expect(submissions.map((entry) => entry.sourceId)).toEqual(["previous", "empty", "current"]);
  });

  it("includes the previous Monday and asOf exactly, excluding stale and future submissions", () => {
    const summary = deriveLatestGrades({ available: true, submissions: [
      submission("stale", new Date("2026-09-07T03:59:59.999Z"), [{ course: "C", assessment: "Old", rawGrade: "70" }]),
      submission("start", new Date("2026-09-07T04:00:00Z"), [{ course: "C", assessment: "Previous", rawGrade: "80" }]),
      submission("now", new Date("2026-09-17T16:00:00Z"), [{ course: "C", assessment: "Current", rawGrade: "90" }]),
      submission("future", new Date("2026-09-17T16:00:00.001Z"), [{ course: "C", assessment: "Future", rawGrade: "95" }]),
      submission("future-sunday", new Date("2026-09-21T03:59:59Z"), [{ course: "C", assessment: "Sunday", rawGrade: "95" }]),
      submission("next-week", new Date("2026-09-21T04:00:00Z"), [{ course: "C", assessment: "Next", rawGrade: "95" }]),
    ] }, new Date("2026-09-17T16:00:00Z"));

    expect(summary.submissionId).toBe("now");
    expect(summary.entries.map((entry) => entry.submissionId)).toEqual(["now", "start"]);
    expect(summary.entries[0]!.comparison).toMatchObject({ priorPercent: 80, priorAssessment: "Previous" });
    expect(summary.entries[1]!.comparison).toMatchObject({ priorPercent: 70, priorAssessment: "Old" });
  });

  it("rolls the window at Eastern Monday midnight, not UTC midnight or a rolling duration", () => {
    const evidence = { available: true, submissions: [
      submission("previous", new Date("2026-08-31T04:00:00Z"), [{ course: "C", assessment: "Quiz", rawGrade: "80" }]),
    ] };
    expect(deriveLatestGrades(evidence, new Date("2026-09-14T03:59:59.999Z")).entries).toHaveLength(1);
    expect(deriveLatestGrades(evidence, new Date("2026-09-14T04:00:00Z"))).toEqual({
      status: "empty", submissionId: null, submittedAt: null, entries: [],
    });
  });

  it.each([
    ["fall-back Sunday", "2026-11-01T17:00:00Z", "2026-10-19T04:00:00Z"],
    ["Monday after fall-back", "2026-11-02T17:00:00Z", "2026-10-26T04:00:00Z"],
    ["spring-forward Sunday", "2027-03-14T16:00:00Z", "2027-03-01T05:00:00Z"],
    ["Monday after spring-forward", "2027-03-15T16:00:00Z", "2027-03-08T05:00:00Z"],
    ["during winter break", "2027-01-15T17:00:00Z", "2027-01-04T05:00:00Z"],
    ["after winter break", "2027-01-28T17:00:00Z", "2027-01-18T05:00:00Z"],
    ["across New Year", "2027-01-01T17:00:00Z", "2026-12-21T05:00:00Z"],
  ])("uses real Monday–Sunday calendar weeks %s", (_label, now, start) => {
    const startDate = new Date(start);
    const summary = deriveLatestGrades({ available: true, submissions: [
      submission("outside", new Date(startDate.getTime() - 1), [{ course: "C", assessment: "Old", rawGrade: "70" }]),
      submission("inside", startDate, [{ course: "C", assessment: "New", rawGrade: "90" }]),
    ] }, new Date(now));

    expect(summary.entries.map((entry) => entry.submissionId)).toEqual(["inside"]);
    expect(summary.entries[0]!.comparison?.priorPercent).toBe(70);
  });

  it("keeps both repeated fall-back clock times as distinct submissions", () => {
    const summary = deriveLatestGrades({ available: true, submissions: [
      submission("edt", new Date("2026-11-01T05:30:00Z"), [{ course: "C", assessment: "Quiz", rawGrade: "80" }]),
      submission("est", new Date("2026-11-01T06:30:00Z"), [{ course: "C", assessment: "Quiz", rawGrade: "80" }]),
    ] }, new Date("2026-11-01T17:00:00Z"));
    expect(summary.entries.map((entry) => entry.submissionId)).toEqual(["est", "edt"]);
  });

  it("keeps source submission order for timestamp ties and compares earlier same-course entries", () => {
    const summary = deriveLatestGrades({ available: true, submissions: [
      submission("first", asOf, [
        { course: "C", assessment: "Q1", rawGrade: "90" },
        { course: "C", assessment: "Q2", rawGrade: "80" },
      ]),
      submission("second", asOf, [{ course: "C", assessment: "Q3", rawGrade: "80" }]),
    ] }, asOf);
    expect(summary.entries.map((entry) => [entry.submissionId, entry.assessment])).toEqual([
      ["first", "Q1"], ["first", "Q2"], ["second", "Q3"],
    ]);
    expect(summary.entries[0]!.firstGrade).toBe(true);
    expect(summary.entries[1]!.comparison).toEqual({ direction: "down", priorPercent: 90, priorAssessment: "Q1" });
    expect(summary.entries[2]!.comparison).toEqual({ direction: "equal", priorPercent: 80, priorAssessment: "Q2" });
  });

  it("does not revive stale grades when the recent submissions are all empty", () => {
    expect(deriveLatestGrades({ available: true, submissions: [
      submission("stale", new Date("2026-07-01T16:00:00Z"), [{ course: "C", assessment: "Old", rawGrade: "90" }]),
      submission("empty", asOf, []),
    ] }, asOf)).toEqual({ status: "empty", submissionId: "empty", submittedAt: asOf, entries: [] });
  });

  it("uses older numeric history across unsupported entries without calling a course new", () => {
    const summary = deriveLatestGrades({ available: true, submissions: [
      submission("history", new Date("2026-07-01T16:00:00Z"), [
        { course: "C", assessment: "Old exam", rawGrade: "75" },
        { course: "D", assessment: "Old quiz", rawGrade: "A" },
      ]),
      submission("unsupported", new Date("2026-08-07T16:00:00Z"), [{ course: "C", assessment: "Letter", rawGrade: "A" }]),
      submission("current", asOf, [
        { course: "C", assessment: "Exam", rawGrade: "85" },
        { course: "D", assessment: "Quiz", rawGrade: "90" },
      ]),
    ] }, asOf);
    expect(summary.entries).toHaveLength(3);
    expect(summary.entries[0]!.comparison).toEqual({ direction: "up", priorPercent: 75, priorAssessment: "Old exam" });
    expect(summary.entries[1]).toMatchObject({ comparison: null, firstGrade: false });
    expect(summary.entries[2]).toMatchObject({ percent: null, comparison: null, firstGrade: false });
  });

  it.each([
    { submissions: [] },
    { submissions: [submission("stale", new Date("2026-01-01T00:00:00Z"), [
      { course: "C", assessment: "Old", rawGrade: "90" },
    ])] },
    { submissions: [submission("future", new Date("2026-08-09T00:00:00Z"), [
      { course: "C", assessment: "Future", rawGrade: "90" },
    ])] },
  ])("returns an empty window without borrowing stale or future metadata (%#)", ({ submissions }) => {
    expect(deriveLatestGrades({ available: true, submissions }, asOf)).toEqual({
      status: "empty", submissionId: null, submittedAt: null, entries: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Tasks 2.2 / 2.9 — program-local week bounds, DST, phases
// ---------------------------------------------------------------------------

describe("week bounds and phases", () => {
  it("spans seven local calendar days across the DST fall-back week", () => {
    const nextMonday = addEasternCalendarDays(WEEK_9.endDate, 1);
    const spanMs = nextMonday.getTime() - WEEK_9.startDate.getTime();
    expect(spanMs).toBe(7 * 24 * 60 * MS_PER_MINUTE + 60 * MS_PER_MINUTE); // 7 days + 1h
  });

  it("counts a Sunday-evening log in its own program-local week across the DST boundary", () => {
    const sunday = WEEK_9.endDate; // Nov 1, 2026
    const summary = evaluateWeek(
      baseInput({
        weekNumber: 9,
        weekStart: WEEK_9.startDate,
        weekEnd: WEEK_9.endDate,
        asOf: at(sunday, "23:00"),
        targets: { front_desk: 300 },
        logs: [logMs("l1", "front_desk", at(sunday, "20:00"), 60)],
      })
    );
    expect(summary.phase).toBe("current");
    expect(summary.hours[0]!.loggedMinutes).toBe(60);
  });

  it("uses Sunday as the inclusive display end and excludes the next Monday", () => {
    const mondayAfter = addEasternCalendarDays(WEEK_1.endDate, 1);
    const summary = evaluateWeek(
      baseInput({
        asOf: at(mondayAfter, "09:00"),
        logs: [logMs("l1", "front_desk", at(mondayAfter, "08:00"), 60)],
        targets: { front_desk: 300 },
      })
    );
    expect(summary.phase).toBe("past");
    expect(summary.hours[0]!.loggedMinutes).toBe(0); // next Monday is out of range
  });

  it("reports a future week as future without fabricating activity", () => {
    const summary = evaluateWeek(
      baseInput({ asOf: addEasternCalendarDays(WEEK_1.startDate, -2) })
    );
    expect(summary.phase).toBe("future");
    expect(summary.hours[0]!.hasActivity).toBe(false);
  });
});
