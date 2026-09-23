import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  resolveRecipient: vi.fn(),
}));

vi.mock("../supabase/client.js", () => ({
  getSupabaseServiceRoleClient: () => ({ from: mocks.from }),
}));
vi.mock("../domains/notifications/recipient-resolver.js", () => ({
  resolveTeamLeaderRecipient: mocks.resolveRecipient,
}));

import { emitNotificationEvent, NotificationEventType } from "../domains/notifications/index.js";

const event = {
  type: NotificationEventType.MISSED_STUDY_SESSION,
  occurrenceRef: "assignment-1:2026-09-14",
  scholarId: "scholar-1",
  sessionKind: "study_session" as const,
  occurrenceDate: "2026-09-14",
  scheduledStart: "2026-09-14T13:00:00.000Z",
  scheduledEnd: "2026-09-14T14:00:00.000Z",
};

describe("emitNotificationEvent", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.resolveRecipient.mockReset();
  });

  it("does not redeliver an already-sent event", async () => {
    mocks.resolveRecipient.mockResolvedValue({ id: "leader-1", slackUserId: "U123", name: "Leader" });
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "log-1", status: "sent", attempt_count: 1 }, error: null }) }) }),
    });
    const channel = { name: "slack", send: vi.fn() };

    await expect(emitNotificationEvent(event, channel)).resolves.toEqual({ status: "skipped_duplicate", error: null, attemptCount: 0 });
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("records a missing Slack ID without sending", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.resolveRecipient.mockResolvedValue({ id: "leader-1", slackUserId: null, name: "Leader" });
    mocks.from.mockImplementation((table: string) => {
      if (table === "notification_log") {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
          insert,
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: "Scholar", last_name: "One" }, error: null }) }) }) };
    });
    const channel = { name: "slack", send: vi.fn() };

    await expect(emitNotificationEvent(event, channel)).resolves.toMatchObject({ status: "skipped_missing_slack_id", attemptCount: 0 });
    expect(channel.send).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "skipped_missing_slack_id" }));
  });

  it("records a channel failure without throwing", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.resolveRecipient.mockResolvedValue({ id: "leader-1", slackUserId: "U123", name: "Leader" });
    mocks.from.mockImplementation((table: string) => {
      if (table === "notification_log") {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
          insert,
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: "Scholar", last_name: "One" }, error: null }) }) }) };
    });
    const channel = { name: "slack", send: vi.fn().mockResolvedValue({ ok: false, attempts: 3, error: "channel_not_found" }) };

    await expect(emitNotificationEvent(event, channel)).resolves.toMatchObject({ status: "failed", error: "channel_not_found", attemptCount: 3 });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", error: "channel_not_found" }));
  });
});
