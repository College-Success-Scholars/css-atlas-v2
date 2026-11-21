import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../app.js";

describe("Session log routes — auth gating", () => {
  it("GET /api/session-logs/study/no-shows returns 401 without token", async () => {
    const res = await request(app).get("/api/session-logs/study/no-shows");
    expect(res.status).toBe(401);
  });

  it("GET /api/session-records is gone (attendance is /api/attendance)", async () => {
    const res = await request(app).get("/api/session-records");
    expect(res.status).toBe(404);
  });
});
