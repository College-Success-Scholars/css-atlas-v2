import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../app.js";

describe("User routes — auth gating", () => {
  it("GET /api/users returns 401 without token", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("GET /api/users/directory returns 401 without token", async () => {
    const res = await request(app).get("/api/users/directory");
    expect(res.status).toBe(401);
  });

  it("GET /api/daily-activity returns 401 without token", async () => {
    const res = await request(app).get("/api/daily-activity");
    expect(res.status).toBe(401);
  });

  it("GET /api/traffic returns 401 without token", async () => {
    const res = await request(app).get("/api/traffic");
    expect(res.status).toBe(401);
  });

  it("GET /api/form-logs returns 401 without token", async () => {
    const res = await request(app).get("/api/form-logs");
    expect(res.status).toBe(401);
  });

  it("GET /api/tutor-reports returns 401 without token", async () => {
    const res = await request(app).get("/api/tutor-reports");
    expect(res.status).toBe(401);
  });
});
