import { describe, expect, it } from "vitest";
import { campusWeekNumber, endpointPath, validate } from "./contract.js";
import { getWeekAttendanceForUids, getWeekBoard, upsertExcuse } from "./contracts/attendance.js";

describe("endpointPath", () => {
  it("fills path parameters and appends the query string", () => {
    expect(endpointPath(getWeekBoard, { params: { week_num: 3 }, query: { kind: "front_desk" } })).toBe(
      "/api/attendance/week/3?kind=front_desk",
    );
  });

  it("repeats the key for array query values", () => {
    expect(endpointPath({ ...getWeekBoard, path: "/api/x" }, { query: { uid: ["1", "2"], skip: undefined } })).toBe(
      "/api/x?uid=1&uid=2",
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

describe("validate — reporting", () => {
  it("says a missing field is required", () => {
    expect(validate(getWeekBoard.query, {})).toMatchObject({ ok: false, field: "kind", message: "is required" });
  });

  it("reports every problem, first one at the top level", () => {
    const result = validate(upsertExcuse.body, { scholar_uid: "", week_num: 0, kind: "x", excuse_min: -1, description: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.field)).toEqual(["scholar_uid", "week_num", "kind", "excuse_min"]);
    expect(result).toMatchObject({ field: "scholar_uid", message: "is required" });
  });

  it("normalises a batch of Scholar IDs and rejects one that is all blanks", () => {
    expect(validate(getWeekAttendanceForUids.body, { uids: [" 1 ", "", "2"] })).toEqual({ ok: true, data: { uids: ["1", "2"] } });
    expect(validate(getWeekAttendanceForUids.body, { uids: ["  "] })).toMatchObject({
      ok: false,
      field: "uids",
      message: "must contain at least one scholar UID",
    });
  });
});
