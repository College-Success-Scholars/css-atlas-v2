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

import { getMenteesWithComplianceByMentorKey } from "../services/mentee.service.js";

const range = {
  startDate: new Date("2026-09-07T00:00:00.000Z"),
  endDate: new Date("2026-09-13T00:00:00.000Z"),
};

function configureMentees(data: Record<string, unknown>[]) {
  const eq = vi.fn().mockResolvedValue({ data, error: null });
  mocks.getSupabaseClient.mockReturnValue({
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }),
  });
}

describe("getMenteesWithComplianceByMentorKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("composes multiple mentees with one compliance batch and preserves null UIDs", async () => {
    configureMentees([
      { mentee_uid: "S1", user_roster: { first_name: "Ada", last_name: "Lovelace", fd_required: 2, ss_required: 1 } },
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
  });

  it("propagates compliance read errors", async () => {
    configureMentees([{ mentee_uid: "S1", user_roster: null }]);
    mocks.getShiftComplianceForScholars.mockRejectedValue(new Error("compliance read failed"));

    await expect(getMenteesWithComplianceByMentorKey("mentor-1", range))
      .rejects.toThrow("compliance read failed");
  });
});
