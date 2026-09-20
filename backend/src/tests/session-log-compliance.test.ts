import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("../supabase/client.js", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import {
  buildShiftComplianceForScholars,
  getShiftComplianceForScholars,
  getScholarsWithValidEntryExit,
} from "../services/session-log.service.js";
import type {
  ScholarShiftAssignment,
  ScholarWithCompletedSession,
  SessionLogRow,
} from "../models/session-log.model.js";

const range = {
  startDate: new Date("2025-09-08T12:00:00.000Z"),
  endDate: new Date("2025-09-08T12:00:00.000Z"),
};

function assignment(kind: "front_desk" | "study_session"): ScholarShiftAssignment {
  return {
    scholar_id: "S1",
    semester_id: "fall-2025",
    session_kind: kind,
    day_of_week: 1,
    start_time: "09:00:00",
    end_time: "10:00:00",
    is_active: true,
  };
}

function session(entryAt: string, exitAt: string): ScholarWithCompletedSession {
  return {
    scholarId: "S1",
    scholarName: null,
    entryTicket: { id: "entry", created_at: entryAt, scholar_uid: "S1", action_type: "Entry" },
    exitTicket: { id: "exit", created_at: exitAt, scholar_uid: "S1", action_type: "Exit" },
    entryAt,
    exitAt,
    durationMs: new Date(exitAt).getTime() - new Date(entryAt).getTime(),
  };
}

describe("buildShiftComplianceForScholars", () => {
  it("returns zero compliance for a scholar with no assignments or sessions", () => {
    const result = buildShiftComplianceForScholars(["S1"], [], [], [], range);

    expect(result.get("S1")).toEqual({
      fdCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] },
      ssCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] },
    });
  });

  it("reports completed activity without an assignment as unscheduled outside time", () => {
    const result = buildShiftComplianceForScholars(
      ["S1"],
      [],
      [session("2025-09-08T13:00:00.000Z", "2025-09-08T14:00:00.000Z")],
      [],
      range
    );

    expect(result.get("S1")!.fdCompliance).toMatchObject({
      insideMinutes: 0,
      outsideMinutes: 60,
      noShowCount: 0,
      dates: [{ scheduledStart: null, scheduledEnd: null, unscheduled: true, noShow: false }],
    });
  });

  it("reports an assigned date without a completed session as a no-show", () => {
    const result = buildShiftComplianceForScholars(["S1"], [assignment("front_desk")], [], [], range);
    const compliance = result.get("S1")!.fdCompliance;

    expect(compliance.noShowCount).toBe(1);
    expect(compliance.dates[0]).toMatchObject({
      date: "2025-09-08",
      noShow: true,
      scheduledStart: "2025-09-08T13:00:00.000Z",
      scheduledEnd: "2025-09-08T14:00:00.000Z",
    });
  });

  it("counts a session wholly within the 15-minute grace window as inside", () => {
    const result = buildShiftComplianceForScholars(
      ["S1"],
      [assignment("front_desk")],
      [session("2025-09-08T12:50:00.000Z", "2025-09-08T14:10:00.000Z")],
      [],
      range
    );

    expect(result.get("S1")!.fdCompliance).toMatchObject({
      insideMinutes: 80,
      outsideMinutes: 0,
      noShowCount: 0,
    });
  });

  it("splits completed minutes at the grace-adjusted schedule boundaries", () => {
    const result = buildShiftComplianceForScholars(
      ["S1"],
      [assignment("front_desk")],
      [session("2025-09-08T12:30:00.000Z", "2025-09-08T14:30:00.000Z")],
      [],
      range
    );

    expect(result.get("S1")!.fdCompliance).toMatchObject({
      insideMinutes: 90,
      outsideMinutes: 30,
    });
  });

  it("excludes unmatched entries and keeps front-desk and study-session assignments independent", () => {
    const unmatchedEntry: SessionLogRow = {
      id: "entry-only",
      created_at: "2025-09-08T13:00:00.000Z",
      scholar_uid: "S1",
      action_type: "Entry",
    };
    const result = buildShiftComplianceForScholars(
      ["S1"],
      [assignment("front_desk"), assignment("study_session")],
      getScholarsWithValidEntryExit([unmatchedEntry]),
      [session("2025-09-08T13:00:00.000Z", "2025-09-08T14:00:00.000Z")],
      range
    );

    expect(result.get("S1")!.fdCompliance.noShowCount).toBe(1);
    expect(result.get("S1")!.ssCompliance).toMatchObject({
      insideMinutes: 60,
      outsideMinutes: 0,
      noShowCount: 0,
    });
  });
});

describe("getShiftComplianceForScholars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads multiple scholar IDs through direct bounded assignment and log batches", async () => {
    const assignmentEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const assignmentIn = vi.fn().mockReturnValue({ eq: assignmentEq });
    const frontDeskQuery = {
      data: [],
      error: null,
      order: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
    };
    frontDeskQuery.order.mockReturnValue(frontDeskQuery);
    frontDeskQuery.gte.mockReturnValue(frontDeskQuery);
    frontDeskQuery.lte.mockReturnValue(frontDeskQuery);
    frontDeskQuery.in.mockReturnValue(frontDeskQuery);
    const studySessionQuery = {
      data: [],
      error: null,
      order: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
    };
    studySessionQuery.order.mockReturnValue(studySessionQuery);
    studySessionQuery.gte.mockReturnValue(studySessionQuery);
    studySessionQuery.lte.mockReturnValue(studySessionQuery);
    studySessionQuery.in.mockReturnValue(studySessionQuery);
    const from = vi.fn((table: string) => {
      if (table === "scholar_shift_assignments") {
        return { select: vi.fn().mockReturnValue({ in: assignmentIn }) };
      }
      if (table === "front_desk_logs") {
        return { select: vi.fn().mockReturnValue(frontDeskQuery) };
      }
      if (table === "study_session_logs") {
        return { select: vi.fn().mockReturnValue(studySessionQuery) };
      }
      throw new Error(`Unexpected Supabase table: ${table}`);
    });
    mocks.getSupabaseClient.mockReturnValue({ from });

    await expect(getShiftComplianceForScholars(["S1", "S2"], range)).resolves.toEqual(
      new Map([
        ["S1", { fdCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] }, ssCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] } }],
        ["S2", { fdCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] }, ssCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] } }],
      ])
    );

    expect(from).toHaveBeenCalledTimes(3);
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "scholar_shift_assignments",
      "front_desk_logs",
      "study_session_logs",
    ]);
    expect(assignmentIn).toHaveBeenCalledTimes(1);
    expect(assignmentIn).toHaveBeenCalledWith("scholar_id", ["S1", "S2"]);
    expect(assignmentEq).toHaveBeenCalledTimes(1);
    expect(frontDeskQuery.in).toHaveBeenCalledTimes(1);
    expect(frontDeskQuery.in).toHaveBeenCalledWith("scholar_uid", ["S1", "S2"]);
    expect(studySessionQuery.in).toHaveBeenCalledTimes(1);
    expect(studySessionQuery.in).toHaveBeenCalledWith("scholar_uid", ["S1", "S2"]);
  });
});
