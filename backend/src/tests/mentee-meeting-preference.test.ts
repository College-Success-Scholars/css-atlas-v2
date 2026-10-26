import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));

vi.mock("../supabase/client.js", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import {
  getMeetingPreference,
  normalizeMeetingTime,
  saveMeetingPreference,
  toMeetingPreferenceOutput,
  validateMeetingPreferenceInput,
} from "../services/mentee-meeting-preference.service.js";

interface FakeState {
  assignment?: { data: unknown; error: unknown };
  preference?: { data: unknown; error: unknown };
  upsertResult?: { data: unknown; error: unknown };
  upsertCalls: Array<{ values: Record<string, unknown>; options?: { onConflict?: string } }>;
}

function makeClient(state: FakeState) {
  return {
    from(table: string) {
      if (table === "mentor_mentee") {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.maybeSingle = async () => state.assignment ?? { data: null, error: null };
        return chain;
      }
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.upsert = (values: Record<string, unknown>, options?: { onConflict?: string }) => {
        state.upsertCalls.push({ values, options });
        return chain;
      };
      chain.maybeSingle = async () => state.preference ?? { data: null, error: null };
      chain.single = async () => state.upsertResult ?? { data: null, error: null };
      return chain;
    },
  };
}

function configure(state: Partial<FakeState> = {}): FakeState {
  const full: FakeState = { upsertCalls: [], ...state };
  mocks.getSupabaseClient.mockReturnValue(makeClient(full));
  return full;
}

describe("validateMeetingPreferenceInput", () => {
  it("accepts an ISO weekday and 24-hour time", () => {
    expect(validateMeetingPreferenceInput({ weekday: 2, meetingTime: "14:30" })).toEqual({
      ok: true,
      value: { weekday: 2, meetingTime: "14:30" },
    });
  });

  it.each([0, 8, 2.5, "3", null, undefined])("rejects weekday %p", (weekday) => {
    const result = validateMeetingPreferenceInput({ weekday, meetingTime: "14:30" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_weekday");
  });

  it.each(["25:00", "9:00", "14:60", "14:30:00", "", null, 1430])(
    "rejects time %p",
    (meetingTime) => {
      const result = validateMeetingPreferenceInput({ weekday: 2, meetingTime });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("invalid_time");
    }
  );

  it("normalizes surrounding whitespace", () => {
    expect(normalizeMeetingTime("  09:05 ")).toBe("09:05");
  });
});

describe("toMeetingPreferenceOutput", () => {
  it("trims Postgres time seconds to HH:MM", () => {
    expect(
      toMeetingPreferenceOutput({
        mentor_id: "m1",
        mentee_uid: "S1",
        weekday: 2,
        meeting_time: "14:30:00",
        created_at: "x",
        updated_at: "y",
      })
    ).toEqual({ weekday: 2, meetingTime: "14:30" });
  });
});

describe("getMeetingPreference", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the mapped preference for the caller's pair", async () => {
    configure({
      preference: {
        data: { mentor_id: "m1", mentee_uid: "S1", weekday: 3, meeting_time: "10:15:00", created_at: "x", updated_at: "y" },
        error: null,
      },
    });
    await expect(getMeetingPreference("m1", "S1")).resolves.toEqual({ weekday: 3, meetingTime: "10:15" });
  });

  it("returns null when unset", async () => {
    configure({ preference: { data: null, error: null } });
    await expect(getMeetingPreference("m1", "S1")).resolves.toBeNull();
  });
});

describe("saveMeetingPreference", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid input without writing", async () => {
    const state = configure({ assignment: { data: { mentee_uid: "S1" }, error: null } });
    const result = await saveMeetingPreference({ mentorId: "m1", menteeUid: "S1", weekday: 9, meetingTime: "14:30" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_weekday");
    expect(state.upsertCalls).toHaveLength(0);
  });

  it("denies a caller who is not assigned to the mentee (unrelated TL, reassignment, or admin writing another TL's row)", async () => {
    const state = configure({ assignment: { data: null, error: null } });
    const result = await saveMeetingPreference({ mentorId: "m1", menteeUid: "S1", weekday: 2, meetingTime: "14:30" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_assigned");
    expect(state.upsertCalls).toHaveLength(0);
  });

  it("atomically upserts both fields for the caller's own pair", async () => {
    const state = configure({
      assignment: { data: { mentee_uid: "S1" }, error: null },
      upsertResult: {
        data: { mentor_id: "m1", mentee_uid: "S1", weekday: 2, meeting_time: "14:30:00", created_at: "x", updated_at: "y" },
        error: null,
      },
    });
    const result = await saveMeetingPreference({ mentorId: "m1", menteeUid: "S1", weekday: 2, meetingTime: "14:30" });
    expect(result).toEqual({ ok: true, data: { weekday: 2, meetingTime: "14:30" } });
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0]!.values).toEqual({
      mentor_id: "m1",
      mentee_uid: "S1",
      weekday: 2,
      meeting_time: "14:30:00",
    });
    expect(state.upsertCalls[0]!.options).toEqual({ onConflict: "mentor_id,mentee_uid" });
  });

  it("keeps independent pairs separate", async () => {
    const state = configure({
      assignment: { data: { mentee_uid: "S1" }, error: null },
      upsertResult: {
        data: { mentor_id: "m1", mentee_uid: "S1", weekday: 1, meeting_time: "09:00:00", created_at: "x", updated_at: "y" },
        error: null,
      },
    });
    await saveMeetingPreference({ mentorId: "m1", menteeUid: "S1", weekday: 1, meetingTime: "09:00" });
    await saveMeetingPreference({ mentorId: "m1", menteeUid: "S2", weekday: 5, meetingTime: "16:45" });
    expect(state.upsertCalls.map((c) => c.values.mentee_uid)).toEqual(["S1", "S2"]);
    expect(state.upsertCalls.map((c) => c.values.weekday)).toEqual([1, 5]);
  });

  it("binds the owner to the authenticated mentor id, never a request-body value", async () => {
    const state = configure({
      assignment: { data: { mentee_uid: "S1" }, error: null },
      upsertResult: {
        data: { mentor_id: "authenticated-tl", mentee_uid: "S1", weekday: 2, meeting_time: "10:00:00", created_at: "x", updated_at: "y" },
        error: null,
      },
    });
    await saveMeetingPreference({ mentorId: "authenticated-tl", menteeUid: "S1", weekday: 2, meetingTime: "10:00" });
    expect(state.upsertCalls[0]!.values.mentor_id).toBe("authenticated-tl");
  });

  it("reports a save failure without mutating anything (previous value preserved)", async () => {
    const state = configure({
      assignment: { data: { mentee_uid: "S1" }, error: null },
      upsertResult: { data: null, error: { message: "RLS denied" } },
    });
    const result = await saveMeetingPreference({ mentorId: "m1", menteeUid: "S1", weekday: 2, meetingTime: "14:30" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("save_failed");
      expect(result.error.message).toMatch(/previous setting was preserved/);
    }
    expect(state.upsertCalls).toHaveLength(1); // attempted, but the caller sees an explicit error
  });
});
