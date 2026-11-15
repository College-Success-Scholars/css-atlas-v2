import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const TEST_PROFILE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const mocks = vi.hoisted(() => ({
  appRole: "team_leader" as string,
  rpc: vi.fn(),
}));

vi.mock("../supabase/client.js", () => {
  const profilesBuilder = {
    select: () => profilesBuilder,
    eq: () => profilesBuilder,
    maybeSingle: async () => ({
      data: { id: "user-1", app_role: mocks.appRole, user_roster: null },
      error: null,
    }),
  };
  const testProfilesBuilder = {
    select: () => testProfilesBuilder,
    eq: () => testProfilesBuilder,
    maybeSingle: async () => ({
      data: { id: TEST_PROFILE_ID, label: "Test", app_role: "team_leader", is_active: true, roster_uid: "S9", program_role: "Team Leader" },
      error: null,
    }),
  };
  const rosterBuilder = {
    select: () => rosterBuilder,
    not: async () => ({
      data: [
        { uid: "S1", first_name: "Sam", last_name: "One", cohort: null, program_role: "Scholar", app_role: null, fd_required: null, ss_required: null, status: "graduated" },
        { uid: "S2", first_name: "Ada", last_name: "Two", cohort: 2025, program_role: "Scholar", app_role: null, fd_required: 120, ss_required: 0, status: "enrolled" },
        { uid: "TL1", first_name: "Team", last_name: "Leader", cohort: null, program_role: "Team Leader", app_role: "team_leader", fd_required: null, ss_required: null, status: "enrolled" },
      ],
      error: null,
    }),
  };
  const client = {
    from: (table: string) =>
      table === "profiles" ? profilesBuilder : table === "dev_test_profiles" ? testProfilesBuilder : rosterBuilder,
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  };
  return {
    runWithToken: (_token: string, fn: () => unknown) => fn(),
    getSupabaseClient: () => client,
    getSupabaseAuthClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "tl@example.com" } }, error: null }) },
    }),
    getSupabaseServiceRoleClient: () => client,
  };
});

import { app } from "../app.js";
import { DEV_ACTIVE_PROFILE_HEADER } from "../../../shared/dist/auth.js";

const MONDAY = "2026-11-16";
const shift = { kind: "front_desk", dayOfWeek: 1, startTime: "09:00", endTime: "11:00" };

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    semester: { id: 902, name: "Fall", startDate: "2026-08-31", endDate: "2026-12-18" },
    currentWeekStart: MONDAY,
    weekStart: MONDAY,
    scholars: [
      { uid: "S1", revision: 3, shifts: [{ id: "x1", kind: "front_desk", dayOfWeek: 1, startTime: "09:00", endTime: "11:00", effectiveFrom: "2026-08-31", effectiveUntil: "2026-12-19" }] },
      { uid: "S2", revision: 0, shifts: [] },
    ],
    ...overrides,
  };
}

const validBody = { semesterId: 902, effectiveWeekStart: MONDAY, expectedRevision: 3, shifts: [shift] };

function put(uid = "S1", body: unknown = validBody) {
  return request(app).put(`/api/schedules/${uid}`).set("Authorization", "Bearer tl-token").send(body as object);
}

describe("team-leader schedule API", () => {
  beforeEach(() => {
    mocks.appRole = "team_leader";
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: snapshot(), error: null });
  });

  describe("access", () => {
    it("rejects unauthenticated reads and writes", async () => {
      expect((await request(app).get("/api/schedules")).status).toBe(401);
      expect((await request(app).put("/api/schedules/S1").send(validBody)).status).toBe(401);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("rejects scholars before any database call", async () => {
      mocks.appRole = "scholar";
      expect((await request(app).get("/api/schedules").set("Authorization", "Bearer s")).status).toBe(403);
      expect((await put()).status).toBe(403);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("rejects writes while a developer acts as a test profile, but still allows the read", async () => {
      mocks.appRole = "developer";
      const headerName = DEV_ACTIVE_PROFILE_HEADER;
      const read = await request(app).get("/api/schedules").set("Authorization", "Bearer d").set(headerName, TEST_PROFILE_ID);
      expect(read.status).toBe(200);
      const write = await request(app).put("/api/schedules/S1").set("Authorization", "Bearer d").set(headerName, TEST_PROFILE_ID).send(validBody);
      expect(write.status).toBe(403);
      expect(write.body.error).toMatch(/Read-only while acting/);
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/schedules", () => {
    it("lists all scholars without cohort, hours, enrollment, or mentor restrictions, but excludes staff", async () => {
      const res = await request(app).get("/api/schedules").set("Authorization", "Bearer tl-token");
      expect(res.status).toBe(200);
      expect(res.body.data.scholars.map((s: { uid: string }) => s.uid).sort()).toEqual(["S1", "S2"]);
      const sam = res.body.data.scholars.find((s: { uid: string }) => s.uid === "S1");
      expect(sam).toMatchObject({ name: "Sam One", status: "graduated", revision: 3 });
      expect(sam.shifts).toHaveLength(1);
      expect(res.body.data.semester.id).toBe(902);
      expect(res.body.data.currentWeekStart).toBe(MONDAY);
    });

    it("asks the database for the requested historical week", async () => {
      await request(app).get("/api/schedules?week=2026-10-05").set("Authorization", "Bearer tl-token");
      expect(mocks.rpc).toHaveBeenCalledWith("get_schedule_snapshot", { p_week_start: "2026-10-05" });
    });

    it("rejects weeks that are not Mondays or not dates", async () => {
      expect((await request(app).get("/api/schedules?week=2026-10-06").set("Authorization", "Bearer tl-token")).status).toBe(400);
      expect((await request(app).get("/api/schedules?week=soon").set("Authorization", "Bearer tl-token")).status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("maps a database authorization failure to 403", async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Team leader or above required" } });
      expect((await request(app).get("/api/schedules").set("Authorization", "Bearer tl-token")).status).toBe(403);
    });
  });

  describe("GET /api/schedules/:uid", () => {
    it("returns one scholar with the revision to send back on save", async () => {
      mocks.rpc.mockResolvedValue({ data: snapshot({ scholars: [snapshot().scholars[0]] }), error: null });
      const res = await request(app).get("/api/schedules/S1?week=2026-11-23").set("Authorization", "Bearer tl-token");
      expect(res.status).toBe(200);
      expect(res.body.data.scholar).toMatchObject({ uid: "S1", revision: 3 });
      expect(mocks.rpc).toHaveBeenCalledWith("get_schedule_snapshot", { p_week_start: "2026-11-23", p_scholar_id: "S1" });
    });

    it("returns 404 for someone who is not on the roster", async () => {
      mocks.rpc.mockResolvedValue({ data: snapshot({ scholars: [] }), error: null });
      expect((await request(app).get("/api/schedules/NOPE").set("Authorization", "Bearer tl-token")).status).toBe(404);
    });
  });

  describe("PUT /api/schedules/:uid", () => {
    it("sends the complete schedule and revision through the single write function", async () => {
      const res = await put();
      expect(res.status).toBe(200);
      expect(res.body.data.scholar).toMatchObject({ uid: "S1", revision: 3 });
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.rpc).toHaveBeenCalledWith("replace_scholar_schedule_from_week", {
        p_scholar_id: "S1",
        p_semester_id: 902,
        p_effective_week_start: MONDAY,
        p_expected_revision: 3,
        p_shifts: [shift],
      });
    });

    it("accepts an empty array to clear the schedule", async () => {
      expect((await put("S1", { ...validBody, shifts: [] })).status).toBe(200);
      expect(mocks.rpc.mock.calls[0]![1]).toMatchObject({ p_shifts: [] });
    });

    it.each([
      ["a missing revision", { ...validBody, expectedRevision: undefined }],
      ["a negative revision", { ...validBody, expectedRevision: -1 }],
      ["a fractional revision", { ...validBody, expectedRevision: 1.5 }],
      ["a missing semester", { ...validBody, semesterId: undefined }],
      ["a malformed week", { ...validBody, effectiveWeekStart: "next monday" }],
      ["an impossible date", { ...validBody, effectiveWeekStart: "2026-02-31" }],
      ["shifts that are not an array", { ...validBody, shifts: shift }],
      ["a bad kind", { ...validBody, shifts: [{ ...shift, kind: "tutoring" }] }],
      ["a day outside 0-6", { ...validBody, shifts: [{ ...shift, dayOfWeek: 7 }] }],
      ["a string day", { ...validBody, shifts: [{ ...shift, dayOfWeek: "1" }] }],
      ["a missing end time", { ...validBody, shifts: [{ ...shift, endTime: undefined }] }],
      ["a non-object body", []],
    ])("returns 400 for %s without calling the database", async (_label, body) => {
      const res = await put("S1", body);
      expect(res.status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("returns 409 with the current revision when the schedule changed", async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code: "CS409", message: "Schedule changed", details: "5" } });
      const res = await put();
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: "CS409", currentRevision: 5 });
      expect(res.body.error).toMatch(/changed since you loaded/);
    });

    it.each([
      ["CS422", 422],
      ["22023", 400],
      ["CS404", 404],
      ["42501", 403],
    ])("maps database code %s to HTTP %i", async (code, status) => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "rejected" } });
      expect((await put()).status).toBe(status);
    });

    it("never touches the assignment table directly", async () => {
      await put();
      expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["replace_scholar_schedule_from_week"]);
    });
  });

  describe("developer board uses the same contract", () => {
    it("serves the eligible-only board and the same revision-checked write", async () => {
      mocks.appRole = "developer";
      const board = await request(app).get("/api/dev/schedule-board").set("Authorization", "Bearer d");
      expect(board.status).toBe(200);
      expect(board.body.data.scholars.map((s: { uid: string }) => s.uid)).toEqual(["S2"]);

      const write = await request(app).put("/api/dev/schedule-board/S2").set("Authorization", "Bearer d").send({ ...validBody, expectedRevision: 0 });
      expect(write.status).toBe(200);
      expect(mocks.rpc).toHaveBeenLastCalledWith("replace_scholar_schedule_from_week", expect.objectContaining({ p_scholar_id: "S2", p_expected_revision: 0 }));

      const legacyBody = await request(app).put("/api/dev/schedule-board/S2").set("Authorization", "Bearer d").send({ shifts: [shift] });
      expect(legacyBody.status).toBe(400);
    });
  });
});
