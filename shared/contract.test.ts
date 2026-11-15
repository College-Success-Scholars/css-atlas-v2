import { describe, expect, it } from "vitest";
import { campusWeekNumber, endpointPath, validate } from "./contract.js";
import { getWeekBoard, upsertExcuse } from "./contracts/attendance.js";

describe("endpointPath", () => {
  it("fills path parameters and appends the query string", () => {
    expect(endpointPath(getWeekBoard, { params: { week_num: 3 }, query: { kind: "front_desk" } })).toBe(
      "/api/attendance/week/3?kind=front_desk",
    );
  });

  it("returns the bare path when there is nothing to add", () => {
    expect(endpointPath(upsertExcuse, {})).toBe("/api/attendance/excuse");
  });

  it("refuses to build a path with a missing parameter", () => {
    expect(() => endpointPath(getWeekBoard, { params: {} })).toThrow(/week_num/);
  });
});

describe("campusWeekNumber", () => {
  it("accepts a number or a numeric string and yields a number", () => {
    expect(validate(campusWeekNumber, 4)).toEqual({ ok: true, data: 4 });
    expect(validate(campusWeekNumber, "12")).toEqual({ ok: true, data: 12 });
  });

  it.each([0, -1, 1.5, "abc", "1x", "", null])("rejects %j", (value) => {
    expect(validate(campusWeekNumber, value).ok).toBe(false);
  });
});

describe("validate", () => {
  it("reports the first problem as a field and a message", () => {
    expect(validate(getWeekBoard.query, { kind: "study" })).toMatchObject({ ok: false, field: "kind" });
  });
});
