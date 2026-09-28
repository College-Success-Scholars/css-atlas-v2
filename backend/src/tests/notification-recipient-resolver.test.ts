import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../supabase/client.js", () => ({
  getSupabaseServiceRoleClient: () => ({ from: mocks.from }),
}));

import { resolveTeamLeaderRecipient } from "../domains/notifications/recipient-resolver.js";

function relationQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  };
}

describe("resolveTeamLeaderRecipient", () => {
  beforeEach(() => mocks.from.mockReset());

  it("returns the configured Slack ID for a scholar with one leader", async () => {
    mocks.from.mockReturnValue(relationQuery([
      { profiles: { id: "leader-1", slack_user_id: "U123", full_name: "Team Leader" } },
    ]));

    await expect(resolveTeamLeaderRecipient("scholar-1")).resolves.toEqual({
      id: "leader-1", slackUserId: "U123", name: "Team Leader", reason: "mentor",
    });
  });

  it("skips a scholar with multiple team leaders", async () => {
    mocks.from.mockReturnValue(relationQuery([
      { profiles: { id: "leader-1", slack_user_id: "U123", full_name: "One" } },
      { profiles: { id: "leader-2", slack_user_id: "U456", full_name: "Two" } },
    ]));

    await expect(resolveTeamLeaderRecipient("scholar-1")).resolves.toBeNull();
  });
});
