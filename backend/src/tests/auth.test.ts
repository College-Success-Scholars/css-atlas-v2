import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../app.js";

// These tests verify auth-gating behaviour without a real Supabase call.
// Every protected route must reject requests that carry no Bearer token.

const AUTH_PROTECTED_ROUTES = [
  "/api/auth/me",
  "/api/auth/profile",
  "/api/auth/mentees/compliance",
  "/api/users",
  "/api/session-logs",
  "/api/traffic",
  "/api/form-logs",
  "/api/daily-activity",
] as const;

const TEAM_LEADER_ROUTES = [
  "/api/memo/weekly",
  "/api/memo/page-data",
  "/api/memo/traffic-count",
  "/api/tutor-reports",
] as const;

describe("Auth gating — unauthenticated requests", () => {
  for (const route of AUTH_PROTECTED_ROUTES) {
    it(`GET ${route} returns 401 without token`, async () => {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    });
  }

  for (const route of TEAM_LEADER_ROUTES) {
    it(`GET ${route} returns 401 without token`, async () => {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    });
  }

  it("POST /api/auth/profile returns 401 without token", async () => {
    const res = await request(app).post("/api/auth/profile").send({
      first_name: "Jane",
      last_name: "Doe",
      student_id: "123",
      cohort: 2025,
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/dev/test-profiles returns 401 without token", async () => {
    const res = await request(app).get("/api/dev/test-profiles");
    expect(res.status).toBe(401);
  });

  it("PATCH /api/dev/roster/:uid returns 401 without token", async () => {
    const res = await request(app).patch("/api/dev/roster/123").send({ status: "enrolled" });
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me returns 401 with malformed Bearer token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    // Should be 401 (Supabase rejects invalid JWT) — not 500
    expect(res.status).toBe(401);
  });
});
