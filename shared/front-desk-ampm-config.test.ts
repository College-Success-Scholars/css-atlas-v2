import { describe, expect, it } from "vitest";
import {
  FRONT_DESK_SHIFT_LABELS,
  GRACE_AFTER_END_MINUTES,
  GRACE_BEFORE_START_MINUTES,
  SHIFT_CLOSING,
  SHIFT_MAIN,
  SHIFT_OPENING,
  computeReminderOwed,
  isCreatedAtWithinShift,
  parseShiftWindow,
} from "./front-desk-ampm-config.js";

// A plain Wednesday in EDT, well clear of either DST transition.
const EDT = "-04:00";
const at = (clock: string, offset = EDT) => `2026-10-14T${clock}:00${offset}`;

describe("parseShiftWindow", () => {
  it("reads the window out of each known label", () => {
    expect(parseShiftWindow(SHIFT_OPENING)).toMatchObject({
      startMinute: 8 * 60,
      endMinute: 10 * 60,
    });
    expect(parseShiftWindow(SHIFT_MAIN)).toMatchObject({
      startMinute: 10 * 60,
      endMinute: 18 * 60,
    });
    expect(parseShiftWindow(SHIFT_CLOSING)).toMatchObject({
      startMinute: 18 * 60,
      endMinute: 20 * 60,
    });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseShiftWindow(`  ${SHIFT_MAIN}  `)).not.toBeNull();
  });

  it("rejects anything that is not a configured label", () => {
    expect(parseShiftWindow("9:00 AM - 5:00 PM")).toBeNull();
    expect(parseShiftWindow("10:00 AM - 6:00 PM (Main)")).toBeNull();
    expect(parseShiftWindow("")).toBeNull();
    expect(parseShiftWindow(null)).toBeNull();
    expect(parseShiftWindow(undefined)).toBeNull();
  });
});

describe("isCreatedAtWithinShift — boundaries per shift", () => {
  // Grace is 0 before / 60 after, so the valid window is
  // [shift start, shift end + 1h] in Eastern wall-clock time.
  const cases = [
    { label: SHIFT_OPENING, firstValid: "08:00", lastValid: "11:00", tooEarly: "07:59", tooLate: "11:01" },
    { label: SHIFT_MAIN, firstValid: "10:00", lastValid: "19:00", tooEarly: "09:59", tooLate: "19:01" },
    { label: SHIFT_CLOSING, firstValid: "18:00", lastValid: "21:00", tooEarly: "17:59", tooLate: "21:01" },
  ];

  for (const { label, firstValid, lastValid, tooEarly, tooLate } of cases) {
    describe(label, () => {
      it(`is valid exactly at the shift start (${firstValid})`, () => {
        expect(isCreatedAtWithinShift(at(firstValid), label)).toBe(true);
      });

      it(`is invalid one minute before the shift start (${tooEarly})`, () => {
        expect(isCreatedAtWithinShift(at(tooEarly), label)).toBe(false);
      });

      it(`is valid exactly at shift end plus grace (${lastValid})`, () => {
        expect(isCreatedAtWithinShift(at(lastValid), label)).toBe(true);
      });

      it(`is invalid one minute past shift end plus grace (${tooLate})`, () => {
        expect(isCreatedAtWithinShift(at(tooLate), label)).toBe(false);
      });
    });
  }
});

describe("isCreatedAtWithinShift — null and junk input", () => {
  it("is false for a null or unknown shift rather than throwing", () => {
    expect(isCreatedAtWithinShift(at("12:00"), null)).toBe(false);
    expect(isCreatedAtWithinShift(at("12:00"), undefined)).toBe(false);
    expect(isCreatedAtWithinShift(at("12:00"), "Whenever")).toBe(false);
  });

  it("is false for a null or unparseable timestamp rather than throwing", () => {
    expect(isCreatedAtWithinShift(null, SHIFT_MAIN)).toBe(false);
    expect(isCreatedAtWithinShift(undefined, SHIFT_MAIN)).toBe(false);
    expect(isCreatedAtWithinShift("not a date", SHIFT_MAIN)).toBe(false);
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(isCreatedAtWithinShift(new Date(at("12:00")), SHIFT_MAIN)).toBe(true);
  });
});

describe("isCreatedAtWithinShift — DST correctness", () => {
  // Windows are wall-clock. Adding minutes to Eastern midnight instead would
  // read 10:00 AM as 11:00 AM on the spring-forward day and fail these.
  it("holds on the spring-forward day (2027-03-14, clocks jump at 2 AM)", () => {
    // EDT (-04:00) is already in effect by 9 AM on this day.
    expect(isCreatedAtWithinShift("2027-03-14T10:00:00-04:00", SHIFT_MAIN)).toBe(true);
    expect(isCreatedAtWithinShift("2027-03-14T09:59:00-04:00", SHIFT_MAIN)).toBe(false);
  });

  it("holds on the fall-back day (2026-11-01, clocks repeat at 2 AM)", () => {
    expect(isCreatedAtWithinShift("2026-11-01T10:00:00-05:00", SHIFT_MAIN)).toBe(true);
    expect(isCreatedAtWithinShift("2026-11-01T19:01:00-05:00", SHIFT_MAIN)).toBe(false);
  });
});

describe("isCreatedAtWithinShift — grace overrides", () => {
  it("honours a wider trailing grace", () => {
    expect(isCreatedAtWithinShift(at("19:30"), SHIFT_MAIN)).toBe(false);
    expect(
      isCreatedAtWithinShift(at("19:30"), SHIFT_MAIN, { graceAfterEndMinutes: 120 })
    ).toBe(true);
  });

  it("honours a leading grace when one is supplied", () => {
    expect(isCreatedAtWithinShift(at("09:45"), SHIFT_MAIN)).toBe(false);
    expect(
      isCreatedAtWithinShift(at("09:45"), SHIFT_MAIN, { graceBeforeStartMinutes: 30 })
    ).toBe(true);
  });
});

describe("config surface", () => {
  it("exposes exactly the three form labels", () => {
    expect(FRONT_DESK_SHIFT_LABELS).toHaveLength(3);
    expect(new Set(FRONT_DESK_SHIFT_LABELS).size).toBe(3);
  });

  it("defaults grace to none before and an hour after", () => {
    expect(GRACE_BEFORE_START_MINUTES).toBe(0);
    expect(GRACE_AFTER_END_MINUTES).toBe(60);
  });

  it("owes a reminder exactly when the shift is not valid", () => {
    expect(computeReminderOwed(false)).toBe(true);
    expect(computeReminderOwed(true)).toBe(false);
  });
});
