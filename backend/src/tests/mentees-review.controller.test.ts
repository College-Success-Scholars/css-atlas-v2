import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMenteeReviewByMentorKey: vi.fn(),
  saveMeetingPreference: vi.fn(),
  getMenteeMcfPrefill: vi.fn(),
}));

vi.mock("../services/mentee-review-activity.service.js", () => ({
  getMenteeReviewByMentorKey: mocks.getMenteeReviewByMentorKey,
}));

vi.mock("../services/mentee-meeting-preference.service.js", () => ({
  saveMeetingPreference: mocks.saveMeetingPreference,
}));

vi.mock("../services/mentee-mcf-prefill.service.js", () => ({
  getMenteeMcfPrefill: mocks.getMenteeMcfPrefill,
}));

import { app } from "../app.js";
import {
  getMenteeMcfPrefill,
  getMenteeReview,
  updateMenteeMeetingPreference,
} from "../controllers/mentees.controller.js";

type AnyHandler = (req: unknown, res: unknown, next: (err?: unknown) => void) => unknown;

/** Controllers are Express handlers; call them directly with a no-op next. */
async function invoke(handler: unknown, req: unknown, res: unknown): Promise<void> {
  await (handler as AnyHandler)(req, res, () => {});
}

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

function fakeReq(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    authUser: { id: "tl-1" },
    isActingAsTestProfile: false,
    profile: { id: "tl-1" },
    ...overrides,
  };
}

const reviewStub = {
  asOf: "2026-10-23T12:00:00.000Z",
  mentee: { uid: "1001", fullName: "Test Scholar" },
  calendar: { currentWeek: 8, noActiveWeek: false, weeks: [] },
  currentWeek: 8,
  selectedWeek: 8,
  semesterGrid: { ok: true, data: [], loadedAt: "x" },
  selectedWeekReview: { ok: true, data: null, loadedAt: "x" },
  latestGrades: { ok: true, data: { status: "empty" }, loadedAt: "x" },
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
});

describe("getMenteeReview", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the authorized review with the mentee uid and a null week default", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(reviewStub);
    const res = response();
    await invoke(getMenteeReview, fakeReq({ params: { uid: "1001" } }), res);

    expect(mocks.getMenteeReviewByMentorKey).toHaveBeenCalledWith({
      mentorKey: "tl-1",
      menteeUid: "1001",
      selectedWeek: null,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: reviewStub });
  });

  it("passes an explicit past week through", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue({ ...reviewStub, selectedWeek: 3 });
    const res = response();
    await invoke(getMenteeReview, fakeReq({ params: { uid: "1001" }, query: { week: "3" } }), res);
    expect(mocks.getMenteeReviewByMentorKey).toHaveBeenCalledWith(
      expect.objectContaining({ selectedWeek: 3 })
    );
  });

  it.each(["abc", "0", "-2"])("rejects invalid week %p with 400", async (week) => {
    const res = response();
    await invoke(getMenteeReview, fakeReq({ params: { uid: "1001" }, query: { week } }), res);
    expect(res.statusCode).toBe(400);
    expect(mocks.getMenteeReviewByMentorKey).not.toHaveBeenCalled();
  });

  it("rejects a future week with 400", async () => {
    const res = response();
    await invoke(getMenteeReview, fakeReq({ params: { uid: "1001" }, query: { week: "999999" } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Cannot select a future week" });
  });

  it("returns a non-enumerating 404 when the mentee is not the caller's", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(null);
    const res = response();
    await invoke(getMenteeReview, fakeReq({ params: { uid: "nope" } }), res);
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 with section errors preserved (partial failure is not a 500)", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue({
      ...reviewStub,
      semesterGrid: { ok: false, error: { code: "attendance", message: "boom", retriable: true } },
      latestGrades: { ok: true, data: { status: "empty" }, loadedAt: "x" },
    });
    const res = response();
    await invoke(getMenteeReview, fakeReq({ params: { uid: "1001" } }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { data: { semesterGrid: { ok: boolean } } }).data.semesterGrid.ok).toBe(false);
  });

  it("rejects a missing uid with 400", async () => {
    const res = response();
    await invoke(getMenteeReview, fakeReq({ params: {} }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("updateMenteeMeetingPreference", () => {
  beforeEach(() => vi.resetAllMocks());

  it("saves with the authenticated profile id as owner", async () => {
    mocks.saveMeetingPreference.mockResolvedValue({ ok: true, data: { weekday: 2, meetingTime: "14:30" } });
    const res = response();
    await invoke(
      updateMenteeMeetingPreference,
      fakeReq({ params: { uid: "1001" }, body: { weekday: 2, meetingTime: "14:30" } }),
      res
    );
    expect(mocks.saveMeetingPreference).toHaveBeenCalledWith({
      mentorId: "tl-1",
      menteeUid: "1001",
      weekday: 2,
      meetingTime: "14:30",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { weekday: 2, meetingTime: "14:30" } });
  });

  it("ignores a spoofed mentor id in the request body", async () => {
    mocks.saveMeetingPreference.mockResolvedValue({ ok: true, data: { weekday: 2, meetingTime: "14:30" } });
    const res = response();
    await invoke(
      updateMenteeMeetingPreference,
      fakeReq({
        params: { uid: "1001" },
        body: { weekday: 2, meetingTime: "14:30", mentorId: "someone-else" },
      }),
      res
    );
    expect(mocks.saveMeetingPreference).toHaveBeenCalledWith(
      expect.objectContaining({ mentorId: "tl-1" })
    );
  });

  it.each(["invalid_weekday", "invalid_time"])("maps %s to 400", async (code) => {
    mocks.saveMeetingPreference.mockResolvedValue({ ok: false, error: { code, message: "bad input" } });
    const res = response();
    await invoke(updateMenteeMeetingPreference, fakeReq({ params: { uid: "1001" } }), res);
    expect(res.statusCode).toBe(400);
  });

  it("maps not_assigned to 403", async () => {
    mocks.saveMeetingPreference.mockResolvedValue({
      ok: false,
      error: { code: "not_assigned", message: "You are not assigned to this mentee." },
    });
    const res = response();
    await invoke(updateMenteeMeetingPreference, fakeReq({ params: { uid: "1001" } }), res);
    expect(res.statusCode).toBe(403);
  });

  it("maps save_failed to an actionable 500", async () => {
    mocks.saveMeetingPreference.mockResolvedValue({
      ok: false,
      error: { code: "save_failed", message: "Could not save the meeting preference. Your previous setting was preserved." },
    });
    const res = response();
    await invoke(updateMenteeMeetingPreference, fakeReq({ params: { uid: "1001" } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: "Could not save the meeting preference. Your previous setting was preserved.",
    });
  });

  it("rejects a missing uid with 400", async () => {
    const res = response();
    await invoke(updateMenteeMeetingPreference, fakeReq({ params: {} }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("getMenteeMcfPrefill", () => {
  beforeEach(() => vi.resetAllMocks());

  const prefillStub = { url: "https://forms.example/viewform?usp=pp_url&x=1", weekStart: "2026-08-31", generatedAt: "x" };

  it("returns a private/no-store prefill with the authenticated mentor identity", async () => {
    mocks.getMenteeMcfPrefill.mockResolvedValue({ ok: true, data: prefillStub });
    const res = response();
    await invoke(
      getMenteeMcfPrefill,
      fakeReq({ params: { uid: "1001" }, profile: { id: "tl-1", full_name: "Grace Hopper", student_id: "9001" } }),
      res
    );
    expect(mocks.getMenteeMcfPrefill).toHaveBeenCalledWith({
      mentorId: "tl-1",
      mentorFullName: "Grace Hopper",
      mentorUid: "9001",
      menteeUid: "1001",
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(res.body).toEqual({ data: prefillStub });
  });

  it("takes the mentor UID from the profile, never the request", async () => {
    mocks.getMenteeMcfPrefill.mockResolvedValue({ ok: true, data: prefillStub });
    const res = response();
    await invoke(
      getMenteeMcfPrefill,
      fakeReq({ params: { uid: "1001" }, query: { mentorUid: "spoofed" }, profile: { id: "tl-1", student_id: "9001" } }),
      res
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
    const res = response();
    await invoke(getMenteeMcfPrefill, fakeReq({ params: { uid: "1001" } }), res);
    expect(res.statusCode).toBe(status);
  });

  it("rejects a missing uid with 400", async () => {
    const res = response();
    await invoke(getMenteeMcfPrefill, fakeReq({ params: {} }), res);
    expect(res.statusCode).toBe(400);
  });
});
