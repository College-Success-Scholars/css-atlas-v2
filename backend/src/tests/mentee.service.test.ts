import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("../supabase/client.js", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import { getMenteeByUid, getMenteesByMentorKey } from "../services/mentee.service.js";

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
