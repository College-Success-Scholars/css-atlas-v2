import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMenteeReviewByMentorKey: vi.fn(),
  getMenteeReviewByUid: vi.fn(),
  saveMeetingPreference: vi.fn(),
  getMenteeMcfPrefill: vi.fn(),
}));

vi.mock("../services/mentee-review-activity.service.js", () => ({
  getMenteeReviewByMentorKey: mocks.getMenteeReviewByMentorKey,
  getMenteeReviewByUid: mocks.getMenteeReviewByUid,
}));

vi.mock("../services/mentee-meeting-preference.service.js", () => ({
  saveMeetingPreference: mocks.saveMeetingPreference,
}));

vi.mock("../services/mentee-mcf-prefill.service.js", () => ({
  getMenteeMcfPrefill: mocks.getMenteeMcfPrefill,
}));

import express from "express";
import { app } from "../app.js";
import { menteeEndpoints } from "../controllers/mentees.controller.js";
import { errorHandler } from "../http/error-handler.js";

type FakeProfile = { id: string; full_name?: string; student_id?: string };

/** The bound handlers behind a fake sign-in, so validation, error mapping and the envelope are what run. */
function appFor(auth: { profile?: FakeProfile; actingAs?: boolean } = {}) {
  const api = express();
  api.use(express.json());
  api.use((req, _res, next) => {
    Object.assign(req, {
      authUser: { id: "tl-1", email: "tl@umd.edu" },
      profile: auth.profile ?? { id: "tl-1" },
      isActingAsTestProfile: auth.actingAs ?? false,
    });
    next();
  });
  for (const { contract, handle } of menteeEndpoints) {
    api[contract.method.toLowerCase() as "get" | "put"](contract.path, handle);
  }
  api.use(errorHandler);
  return api;
}

const emptyCalendar = { semesterId: null, semesterStart: null, semesterEnd: null, currentWeek: 8, weeks: [], noActiveWeek: false };
const reviewStub = {
  asOf: "2026-10-23T12:00:00.000Z",
  mentee: { uid: "1001", fullName: "Test Scholar", email: null },
  calendar: emptyCalendar,
  currentWeek: 8,
  selectedWeek: 8,
  semesterGrid: { ok: true, data: [], loadedAt: "x" },
  selectedWeekReview: { ok: true, data: null, loadedAt: "x" },
  latestGrades: {
    ok: true,
    data: { status: "empty", submissionId: null, submittedAt: null, entries: [] },
    loadedAt: "x",
  },
  meetingPreference: { ok: true, data: null, loadedAt: "x" },
};

describe("mentee review routes — auth gating", () => {
  it("GET /api/auth/mentees/:uid/review requires auth", async () => {
    const res = await request(app).get("/api/auth/mentees/1001/review");
    expect(res.status).toBe(401);
  });

  it("PUT /api/auth/mentees/:uid/meeting-preference requires auth", async () => {
    const res = await request(app)
      .put("/api/auth/mentees/1001/meeting-preference")
      .send({ weekday: 2, meetingTime: "14:30" });
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/mentees/:uid/mcf-prefill requires auth", async () => {
    const res = await request(app).get("/api/auth/mentees/1001/mcf-prefill");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/mentees/:uid/directory-review requires auth", async () => {
    const res = await request(app).get("/api/auth/mentees/1001/directory-review");
    expect(res.status).toBe(401);
  });
});


describe("GET /api/auth/mentees/:uid/review", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the authorized review with the mentee uid and a null week default", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(reviewStub);
    const res = await request(appFor()).get("/api/auth/mentees/1001/review");

    expect(mocks.getMenteeReviewByMentorKey).toHaveBeenCalledWith({
      mentorKey: "tl-1",
      menteeUid: "1001",
      selectedWeek: null,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: reviewStub });
  });

  it("writes instants as ISO strings", async () => {
    const at = new Date("2026-10-20T14:00:00.000Z");
    const week = {
      weekNumber: 8,
      weekStart: "2026-10-19",
      weekEnd: "2026-10-25",
      phase: "current",
      hours: [
        {
          kind: "front_desk",
          assignmentAvailable: true,
          loggedMinutes: 30,
          excuseMinutes: 0,
          excuseDescription: null,
          targetMinutes: 60,
          percent: 50,
          band: "orange",
          displayHours: 0.5,
          overageMinutes: 0,
          pending: false,
          noShowCount: 0,
          hasActivity: true,
          shifts: [
            {
              sourceId: "s1",
              kind: "front_desk",
              date: "2026-10-20",
              scheduledStart: at,
              scheduledEnd: at,
              scheduledMinutes: 60,
              loggedStart: at,
              loggedEnd: null,
              overlapMinutes: 30,
              status: "short",
            },
          ],
          offShiftLogs: [],
          openSignIns: [],
        },
      ],
      wahf: { status: "pending", dueAt: at, submittedAt: null, onTime: null, submissionId: null },
      tutoring: { status: "none", recordedAttendance: false, reports: [] },
    };
    mocks.getMenteeReviewByMentorKey.mockResolvedValue({
      ...reviewStub,
      selectedWeekReview: { ok: true, data: week, loadedAt: "x" },
    });
    const res = await request(appFor()).get("/api/auth/mentees/1001/review");

    expect(res.status).toBe(200);
    const body = res.body.data.selectedWeekReview.data;
    expect(body.hours[0].shifts[0]).toMatchObject({
      scheduledStart: at.toISOString(),
      loggedStart: at.toISOString(),
      loggedEnd: null,
    });
    expect(body.wahf.dueAt).toBe(at.toISOString());
  });

  it("passes an explicit past week through", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue({ ...reviewStub, selectedWeek: 3 });
    await request(appFor()).get("/api/auth/mentees/1001/review?week=3");
    expect(mocks.getMenteeReviewByMentorKey).toHaveBeenCalledWith(
      expect.objectContaining({ selectedWeek: 3 })
    );
  });

  it("reviews the acting persona's mentees while acting as one", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(reviewStub);
    await request(appFor({ profile: { id: "persona", student_id: "9001" }, actingAs: true })).get(
      "/api/auth/mentees/1001/review"
    );
    expect(mocks.getMenteeReviewByMentorKey).toHaveBeenCalledWith(
      expect.objectContaining({ mentorKey: "9001" })
    );
  });

  it.each(["abc", "0", "-2"])("rejects invalid week %p with 400", async (week) => {
    const res = await request(appFor()).get(`/api/auth/mentees/1001/review?week=${week}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^week /);
    expect(mocks.getMenteeReviewByMentorKey).not.toHaveBeenCalled();
  });

  it("rejects a future week with 400", async () => {
    const res = await request(appFor()).get("/api/auth/mentees/1001/review?week=999999");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Cannot select a future week" });
  });

  it("returns a non-enumerating 404 when the mentee is not the caller's", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(null);
    const res = await request(appFor()).get("/api/auth/mentees/nope/review");
    expect(res.status).toBe(404);
  });

  it("returns 200 with section errors preserved (partial failure is not a 500)", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue({
      ...reviewStub,
      semesterGrid: { ok: false, error: { code: "attendance", message: "boom", retriable: true } },
    });
    const res = await request(appFor()).get("/api/auth/mentees/1001/review");
    expect(res.status).toBe(200);
    expect(res.body.data.semesterGrid.ok).toBe(false);
  });
});

describe("GET /api/auth/mentees/:uid/directory-review", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns any assigned mentee's review for a team leader directory view", async () => {
    mocks.getMenteeReviewByUid.mockResolvedValue(reviewStub);
    const res = await request(appFor()).get("/api/auth/mentees/1001/directory-review?week=3");

    expect(mocks.getMenteeReviewByUid).toHaveBeenCalledWith({ menteeUid: "1001", selectedWeek: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: reviewStub });
  });

  it("rejects a future week with 400", async () => {
    const res = await request(appFor()).get("/api/auth/mentees/1001/directory-review?week=999999");
    expect(res.status).toBe(400);
    expect(mocks.getMenteeReviewByUid).not.toHaveBeenCalled();
  });

  it("returns a non-enumerating 404 when the scholar is not anyone's mentee", async () => {
    mocks.getMenteeReviewByUid.mockResolvedValue(null);
    const res = await request(appFor()).get("/api/auth/mentees/nope/directory-review");
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/auth/mentees/:uid/meeting-preference", () => {
  beforeEach(() => vi.resetAllMocks());

  const put = (body: unknown) => request(appFor()).put("/api/auth/mentees/1001/meeting-preference").send(body as object);

  it("saves with the authenticated profile id as owner", async () => {
    mocks.saveMeetingPreference.mockResolvedValue({ ok: true, data: { weekday: 2, meetingTime: "14:30" } });
    const res = await put({ weekday: 2, meetingTime: "14:30" });
    expect(mocks.saveMeetingPreference).toHaveBeenCalledWith({
      mentorId: "tl-1",
      menteeUid: "1001",
      weekday: 2,
      meetingTime: "14:30",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { weekday: 2, meetingTime: "14:30" } });
  });

  it("ignores a spoofed mentor id in the request body", async () => {
    mocks.saveMeetingPreference.mockResolvedValue({ ok: true, data: { weekday: 2, meetingTime: "14:30" } });
    await put({ weekday: 2, meetingTime: "14:30", mentorId: "someone-else" });
    expect(mocks.saveMeetingPreference).toHaveBeenCalledWith(expect.objectContaining({ mentorId: "tl-1" }));
  });

  it.each([0, 8, 2.5, "3", null])("rejects weekday %p with 400", async (weekday) => {
    const res = await put({ weekday, meetingTime: "14:30" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^weekday /);
    expect(mocks.saveMeetingPreference).not.toHaveBeenCalled();
  });

  it.each(["25:00", "9:00", "14:60", "14:30:00", "", 1430])("rejects time %p with 400", async (meetingTime) => {
    const res = await put({ weekday: 2, meetingTime });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/meetingTime /);
    expect(mocks.saveMeetingPreference).not.toHaveBeenCalled();
  });

  it("normalizes surrounding whitespace on the time", async () => {
    mocks.saveMeetingPreference.mockResolvedValue({ ok: true, data: { weekday: 2, meetingTime: "09:05" } });
    await put({ weekday: 2, meetingTime: " 09:05 " });
    expect(mocks.saveMeetingPreference).toHaveBeenCalledWith(expect.objectContaining({ meetingTime: "09:05" }));
  });

  it("maps not_assigned to 403", async () => {
    mocks.saveMeetingPreference.mockResolvedValue({
      ok: false,
      error: { code: "not_assigned", message: "You are not assigned to this mentee." },
    });
    const res = await put({ weekday: 2, meetingTime: "14:30" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "You are not assigned to this mentee." });
  });

  it("maps save_failed to a retryable 503 that tells the team leader their setting was kept", async () => {
    const message = "Could not save the meeting preference. Your previous setting was preserved.";
    mocks.saveMeetingPreference.mockResolvedValue({ ok: false, error: { code: "save_failed", message } });
    const res = await put({ weekday: 2, meetingTime: "14:30" });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: message });
  });
});

describe("GET /api/auth/mentees/:uid/mcf-prefill", () => {
  beforeEach(() => vi.resetAllMocks());

  const prefillStub = { url: "https://forms.example/viewform?usp=pp_url&x=1", weekStart: "2026-08-31", generatedAt: "x" };

  it("returns a private/no-store prefill with the authenticated mentor identity", async () => {
    mocks.getMenteeMcfPrefill.mockResolvedValue({ ok: true, data: prefillStub });
    const res = await request(
      appFor({ profile: { id: "tl-1", full_name: "Grace Hopper", student_id: "9001" } })
    ).get("/api/auth/mentees/1001/mcf-prefill");
    expect(mocks.getMenteeMcfPrefill).toHaveBeenCalledWith({
      mentorId: "tl-1",
      mentorFullName: "Grace Hopper",
      mentorUid: "9001",
      menteeUid: "1001",
    });
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.body).toEqual({ data: prefillStub });
  });

  it("takes the mentor UID from the profile, never the request", async () => {
    mocks.getMenteeMcfPrefill.mockResolvedValue({ ok: true, data: prefillStub });
    await request(appFor({ profile: { id: "tl-1", student_id: "9001" } })).get(
      "/api/auth/mentees/1001/mcf-prefill?mentorUid=spoofed"
    );
    expect(mocks.getMenteeMcfPrefill).toHaveBeenCalledWith(expect.objectContaining({ mentorUid: "9001" }));
  });

  it.each([
    ["mentee_not_found", 404],
    ["mentor_uid_unavailable", 409],
    ["attendance_unavailable", 503],
    ["wahf_unavailable", 503],
  ] as const)("maps %s to %i", async (code, status) => {
    mocks.getMenteeMcfPrefill.mockResolvedValue({ ok: false, error: { code, message: "nope" } });
    const res = await request(appFor()).get("/api/auth/mentees/1001/mcf-prefill");
    expect(res.status).toBe(status);
  });
});
