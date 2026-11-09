import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  getShiftComplianceForScholars: vi.fn(),
}));

vi.mock("../supabase/client.js", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

vi.mock("../services/session-log.service.js", () => ({
  getShiftComplianceForScholars: mocks.getShiftComplianceForScholars,
}));

import {
  getMenteeByUid,
  getMenteesByMentorKey,
  getMenteesWithComplianceByMentorKey,
} from "../services/mentee.service.js";

const range = {
  startDate: new Date("2026-09-07T00:00:00.000Z"),
  endDate: new Date("2026-09-13T00:00:00.000Z"),
};

function configureMentees(data: Record<string, unknown>[]) {
  const limit = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ data, error: null, limit });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  mocks.getSupabaseClient.mockReturnValue({ from });
  return { from, select, eq, limit };
}

describe("mentee roster cohort", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([2026, null, undefined])("preserves cohort %p for mentor-owned mentees in the existing query", async (cohort) => {
    const query = configureMentees([{ mentee_uid: "S1", user_roster: { cohort } }]);

    const rows = await getMenteesByMentorKey("mentor-1");

    expect(rows[0]).toHaveProperty("cohort", cohort ?? null);
    expect(query.from).toHaveBeenCalledTimes(1);
    expect(query.from).toHaveBeenCalledWith("mentor_mentee");
    expect(query.select).toHaveBeenCalledWith(expect.stringMatching(/user_roster\([^)]*\bcohort\b/));
    expect(query.eq).toHaveBeenCalledWith("mentor_id", "mentor-1");
  });

  it.each([2025, null, undefined])("preserves cohort %p for directory mentees in the existing query", async (cohort) => {
    const query = configureMentees([{ mentee_uid: "S1", user_roster: { cohort } }]);

    const row = await getMenteeByUid("S1");

    expect(row).toHaveProperty("cohort", cohort ?? null);
    expect(query.from).toHaveBeenCalledTimes(1);
    expect(query.from).toHaveBeenCalledWith("mentor_mentee");
    expect(query.select).toHaveBeenCalledWith(expect.stringMatching(/user_roster\([^)]*\bcohort\b/));
    expect(query.eq).toHaveBeenCalledWith("mentee_uid", "S1");
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("keeps cohort null when the embedded roster is unavailable", async () => {
    configureMentees([{ mentee_uid: "S1", user_roster: null }]);
    expect(await getMenteeByUid("S1")).toHaveProperty("cohort", null);
  });
});

describe("getMenteesWithComplianceByMentorKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("composes multiple mentees with one compliance batch and preserves null UIDs", async () => {
    configureMentees([
      { mentee_uid: "S1", user_roster: { first_name: "Ada", last_name: "Lovelace", email: "ada@umd.edu", cohort: 2026, fd_required: 2, ss_required: 1 } },
      { mentee_uid: null, user_roster: null },
      { mentee_uid: "S2", user_roster: { first_name: "Grace", last_name: "Hopper", fd_required: 3, ss_required: 2 } },
    ]);
    const fdCompliance = { insideMinutes: 60, outsideMinutes: 0, noShowCount: 0, dates: [] };
    const ssCompliance = { insideMinutes: 30, outsideMinutes: 15, noShowCount: 0, dates: [] };
    mocks.getShiftComplianceForScholars.mockResolvedValue(new Map([
      ["S1", { fdCompliance, ssCompliance }],
      ["S2", { fdCompliance: { ...fdCompliance, insideMinutes: 90 }, ssCompliance }],
    ]));

    const result = await getMenteesWithComplianceByMentorKey("mentor-1", range);

    expect(mocks.getShiftComplianceForScholars).toHaveBeenCalledTimes(1);
    expect(mocks.getShiftComplianceForScholars).toHaveBeenCalledWith(["S1", "S2"], range);
    expect(result).toEqual([
      expect.objectContaining({ scholar_uid: "S1", fdCompliance, ssCompliance }),
      expect.objectContaining({ scholar_uid: null, fdCompliance: null, ssCompliance: null }),
      expect.objectContaining({ scholar_uid: "S2", fdCompliance: expect.objectContaining({ insideMinutes: 90 }), ssCompliance }),
    ]);
    for (const row of result) {
      expect(row).not.toHaveProperty("email");
      expect(row).not.toHaveProperty("cohort");
    }
  });

  it("propagates compliance read errors", async () => {
    configureMentees([{ mentee_uid: "S1", user_roster: null }]);
    mocks.getShiftComplianceForScholars.mockRejectedValue(new Error("compliance read failed"));

    await expect(getMenteesWithComplianceByMentorKey("mentor-1", range))
      .rejects.toThrow("compliance read failed");
  });
});
