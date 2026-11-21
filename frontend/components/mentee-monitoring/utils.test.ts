import { describe, it, expect } from "vitest"
import {
  formatClockRange,
  formatCompactHours,
} from "./utils"

describe("session row formatting", () => {
  it("renders a compact program-local clock range without meridiem", () => {
    expect(
      formatClockRange("2026-09-11T16:00:00.000Z", "2026-09-11T18:00:00.000Z"),
    ).toBe("12:00pm–2:00pm")
    expect(
      formatClockRange("2026-09-10T15:00:00.000Z", "2026-09-10T16:05:00.000Z"),
    ).toBe("11:00am–12:05pm")
  })

  it("renders whole hours without a decimal and fractional hours with one", () => {
    expect(formatCompactHours(120)).toBe("2h")
    expect(formatCompactHours(65)).toBe("1.1h")
  })
})
