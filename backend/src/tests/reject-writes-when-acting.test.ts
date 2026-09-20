import { describe, expect, it, vi } from "vitest";
import type { Response, NextFunction } from "express";
import {
  isActingWriteRequest,
  rejectWritesWhenActing,
} from "../middleware/reject-writes-when-acting.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

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

function actingReq(
  method: string,
  originalUrl: string,
): AuthenticatedRequest {
  return { isActingAsTestProfile: true, method, originalUrl } as AuthenticatedRequest;
}

describe("isActingWriteRequest", () => {
  it("allows read POST endpoints when acting", () => {
    expect(
      isActingWriteRequest(
        actingReq("POST", "/api/form-logs/recent-submissions"),
      ),
    ).toBe(false);
    expect(
      isActingWriteRequest(actingReq("POST", "/api/form-logs/mcf/by-uids")),
    ).toBe(false);
    expect(
      isActingWriteRequest(actingReq("POST", "/api/session-logs/front-desk")),
    ).toBe(false);
  });

  it("blocks mutation POST endpoints when acting", () => {
    expect(isActingWriteRequest(actingReq("POST", "/api/memo/sync"))).toBe(true);
    expect(isActingWriteRequest(actingReq("POST", "/api/auth/profile"))).toBe(true);
  });

  it("blocks PATCH when acting, including /api/dev", () => {
    expect(
      isActingWriteRequest(
        actingReq("PATCH", "/api/attendance/excuse"),
      ),
    ).toBe(true);
    expect(
      isActingWriteRequest(
        actingReq("PATCH", "/api/dev/roster/123"),
      ),
    ).toBe(true);
  });

  it("allows /api/dev POST when acting", () => {
    expect(
      isActingWriteRequest(
        actingReq("POST", "/api/dev/active-profile"),
      ),
    ).toBe(false);
  });
});

describe("rejectWritesWhenActing", () => {
  it("allows GET when acting", () => {
    const req = actingReq("GET", "/api/auth/me");
    const res = mockRes();
    const next = vi.fn();
    rejectWritesWhenActing(req, res, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it("blocks sync POST when acting", () => {
    const req = actingReq("POST", "/api/memo/sync");
    const res = mockRes();
    const next = vi.fn();
    rejectWritesWhenActing(req, res, next as NextFunction);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows recent-submissions POST when acting", () => {
    const req = actingReq("POST", "/api/form-logs/recent-submissions");
    const res = mockRes();
    const next = vi.fn();
    rejectWritesWhenActing(req, res, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it("allows POST on /api/dev when acting", () => {
    const req = actingReq("POST", "/api/dev/active-profile");
    const res = mockRes();
    const next = vi.fn();
    rejectWritesWhenActing(req, res, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it("blocks PATCH on /api/dev/roster/:uid when acting", () => {
    const req = actingReq("PATCH", "/api/dev/roster/123");
    const res = mockRes();
    const next = vi.fn();
    rejectWritesWhenActing(req, res, next as NextFunction);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
