import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const traffic = vi.hoisted(() => ({
  getTrafficSessionsForWeek: vi.fn(),
  getTrafficEntryCountForWeek: vi.fn(),
  getTrafficEntryCountsForWeeks: vi.fn(),
}));
const activity = vi.hoisted(() => ({ getTotalMinutesForMenteeWeek: vi.fn() }));

vi.mock("../services/traffic.service.js", () => traffic);
vi.mock("../services/daily-scholar-activity.service.js", () => activity);

import { activityEndpoints } from "../controllers/activity.controller.js";
import { trafficEndpoints } from "../controllers/traffic.controller.js";
import { errorHandler } from "../http/error-handler.js";

/** The bound handlers without the auth middleware, so validation and the envelope are what run. */
function appForEndpoints() {
  const app = express();
  app.use(express.json());
  for (const { contract, handle } of [...trafficEndpoints, ...activityEndpoints]) {
    app[contract.method.toLowerCase() as "get" | "post"](contract.path, handle);
  }
  app.use(errorHandler);
  return app;
}

beforeEach(() => vi.resetAllMocks());

describe("/api/traffic", () => {
  it("returns sessions for a week", async () => {
    const sessions = [{ uid: "1", entryAt: "a", exitAt: "b", durationMs: 5, assumedExit: false }];
    traffic.getTrafficSessionsForWeek.mockResolvedValue(sessions);
    const res = await request(appForEndpoints()).get("/api/traffic/sessions/3");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: sessions });
    expect(traffic.getTrafficSessionsForWeek).toHaveBeenCalledWith(3);
  });

  it("returns the entry count for a week", async () => {
    traffic.getTrafficEntryCountForWeek.mockResolvedValue(42);
    const res = await request(appForEndpoints()).get("/api/traffic/entry-count/2");
    expect(res.body).toEqual({ data: 42 });
  });

  it("rejects a week that is not a campus week", async () => {
    const res = await request(appForEndpoints()).get("/api/traffic/entry-count/0");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^week_num /);
  });

  it("returns entry counts for several weeks", async () => {
    traffic.getTrafficEntryCountsForWeeks.mockResolvedValue([{ weekNumber: 1, entryCount: 4 }]);
    const res = await request(appForEndpoints()).post("/api/traffic/entry-counts").send({ weekNumbers: [1] });
    expect(res.body).toEqual({ data: [{ weekNumber: 1, entryCount: 4 }] });
    expect(traffic.getTrafficEntryCountsForWeeks).toHaveBeenCalledWith([1]);
  });

  it("rejects weekNumbers that is not an array", async () => {
    const res = await request(appForEndpoints()).post("/api/traffic/entry-counts").send({ weekNumbers: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/weekNumbers/);
  });
});

describe("/api/daily-activity/minutes", () => {
  it("returns total minutes", async () => {
    activity.getTotalMinutesForMenteeWeek.mockResolvedValue(90);
    const res = await request(appForEndpoints()).get(
      "/api/daily-activity/minutes?menteeUid=123&weekNum=4&logSource=front_desk",
    );
    expect(res.body).toEqual({ data: 90 });
    expect(activity.getTotalMinutesForMenteeWeek).toHaveBeenCalledWith({
      menteeUid: "123",
      weekNum: 4,
      logSource: "front_desk",
    });
  });

  it.each([
    ["menteeUid", "weekNum=4&logSource=front_desk"],
    ["weekNum", "menteeUid=123&logSource=front_desk"],
    ["logSource", "menteeUid=123&weekNum=4"],
  ])("requires %s", async (field, query) => {
    const res = await request(appForEndpoints()).get(`/api/daily-activity/minutes?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain(field);
  });
});
