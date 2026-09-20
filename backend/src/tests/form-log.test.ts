import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Response, NextFunction } from "express";
import { app } from "../app.js";
import {
  requireSelfOrTeamLeader,
  requireSelfScholarIdOrTeamLeader,
  requireTeamLeaderRole,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  buildTeamLeaderFormStatsForWeek,
  countableFormRequired,
  NO_MENTEE_RELATIONSHIP,
} from "../services/form-log.service.js";
import type { FormLogRowWithLate, McfFormLogRow } from "../models/form-log.model.js";

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function scholarReq(overrides: {
  profile?: { student_id?: string | null; app_role?: string | null };
  params?: Record<string, string>;
  body?: unknown;
} = {}): AuthenticatedRequest {
  return {
    profile: { student_id: "12345", app_role: null, ...overrides.profile },
    params: overrides.params ?? {},
    body: overrides.body ?? {},
  } as AuthenticatedRequest;
}

describe("Form log routes — unauthenticated", () => {
  it("GET /api/form-logs/mcf/week/1 returns 401 without token", async () => {
    const res = await request(app).get("/api/form-logs/mcf/week/1");
    expect(res.status).toBe(401);
  });

  it("GET /api/form-logs/mcf/uid/12345 returns 401 without token", async () => {
    const res = await request(app).get("/api/form-logs/mcf/uid/12345");
    expect(res.status).toBe(401);
  });

  it("POST /api/form-logs/recent-submissions returns 401 without token", async () => {
    const res = await request(app).post("/api/form-logs/recent-submissions").send({ scholarId: "12345" });
    expect(res.status).toBe(401);
  });
});

describe("requireTeamLeaderRole", () => {
  it("allows team_leader and developer", () => {
    for (const app_role of ["team_leader", "developer"]) {
      const next = vi.fn() as unknown as NextFunction;
      const res = mockRes();
      requireTeamLeaderRole(scholarReq({ profile: { app_role } }), res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);
    }
  });

  it("forbids scholars", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    requireTeamLeaderRole(scholarReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

describe("requireSelfOrTeamLeader", () => {
  it("allows a scholar to read their own uid", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    requireSelfOrTeamLeader(scholarReq({ params: { uid: "12345" } }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("forbids a scholar from reading another uid", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    requireSelfOrTeamLeader(scholarReq({ params: { uid: "99999" } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("allows team leaders to read any uid", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    requireSelfOrTeamLeader(
      scholarReq({ profile: { app_role: "team_leader", student_id: "12345" }, params: { uid: "99999" } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 400 when uid is missing", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    requireSelfOrTeamLeader(scholarReq({ params: {} }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });
});

describe("requireSelfScholarIdOrTeamLeader", () => {
  it("allows a scholar to request their own scholarId", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    requireSelfScholarIdOrTeamLeader(
      scholarReq({ body: { scholarId: "12345" } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("forbids a scholar from requesting another scholarId", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    requireSelfScholarIdOrTeamLeader(
      scholarReq({ body: { scholarId: "99999" } }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("allows a missing scholarId (handler returns empty)", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    requireSelfScholarIdOrTeamLeader(scholarReq({ body: {} }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("assembleRecentFormSubmissions", () => {
  it("omits WPL/MCF and WAHF payloads for scholars", async () => {
    const { assembleRecentFormSubmissions } = await import("../services/form-log.service.js");
    const result = assembleRecentFormSubmissions({
      includeTeamLeaderForms: false,
      whaf: [
        {
          id: "w1",
          created_at: "2026-09-01T12:00:00.000Z",
          assignment_grades: { CMSC: { Exam: "90%" } },
        } as unknown as import("../models/form-log.model.js").WahfFormLogRow,
      ],
      wpl: [
        {
          id: 1,
          created_at: "2026-09-01T13:00:00.000Z",
          hours_worked: 4,
        } as unknown as import("../models/form-log.model.js").WplFormLogRow,
      ],
      mcf: [
        {
          id: "m1",
          created_at: "2026-09-01T14:00:00.000Z",
          mentee_name: "Ada",
          meeting_notes: "private",
        } as unknown as import("../models/form-log.model.js").McfFormLogRow,
      ],
    });
    expect(result).toEqual([
      { id: "WHAF-w1", formType: "WHAF", submittedAt: "2026-09-01T12:00:00.000Z" },
    ]);
    expect(result[0]).not.toHaveProperty("assignment_grades");
  });
});

describe("buildTeamLeaderFormStatsForWeek", () => {
  it("keeps mentee_count -1 as required and treats it as 100% MCF", () => {
    const rows = buildTeamLeaderFormStatsForWeek(
      [
        {
          uid: "tl-1",
          first_name: "Ada",
          last_name: "Lovelace",
          program_role: "Team Leader",
          mentee_count: NO_MENTEE_RELATIONSHIP,
        },
      ],
      [],
      [],
      [],
    );
    expect(rows[0]).toMatchObject({
      scholarId: "tl-1",
      mcfRequired: -1,
      mcfCompleted: 0,
      mcfPct: 100,
      mcfLatestAt: "",
    });
  });

  it("uses mentee_count as MCF required when the TL has assignments", () => {
    const rows = buildTeamLeaderFormStatsForWeek(
      [
        {
          uid: "tl-2",
          first_name: "Grace",
          last_name: "Hopper",
          program_role: "Team Leader",
          mentee_count: 2,
        },
      ],
      [
        {
          mentor_uid: "tl-2",
          mentee_uid: "s-1",
          created_at: "2026-09-01T12:00:00.000Z",
          isLate: false,
        } as FormLogRowWithLate<McfFormLogRow>,
      ],
      [],
      [],
    );
    expect(rows[0]).toMatchObject({
      mcfRequired: 2,
      mcfCompleted: 1,
      mcfPct: 50,
    });
  });
});

describe("countableFormRequired", () => {
  it("treats the no-relationship sentinel as zero owed", () => {
    expect(countableFormRequired(NO_MENTEE_RELATIONSHIP)).toBe(0);
    expect(countableFormRequired(0)).toBe(0);
    expect(countableFormRequired(3)).toBe(3);
  });
});
