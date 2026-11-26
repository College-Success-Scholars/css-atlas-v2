import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../app.js";

describe("User routes — auth gating", () => {
  it("GET /api/users/memo-users returns 401 without token", async () => {
    const res = await request(app).get("/api/users/memo-users");
    expect(res.status).toBe(401);
  });

  it("GET /api/users/directory returns 401 without token", async () => {
    const res = await request(app).get("/api/users/directory");
    expect(res.status).toBe(401);
  });

  it("GET /api/daily-activity/minutes returns 401 without token", async () => {
    const res = await request(app).get("/api/daily-activity/minutes?menteeUid=1&weekNum=1&logSource=front_desk");
    expect(res.status).toBe(401);
  });

  it("GET /api/traffic/entry-count/1 returns 401 without token", async () => {
    const res = await request(app).get("/api/traffic/entry-count/1");
    expect(res.status).toBe(401);
  });

  it("GET /api/form-logs/mcf/week/1/with-late returns 401 without token", async () => {
    const res = await request(app).get("/api/form-logs/mcf/week/1/with-late");
    expect(res.status).toBe(401);
  });
});
