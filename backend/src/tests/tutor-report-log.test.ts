import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("../supabase/client.js", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import {
  campusWeekForTutoringRow,
  didScholarAttendTutoring,
  filterTutorReportsForCampusWeek,
  getTutorReportLogsForWeek,
  getTutorReportWeekRows,
  isEmptyTutoringSessionUid,
  isProbeTutorReportUid,
  tutorReportScholarName,
  tutoringSessionDayOfWeek,
} from "../services/tutor-report-log.service.js";
import type { TutorReportLogRow } from "../models/tutor-report-log.model.js";
import {
  addEasternCalendarDays,
  campusWeekToDateRange,
  parseEasternDate,
} from "../services/time.service.js";

function mondayOfCampusWeek(weekNum: number): string {
  const range = campusWeekToDateRange(weekNum);
  if (!range) throw new Error(`No campus week ${weekNum}`);
  const { startDate } = range;
  const y = startDate.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return y;
}

function dayInCampusWeek(weekNum: number, dayOffset: number): string {
  return addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(weekNum)), dayOffset)
    .toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function row(overrides: Partial<TutorReportLogRow> & Pick<TutorReportLogRow, "id">): TutorReportLogRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    date: null,
    tutor_name: "Alex",
    scholar_uid: "1001",
    start_time: "14:00",
    end_time: "15:00",
    courses: ["MATH 101"],
    ...overrides,
  };
}

describe("tutor report scholar uid rules", () => {
  it("treats only n/a and 111111111 as empty sessions", () => {
    expect(isEmptyTutoringSessionUid("n/a")).toBe(true);
    expect(isEmptyTutoringSessionUid("N/A")).toBe(true);
    expect(isEmptyTutoringSessionUid(" 111111111 ")).toBe(true);
    expect(isEmptyTutoringSessionUid("test")).toBe(false);
    expect(isEmptyTutoringSessionUid("1001")).toBe(false);
    expect(isEmptyTutoringSessionUid(null)).toBe(false);
  });

  it("treats test as a probe uid that is not collected", () => {
    expect(isProbeTutorReportUid("test")).toBe(true);
    expect(isProbeTutorReportUid("Test")).toBe(true);
    expect(isProbeTutorReportUid("n/a")).toBe(false);
    expect(isProbeTutorReportUid("111111111")).toBe(false);
  });

  it("labels empty sessions and resolves real scholar names", () => {
    const names = new Map([["1001", "Ada Lovelace"]]);
    expect(tutorReportScholarName("N/A", names)).toBe("EMPTY SESSION");
    expect(tutorReportScholarName("111111111", names)).toBe("EMPTY SESSION");
    expect(tutorReportScholarName("1001", names)).toBe("Ada Lovelace");
    expect(tutorReportScholarName("1002", names)).toBe("1002");
  });
});

describe("campusWeekForTutoringRow", () => {
  it("uses session date, not form created_at", () => {
    const week = 2;
    const inWeek = dayInCampusWeek(week, 1);
    const priorWeek = dayInCampusWeek(week - 1, 1);
    expect(
      campusWeekForTutoringRow(
        row({
          id: 1,
          created_at: `${priorWeek}T16:00:00.000Z`,
          date: inWeek,
        })
      )
    ).toBe(week);
    expect(
      campusWeekForTutoringRow(
        row({
          id: 2,
          created_at: `${inWeek}T16:00:00.000Z`,
          date: priorWeek,
        })
      )
    ).toBe(week - 1);
  });

  it("uses date when start_time is a clock string and skips rows with no date", () => {
    const week = 2;
    const inWeek = dayInCampusWeek(week, 1);
    expect(
      campusWeekForTutoringRow(
        row({ id: 1, date: inWeek, start_time: "15:00" })
      )
    ).toBe(week);
    expect(
      campusWeekForTutoringRow(
        row({ id: 2, date: null, start_time: "not-a-date" })
      )
    ).toBeNull();
  });
});

describe("filterTutorReportsForCampusWeek", () => {
  it("keeps only rows whose session date falls in the campus week", () => {
    const week = 2;
    const inWeek = dayInCampusWeek(week, 1);
    const priorWeek = dayInCampusWeek(week - 1, 1);
    const rows = [
      row({ id: 1, date: inWeek, created_at: `${priorWeek}T16:00:00.000Z` }),
      row({ id: 2, date: priorWeek, created_at: `${inWeek}T16:00:00.000Z` }),
    ];
    expect(filterTutorReportsForCampusWeek(rows, week).map((r) => r.id)).toEqual([1]);
  });
});

describe("tutoringSessionDayOfWeek", () => {
  it("uses the session date weekday, not created_at", () => {
    const monday = mondayOfCampusWeek(2);
    const wednesday = dayInCampusWeek(2, 2);
    expect(
      tutoringSessionDayOfWeek(
        row({
          id: 1,
          date: monday,
          created_at: `${wednesday}T16:00:00.000Z`,
        })
      )
    ).toBe("Mon");
  });

  it("returns em dash when date and start_time are not a calendar day", () => {
    expect(
      tutoringSessionDayOfWeek(row({ id: 1, date: null, start_time: "15:00" }))
    ).toBe("—");
  });
});

describe("getTutorReportLogsForWeek", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries session date bounds, not created_at", async () => {
    const week = 2;
    const range = campusWeekToDateRange(week)!;
    const startYmd = range.startDate.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const nextYmd = addEasternCalendarDays(range.endDate, 1).toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const inWeek = dayInCampusWeek(week, 1);
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.or = vi.fn(() => builder);
    builder.order = vi.fn().mockResolvedValue({
      data: [row({ id: 1, date: inWeek })],
      error: null,
    });
    mocks.getSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    });

    const data = await getTutorReportLogsForWeek(week);

    expect(builder.or).toHaveBeenCalledWith(
      `and(date.gte.${startYmd},date.lt.${nextYmd}),date.is.null`
    );
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toBe(1);
  });

  it("omits test uids and keeps n/a and 111111111", async () => {
    const week = 2;
    const inWeek = dayInCampusWeek(week, 1);
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.or = vi.fn(() => builder);
    builder.order = vi.fn().mockResolvedValue({
      data: [
        row({ id: 1, date: inWeek, scholar_uid: "1001" }),
        row({ id: 2, date: inWeek, scholar_uid: "test" }),
        row({ id: 3, date: inWeek, scholar_uid: "TEST" }),
        row({ id: 4, date: inWeek, scholar_uid: "n/a" }),
        row({ id: 5, date: inWeek, scholar_uid: "111111111" }),
      ],
      error: null,
    });
    mocks.getSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    });

    const data = await getTutorReportLogsForWeek(week);

    expect(data.map((entry) => entry.id)).toEqual([1, 4, 5]);
  });
});

describe("getTutorReportWeekRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds roster names, EMPTY SESSION, and session weekday", async () => {
    const week = 2;
    const monday = mondayOfCampusWeek(week);
    const tutorBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    tutorBuilder.select = vi.fn(() => tutorBuilder);
    tutorBuilder.or = vi.fn(() => tutorBuilder);
    tutorBuilder.order = vi.fn().mockResolvedValue({
      data: [
        row({ id: 1, date: monday, scholar_uid: "1001" }),
        row({ id: 2, date: monday, scholar_uid: "n/a" }),
      ],
      error: null,
    });
    const rosterBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    rosterBuilder.select = vi.fn(() => rosterBuilder);
    rosterBuilder.in = vi.fn().mockResolvedValue({
      data: [{ uid: "1001", first_name: "Ada", last_name: "Lovelace" }],
      error: null,
    });
    mocks.getSupabaseClient.mockReturnValue({
      from: vi.fn((table: string) => (table === "user_roster" ? rosterBuilder : tutorBuilder)),
    });

    const data = await getTutorReportWeekRows(week);

    expect(rosterBuilder.in).toHaveBeenCalledWith("uid", ["1001"]);
    expect(data.map((r) => [r.id, r.scholar_name, r.day_of_week])).toEqual([
      [1, "Ada Lovelace", "Mon"],
      [2, "EMPTY SESSION", "Mon"],
    ]);
  });
});

describe("didScholarAttendTutoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is true when a session date falls in the week even if created_at does not", async () => {
    const week = 2;
    const inWeek = dayInCampusWeek(week, 1);
    const priorWeek = dayInCampusWeek(week - 1, 1);
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.or = vi.fn(() => builder);
    builder.order = vi.fn().mockResolvedValue({
      data: [
        row({
          id: 1,
          scholar_uid: "1001",
          date: inWeek,
          created_at: `${priorWeek}T16:00:00.000Z`,
        }),
      ],
      error: null,
    });
    mocks.getSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    });

    await expect(didScholarAttendTutoring("1001", week)).resolves.toBe(true);
  });

  it("is false for probe and empty-session uids", async () => {
    const week = 2;
    await expect(didScholarAttendTutoring("test", week)).resolves.toBe(false);
    await expect(didScholarAttendTutoring("N/A", week)).resolves.toBe(false);
    await expect(didScholarAttendTutoring("111111111", week)).resolves.toBe(false);
    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
  });
});
