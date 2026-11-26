import { describe, expect, it } from "vitest";
import { formDeadline, formStatus, isLate } from "./form-status.js";
import { campusWeekToDateRange } from "./time.js";

const easternClock = (date: Date) =>
  date.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", hour: "numeric", minute: "2-digit", second: "2-digit" });

describe("formDeadline", () => {
  it("puts WAHF at the last moment of Thursday and WPL/MCF at Friday 5:00 PM, Eastern", () => {
    expect(easternClock(formDeadline("WAHF", 3)!)).toBe("Thursday 11:59:59 PM");
    expect(easternClock(formDeadline("WPL", 3)!)).toBe("Friday 5:00:00 PM");
    expect(formDeadline("MCF", 3)).toEqual(formDeadline("WPL", 3));
  });

  it("falls inside the campus week it belongs to", () => {
    const range = campusWeekToDateRange(10)!;
    for (const form of ["WAHF", "WPL", "MCF"] as const) {
      const due = formDeadline(form, 10)!.getTime();
      expect(due).toBeGreaterThan(range.startDate.getTime());
      expect(due).toBeLessThan(range.endDate.getTime());
    }
  });
});

describe("isLate", () => {
  const deadline = formDeadline("WAHF", 5)!;

  it("is late only strictly after the deadline", () => {
    expect(isLate("WAHF", deadline, 5)).toBe(false);
    expect(isLate("WAHF", new Date(deadline.getTime() + 1), 5)).toBe(true);
  });

  it("uses the submission's own campus week when none is given", () => {
    expect(isLate("WAHF", new Date(deadline.getTime() + 1).toISOString())).toBe(true);
    expect(isLate("WAHF", new Date(deadline.getTime() - 60_000).toISOString())).toBe(false);
  });

  it("judges against the requested week when one is given", () => {
    // A week-6 submission is late for week 5 but on time for week 6.
    const nextWeekMonday = campusWeekToDateRange(6)!.startDate;
    expect(isLate("WAHF", nextWeekMonday, 5)).toBe(true);
    expect(isLate("WAHF", nextWeekMonday, 6)).toBe(false);
  });
});

describe("formStatus (glossary: On-time, Late, Incomplete, Missing)", () => {
  it.each([
    [{ required: 1, completed: 0, late: false }, "missing"],
    [{ required: 1, completed: 1, late: false }, "on-time"],
    [{ required: 1, completed: 1, late: true }, "late"],
    [{ required: 3, completed: 0, late: false }, "missing"],
    [{ required: 3, completed: 1, late: false }, "incomplete"],
    [{ required: 3, completed: 1, late: true }, "incomplete"],
    [{ required: 3, completed: 3, late: false }, "on-time"],
    [{ required: 3, completed: 4, late: true }, "late"],
    [{ required: 0, completed: 0, late: false }, "on-time"],
  ] as const)("%j is %s", (submissions, status) => {
    expect(formStatus(submissions)).toBe(status);
  });
});
