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
});
