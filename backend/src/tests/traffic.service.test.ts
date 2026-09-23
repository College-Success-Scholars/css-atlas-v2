import { describe, expect, it } from "vitest";
import {
  comparableLastWeekThroughDate,
  countTrafficEntriesThrough,
  sameTimeLastWeek,
} from "../services/traffic.service.js";
import { campusWeekToDateRange, getWeekFetchEnd } from "../services/time.service.js";

describe("sameTimeLastWeek", () => {
  it("keeps Eastern clock time seven calendar days earlier", () => {
    const thursdayAfternoon = new Date("2026-09-17T18:40:00.000Z");
    const lastThursday = sameTimeLastWeek(thursdayAfternoon);
    expect(lastThursday.toISOString()).toBe("2026-09-10T18:40:00.000Z");
  });
});

describe("comparableLastWeekThroughDate", () => {
  it("returns null for week 1", () => {
    expect(comparableLastWeekThroughDate(new Date("2026-09-17T18:40:00.000Z"), 1, 3)).toBeNull();
  });

  it("clips the prior week to the same weekday and time when viewing the current week", () => {
    const now = new Date("2026-09-17T18:40:00.000Z");
    const through = comparableLastWeekThroughDate(now, 3, 3);
    expect(through?.toISOString()).toBe("2026-09-10T18:40:00.000Z");
  });

  it("uses the full prior week when viewing a past week", () => {
    const now = new Date("2026-09-17T18:40:00.000Z");
    const through = comparableLastWeekThroughDate(now, 2, 3);
    const priorEnd = getWeekFetchEnd(campusWeekToDateRange(1)!);
    expect(through?.toISOString()).toBe(priorEnd.toISOString());
  });
});

describe("countTrafficEntriesThrough", () => {
  it("counts entry rows at or before the cutoff and ignores exits", () => {
    const through = new Date("2026-09-10T18:40:00.000Z");
    const rows = [
      { id: 1, created_at: "2026-09-10T12:00:00.000Z", uid: "a", traffic_type: "entry" },
      { id: 2, created_at: "2026-09-10T18:40:00.000Z", uid: "b", traffic_type: "entry" },
      { id: 3, created_at: "2026-09-10T18:40:01.000Z", uid: "c", traffic_type: "entry" },
      { id: 4, created_at: "2026-09-10T12:00:00.000Z", uid: "a", traffic_type: "exit" },
    ];
    expect(countTrafficEntriesThrough(rows, through)).toBe(2);
  });
});
