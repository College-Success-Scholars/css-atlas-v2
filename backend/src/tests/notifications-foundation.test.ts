import { describe, expect, it, vi } from "vitest";
import { SlackChannel } from "../domains/notifications/channels/slack-channel.js";
import { findShiftOccurrenceMatch } from "../services/shift-occurrence.service.js";
import type { ScholarShiftAssignment, SessionLogRow } from "../models/session-log.model.js";

const assignment: ScholarShiftAssignment = {
  id: "assignment-1",
  scholar_id: "scholar-1",
  semester_id: "1",
  session_kind: "study_session",
  day_of_week: 1,
  start_time: "09:00:00",
  end_time: "10:00:00",
  is_active: true,
};

describe("assignment-first occurrence matching", () => {
  it("matches an Entry inside the shared grace window", () => {
    const rows: SessionLogRow[] = [{
      id: "entry-1", scholar_uid: "scholar-1", action_type: "Entry", session_type: "Study Session",
      created_at: "2026-09-14T12:50:00.000Z",
    }];
    const result = findShiftOccurrenceMatch(assignment, new Date("2026-09-14T12:00:00.000Z"), rows);
    expect(result.entry?.id).toBe("entry-1");
  });

  it("ignores an ad hoc Entry outside the assignment grace window", () => {
    const rows: SessionLogRow[] = [{
      id: "entry-1", scholar_uid: "scholar-1", action_type: "Entry", session_type: "Study Session",
      created_at: "2026-09-14T15:00:00.000Z",
    }];
    const result = findShiftOccurrenceMatch(assignment, new Date("2026-09-14T12:00:00.000Z"), rows);
    expect(result.entry).toBeNull();
  });
});

describe("SlackChannel", () => {
  it("retries a 429 using Retry-After before a successful send", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "ratelimited" }), { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const channel = new SlackChannel("xoxb-test", 3, fetcher);

    const result = await channel.send("U123", { text: "Please check in" });

    expect(result).toEqual({ ok: true, attempts: 2, error: null });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns a readable provider failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), { status: 200 }));
    const channel = new SlackChannel("xoxb-test", 3, fetcher);

    await expect(channel.send("U123", { text: "Please check in" })).resolves.toMatchObject({
      ok: false,
      error: "channel_not_found",
    });
  });
});
