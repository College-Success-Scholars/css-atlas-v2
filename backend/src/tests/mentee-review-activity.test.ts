import { describe, expect, it } from "vitest";
import {
  addEasternCalendarDays,
  campusWeekToDateRange,
  dateToCampusWeek,
  getEasternDateParts,
  parseEasternDate,
  WINTER_BREAK_CAMPUS_WEEK_NUMBER,
} from "../services/time.service.js";
import { easternTimestamp } from "../services/shift-occurrence.service.js";
import { buildSemesterWeeks, evaluateWeek } from "../services/mentee-review-evaluator.js";
import {
  buildAttendanceEvidence,
  expandShiftOccurrences,
} from "../services/mentee-review-attendance.adapter.js";
import {
  buildGradesEvidence,
  buildSemesterCalendar,
  buildTutoringEvidenceForWeek,
  buildWahfEvidenceForWeek,
  composeMenteeReview,
  gradeEntriesFromAssignmentGrades,
  latestWahfInWeek,
} from "../services/mentee-review-activity.service.js";
import type { ScholarShiftAssignment, SessionLogRow } from "../models/session-log.model.js";
import type { WahfFormLogRow } from "../models/form-log.model.js";
import type { TutorReportLogRow } from "../models/tutor-report-log.model.js";
import type { MenteeReview, SectionResult } from "../models/mentee-review.model.js";
import type { AttendanceEvidence } from "../services/mentee-review-attendance.adapter.js";

const WEEK_1 = campusWeekToDateRange(1)!; // Aug 31 – Sep 6, 2026
const WEEK_2 = campusWeekToDateRange(2)!;

function localDay(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function at(date: Date, time: string): Date {
  return easternTimestamp(date, time);
}

function assignment(overrides: Partial<ScholarShiftAssignment> = {}): ScholarShiftAssignment {
  return {
    id: "a1",
    scholar_id: "1001",
    semester_id: "1",
    session_kind: "front_desk",
    day_of_week: 1,
    start_time: "10:00:00",
    end_time: "11:00:00",
    is_active: true,
    ...overrides,
  };
}

function ticket(id: string, action: string, createdAt: Date): SessionLogRow {
  return {
    id,
    created_at: createdAt.toISOString(),
    scholar_uid: "1001",
    action_type: action,
    session_type: null,
  };
}

function wahf(id: string, createdAt: Date, grades: Record<string, Record<string, string>> | null): WahfFormLogRow {
  return {
    id,
    created_at: createdAt.toISOString(),
    scholar_uid: "1001",
    scholar_name: "Test Scholar",
    team_leader_contact: null,
    tl_meeting_in_person: null,
    course_changes: null,
    assignment_grades: grades,
    missed_classes: null,
    missed_assignments: null,
    submitted_by_email: null,
    course_change_details: null,
  };
}

function tutor(id: number, date: string, courses: string[]): TutorReportLogRow {
  return {
    id,
    created_at: at(parseEasternDate(date), "12:00").toISOString(),
    date,
    tutor_name: "Tutor",
    scholar_uid: "1001",
    start_time: `${date}T10:00:00`,
    end_time: `${date}T11:00:00`,
    courses,
  };
}

// ---------------------------------------------------------------------------
// Task 3.2 — semester-scoped assignment expansion
// ---------------------------------------------------------------------------

describe("expandShiftOccurrences", () => {
  it("expands a weekly assignment across the semester date scope only", () => {
    const shifts = expandShiftOccurrences({
      scholarUid: "1001",
      semesterId: "1",
      semesterStart: WEEK_1.startDate,
      semesterEnd: WEEK_2.endDate,
      assignments: [assignment()],
    });
    expect(shifts.map((s) => s.date)).toEqual([localDay(WEEK_1.startDate), localDay(WEEK_2.startDate)]);
    expect(shifts.every((s) => s.startTime === "10:00" && s.endTime === "11:00")).toBe(true);
  });

  it("excludes inactive and other-semester assignments", () => {
    const shifts = expandShiftOccurrences({
      scholarUid: "1001",
      semesterId: "1",
      semesterStart: WEEK_1.startDate,
      semesterEnd: WEEK_1.endDate,
      assignments: [
        assignment({ id: "active", semester_id: "1" }),
        assignment({ id: "inactive", is_active: false }),
        assignment({ id: "other-semester", semester_id: "9" }),
      ],
    });
    expect(shifts).toHaveLength(1);
    expect(shifts[0]!.sourceId).toContain("active");
  });

  it("preserves multiple same-kind shifts on one date with distinct source IDs", () => {
    const shifts = expandShiftOccurrences({
      scholarUid: "1001",
      semesterId: "1",
      semesterStart: WEEK_1.startDate,
      semesterEnd: WEEK_1.endDate,
      assignments: [
        assignment({ id: "a1", start_time: "10:00", end_time: "11:00" }),
        assignment({ id: "a2", start_time: "14:00", end_time: "15:00" }),
      ],
    });
    expect(shifts).toHaveLength(2);
    expect(new Set(shifts.map((s) => s.sourceId)).size).toBe(2);
  });

  it("includes a weekend (Sunday) standing shift", () => {
    const shifts = expandShiftOccurrences({
      scholarUid: "1001",
      semesterId: "1",
      semesterStart: WEEK_1.startDate,
      semesterEnd: WEEK_1.endDate,
      assignments: [assignment({ day_of_week: 0 })],
    });
    expect(shifts).toHaveLength(1);
    expect(shifts[0]!.date).toBe(localDay(addEasternCalendarDays(WEEK_1.startDate, 6))); // Sunday
  });

  it("returns nothing when the semester scope is unknown", () => {
    expect(
      expandShiftOccurrences({
        scholarUid: "1001",
        semesterId: "1",
        semesterStart: null,
        semesterEnd: null,
        assignments: [assignment()],
      })
    ).toEqual([]);
  });

  it("matches numeric semester_id from the DB against the calendar string id", () => {
    const shifts = expandShiftOccurrences({
      scholarUid: "1001",
      semesterId: "1",
      semesterStart: WEEK_1.startDate,
      semesterEnd: WEEK_1.endDate,
      assignments: [assignment({ semester_id: 1 })],
    });
    expect(shifts).toHaveLength(1);
    expect(shifts[0]!.startTime).toBe("10:00");
  });
});

// ---------------------------------------------------------------------------
// Task 3.3 — logged intervals and non-terminal evidence
// ---------------------------------------------------------------------------

describe("buildAttendanceEvidence", () => {
  const mon = WEEK_1.startDate;
  const tue = addEasternCalendarDays(WEEK_1.startDate, 1);
  const wed = addEasternCalendarDays(WEEK_1.startDate, 2);
  const asOf = at(tue, "12:00");

  // The open entry must be the last ticket, otherwise cleaning converts an
  // unclosed entry into EXIT_WITHOUT_ENTER once a later-day exit appears.
  const evidence = buildAttendanceEvidence({
    scholarUid: "1001",
    semesterId: "1",
    semesterStart: WEEK_1.startDate,
    semesterEnd: WEEK_2.endDate,
    assignments: [assignment()],
    frontDeskRows: [
      ticket("fd-complete-in", "Entry", at(mon, "10:00")),
      ticket("fd-complete-out", "Exit", at(mon, "11:00")),
      ticket("fd-open-in", "Entry", at(tue, "09:00")),
    ],
    studyRows: [],
    asOf,
  });

  it("maps completed sessions into logged intervals preserving the source ID", () => {
    const completed = evidence.logs.find((l) => l.sourceId === "fd-complete-in");
    expect(completed).toBeDefined();
    expect(completed!.end.getTime() - completed!.start.getTime()).toBe(60 * 60_000);
  });

  it("defaults excuses to [] and maps scholar_week_excuses into week evidence", () => {
    expect(evidence.excuses).toEqual([]);
    const withExcuse = buildAttendanceEvidence({
      scholarUid: "1001",
      semesterId: "1",
      semesterStart: WEEK_1.startDate,
      semesterEnd: WEEK_2.endDate,
      assignments: [],
      frontDeskRows: [],
      studyRows: [],
      asOf,
      excuseRows: [
        {
          scholar_uid: "1001",
          week_start: "2026-08-31",
          week_num: 1,
          kind: "front_desk",
          excuse_min: 45,
          description: "Doctor",
          updated_by: "tl",
          updated_at: asOf.toISOString(),
        },
      ],
    });
    expect(withExcuse.excuses).toEqual([
      {
        weekNum: 1,
        weekStart: "2026-08-31",
        kind: "front_desk",
        minutes: 45,
        description: "Doctor",
      },
    ]);
  });

  it("keeps an open entry bounded to its own local day and marks the date non-terminal", () => {
    const open = evidence.logs.find((l) => l.sourceId === "fd-open-in");
    expect(open).toBeDefined();
    expect(open!.end.getTime()).toBe(asOf.getTime()); // 12:00 < day end
    expect(evidence.nonTerminalDates).toContain(localDay(tue));
    expect(open!.end.getTime()).toBeLessThan(addEasternCalendarDays(tue, 1).getTime());
  });

  it("marks unmatched evidence dates non-terminal without manufacturing attendance", () => {
    const stray = buildAttendanceEvidence({
      scholarUid: "1001",
      semesterId: "1",
      semesterStart: WEEK_1.startDate,
      semesterEnd: WEEK_2.endDate,
      assignments: [],
      frontDeskRows: [
        ticket("fd-mon-in", "Entry", at(mon, "10:00")),
        ticket("fd-mon-out", "Exit", at(mon, "11:00")),
        ticket("fd-stray-out", "Exit", at(wed, "10:00")),
      ],
      studyRows: [],
      asOf: at(wed, "18:00"),
    });
    expect(stray.nonTerminalDates).toContain(localDay(wed));
    expect(stray.logs.some((l) => l.sourceId === "fd-stray-out")).toBe(false);
  });

  it("never confirms a no-show on a non-terminal date", () => {
    const summary = evaluateWeek({
      weekNumber: 1,
      weekStart: WEEK_1.startDate,
      weekEnd: WEEK_1.endDate,
      asOf: at(wed, "18:00"),
      shifts: [
        {
          sourceId: "s-mon",
          kind: "front_desk",
          date: localDay(wed),
          startTime: "10:00",
          endTime: "11:00",
        },
      ],
      logs: [],
      nonTerminalDates: [localDay(wed)],
      targets: { front_desk: 300 },
      wahf: { available: true, dueAt: at(WEEK_1.endDate, "23:59"), submission: null },
      tutoring: { available: true, reports: [] },
    });
    expect(summary.hours[0]!.shifts[0]!.status).toBe("unconfirmed");
    expect(summary.hours[0]!.noShowCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tasks 3.4 / 3.5 / 2.8 — source mappers
// ---------------------------------------------------------------------------

describe("WAHF mapping", () => {
  const inWeek1 = at(WEEK_1.startDate, "12:00");
  const inWeek2 = at(WEEK_2.startDate, "12:00");

  it("attributes submissions to their program-local week, not the runner's zone", () => {
    expect(dateToCampusWeek(new Date("2026-09-07T01:00:00Z"))).toBe(1); // Sep 6 21:00 ET
    expect(dateToCampusWeek(new Date("2026-09-07T05:00:00Z"))).toBe(2); // Sep 7 01:00 ET
  });

  it("picks the latest submission attributed to the requested week", () => {
    const rows = [wahf("w1", inWeek1, null), wahf("w2", inWeek2, null)];
    expect(latestWahfInWeek(rows, 1)?.sourceId).toBe("w1");
    expect(latestWahfInWeek(rows, 2)?.sourceId).toBe("w2");
    expect(latestWahfInWeek(rows, 5)).toBeNull();
  });

  it("reports unavailable evidence as not-a-submission rather than missing", () => {
    const evidence = buildWahfEvidenceForWeek([wahf("w1", inWeek1, null)], 1, false);
    expect(evidence.available).toBe(false);
    expect(evidence.submission).toBeNull();
  });
});

describe("grade mapping", () => {
  it("preserves observed course/assessment order and skips blank grades", () => {
    const entries = gradeEntriesFromAssignmentGrades({
      CMSC420: { Exam: "90%", Quiz: "" },
      ECON200: { Exam: "95%" },
    });
    expect(entries).toEqual([
      { course: "CMSC420", assessment: "Exam", rawGrade: "90%" },
      { course: "ECON200", assessment: "Exam", rawGrade: "95%" },
    ]);
  });

  it("is unavailable (never empty) when the source read failed", () => {
    const evidence = buildGradesEvidence([wahf("w1", WEEK_1.startDate, null)], false);
    expect(evidence.available).toBe(false);
    expect(evidence.submissions).toEqual([]);
  });
});

describe("tutoring mapping", () => {
  it("filters by session date's week and de-duplicates by report ID", () => {
    const rows = [tutor(1, localDay(WEEK_1.startDate), ["CMSC420", "MATH141"]), tutor(2, localDay(WEEK_2.startDate), ["PHYS161"])];
    const week1 = buildTutoringEvidenceForWeek(rows, 1, true);
    expect(week1.reports).toHaveLength(1);
    expect(week1.reports[0]!.reportId).toBe("1");
    expect(week1.reports[0]!.courses).toEqual(["CMSC420", "MATH141"]);
  });

  it("is unavailable (never none) when the source read failed", () => {
    const evidence = buildTutoringEvidenceForWeek([], 1, false);
    expect(evidence.available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 3.6 — semester calendar and winter break
// ---------------------------------------------------------------------------

describe("buildSemesterCalendar", () => {
  it("reports no active week when there is no semester", () => {
    const calendar = buildSemesterCalendar({ semester: null, asOf: WEEK_1.startDate });
    expect(calendar.noActiveWeek).toBe(true);
    expect(calendar.weeks).toEqual([]);
    expect(calendar.semesterId).toBeNull();
  });

  it("marks the collapsed winter-break week as a non-selectable Break", () => {
    const semester = {
      id: 1,
      start_date: localDay(WEEK_1.startDate),
      end_date: "2027-01-27", // last winter-break day
    };
    const calendar = buildSemesterCalendar({ semester, asOf: WEEK_1.startDate });
    const breakWeek = calendar.weeks.find((w) => w.weekNumber === WINTER_BREAK_CAMPUS_WEEK_NUMBER);
    expect(breakWeek).toBeDefined();
    expect(breakWeek!.isBreak).toBe(true);
    expect(breakWeek!.isSelectable).toBe(false);
    // The collapsed range is never one giant Mon–Sun week.
    expect(
      new Date(breakWeek!.endDate).getTime() - new Date(breakWeek!.startDate).getTime()
    ).toBeGreaterThan(7 * 24 * 60 * 60 * 1000);
  });

  it("marks future weeks non-selectable and the current week selectable", () => {
    const weeks = buildSemesterWeeks({
      semesterStart: WEEK_1.startDate,
      semesterEnd: WEEK_2.endDate,
      asOf: at(WEEK_1.startDate, "12:00"),
      currentWeek: 1,
    });
    const week1 = weeks.find((w) => w.weekNumber === 1)!;
    const week2 = weeks.find((w) => w.weekNumber === 2)!;
    expect(week1.isCurrent).toBe(true);
    expect(week1.isSelectable).toBe(true);
    expect(week2.isFuture).toBe(true);
    expect(week2.isSelectable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tasks 3.1 / 3.7 — composition and partial-failure isolation
// ---------------------------------------------------------------------------

describe("composeMenteeReview", () => {
  const asOf = at(WEEK_1.startDate, "12:00");
  const semester = { id: 1, start_date: localDay(WEEK_1.startDate), end_date: localDay(WEEK_1.endDate) };
  const calendar = buildSemesterCalendar({ semester, asOf });

  const attendance: SectionResult<AttendanceEvidence> = {
    ok: true,
    data: {
      shifts: [
        {
          sourceId: "s1",
          kind: "front_desk",
          date: localDay(WEEK_1.startDate),
          startTime: "10:00",
          endTime: "11:00",
        },
      ],
      logs: [
        { sourceId: "l1", kind: "front_desk", start: at(WEEK_1.startDate, "10:00"), end: at(WEEK_1.startDate, "11:00") },
      ],
      nonTerminalDates: [],
      excuses: [],
    },
    loadedAt: asOf.toISOString(),
  };

  function compose(overrides: Partial<Parameters<typeof composeMenteeReview>[0]> = {}): MenteeReview {
    return composeMenteeReview({
      asOf,
      mentee: { uid: "1001", fullName: "Test Scholar", email: "scholar@umd.edu" },
      calendar,
      selectedWeek: 1,
      targets: { front_desk: 300, study_session: null },
      attendance,
      wahf: { ok: true, data: [], loadedAt: asOf.toISOString() },
      tutoring: { ok: true, data: [], loadedAt: asOf.toISOString() },
      meetingPreference: { ok: true, data: null, loadedAt: asOf.toISOString() },
      ...overrides,
    });
  }

  it("derives the selected week from the shared evaluator", () => {
    const review = compose();
    expect(review.semesterGrid.ok).toBe(true);
    expect(review.selectedWeekReview.ok).toBe(true);
    expect(review.selectedWeekReview.ok && review.selectedWeekReview.data?.weekNumber).toBe(1);
    expect(review.selectedWeekReview.ok && review.selectedWeekReview.data?.hours[0]!.shifts[0]!.status).toBe("attended");
  });

  it("keeps grades usable when attendance fails (partial-failure isolation)", () => {
    const review = compose({
      attendance: { ok: false, error: { code: "x", message: "boom", retriable: true } },
    });
    expect(review.semesterGrid.ok).toBe(false);
    expect(review.selectedWeekReview.ok).toBe(false);
    expect(review.latestGrades.ok).toBe(true);
  });

  it("anchors all recent grades to asOf, not the selected historical week", () => {
    const now = new Date("2026-09-17T16:00:00Z");
    const gradeCalendar = buildSemesterCalendar({
      semester: { id: 1, start_date: "2026-08-31", end_date: "2026-12-12" },
      asOf: now,
    });
    const rows = [
      wahf("old", new Date("2026-08-31T16:00:00Z"), { C: { Old: "70" } }),
      wahf("previous", new Date("2026-09-08T16:00:00Z"), { C: { Previous: "80" } }),
      wahf("current", new Date("2026-09-16T16:00:00Z"), { C: { Current: "90" } }),
      wahf("future", new Date("2026-09-18T16:00:00Z"), { C: { Future: "95" } }),
    ];
    const options = { asOf: now, calendar: gradeCalendar, wahf: { ok: true as const, data: rows, loadedAt: now.toISOString() } };
    const historical = compose({ ...options, selectedWeek: 1 });
    const current = compose({ ...options, selectedWeek: 3 });

    expect(historical.latestGrades.ok).toBe(true);
    if (!historical.latestGrades.ok || !current.latestGrades.ok) throw new Error("Expected grades to be available");
    expect(historical.latestGrades.data).toEqual(current.latestGrades.data);
    expect(historical.latestGrades.data.entries.map((entry) => entry.submissionId)).toEqual(["current", "previous"]);
    expect(historical.latestGrades.data.entries[1]!.comparison?.priorPercent).toBe(70);
  });

  it("marks WAHF/tutoring unknown (never missing/none) when their reads fail", () => {
    const review = compose({
      wahf: { ok: false, error: { code: "w", message: "boom", retriable: true } },
      tutoring: { ok: false, error: { code: "t", message: "boom", retriable: true } },
    });
    expect(review.latestGrades.ok).toBe(false);
    const summary = review.selectedWeekReview.ok ? review.selectedWeekReview.data : null;
    expect(summary?.wahf.status).toBe("unknown");
    expect(summary?.tutoring.status).toBe("unknown");
  });
});
