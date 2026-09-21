import { describe, it, expect } from "vitest"

import {
  formatDuration,
  formatEstimatedExit,
  formatLeaveAtClock,
  leaveAtFromNowPlusMinutes,
  leaveAtToTimeInputValue,
  durationMinFromLeaveAt,
  parseLeaveAtTimeInput,
  parseTypedLeaveAtClock,
  parseLeaveAtMask,
  formatLeaveAtMask,
  sanitizeLeaveAtMaskHour,
  sanitizeLeaveAtMaskMinute,
  validateLeaveAt,
} from "./traffic-format"
import { parseEasternDate } from "@/lib/format/time"

describe("traffic-format", () => {
  it("formatDuration covers hours and minutes", () => {
    expect(formatDuration(0)).toBe("0 min")
    expect(formatDuration(45)).toBe("45 min")
    expect(formatDuration(60)).toBe("1 hr")
    expect(formatDuration(90)).toBe("1 hr 30 min")
  })

  it("formatEstimatedExit projects from an explicit clock in Eastern", () => {
    // 2024-06-15 14:00 EDT = 18:00 UTC
    const base = new Date("2024-06-15T18:00:00.000Z")
    expect(formatEstimatedExit(60, base)).toBe("3:00 PM")
    expect(formatEstimatedExit(0, base)).toBe("--:-- --")
  })

  it("leaveAtFromNowPlusMinutes and durationMinFromLeaveAt round-trip", () => {
    const now = new Date("2024-06-15T18:00:00.000Z")
    const leaveAt = leaveAtFromNowPlusMinutes(90, now)
    expect(durationMinFromLeaveAt(leaveAt, now)).toBe(90)
  })

  it("validateLeaveAt rejects past and >12h ahead (Eastern)", () => {
    const now = new Date("2024-06-15T18:00:00.000Z") // 2:00 PM EDT
    const past = leaveAtFromNowPlusMinutes(-5, now)
    const far = leaveAtFromNowPlusMinutes(721, now)
    const ok = leaveAtFromNowPlusMinutes(60, now)

    expect(validateLeaveAt(past, now)).toEqual({
      ok: false,
      error: "Leave time must be in the future.",
    })
    expect(validateLeaveAt(far, now)).toEqual({
      ok: false,
      error: "Leave time must be within 12 hours from now.",
    })
    expect(validateLeaveAt(ok, now)).toEqual({ ok: true, durationMin: 60 })
  })

  it("parseLeaveAtTimeInput uses next Eastern occurrence", () => {
    // 3:00 PM EDT
    const now = new Date("2024-06-15T19:00:00.000Z")
    const laterToday = parseLeaveAtTimeInput("16:00", now)
    expect(formatLeaveAtClock(laterToday)).toBe("4:00 PM")
    expect(durationMinFromLeaveAt(laterToday, now)).toBe(60)

    // 2:00 PM is earlier than 3:00 PM → rolls to tomorrow (~23h) → rejected as >12h
    const tomorrow = parseLeaveAtTimeInput("14:00", now)
    expect(leaveAtToTimeInputValue(tomorrow)).toBe("14:00")
    expect(durationMinFromLeaveAt(tomorrow, now)).toBe(23 * 60)
    expect(validateLeaveAt(tomorrow, now)).toEqual({
      ok: false,
      error: "Leave time must be within 12 hours from now.",
    })
  })

  it("parseTypedLeaveAtClock accepts 12h and 24h typed times", () => {
    expect(parseTypedLeaveAtClock("4:30 PM")).toBe("16:30")
    expect(parseTypedLeaveAtClock("4:30pm")).toBe("16:30")
    expect(parseTypedLeaveAtClock("12:05 AM")).toBe("00:05")
    expect(parseTypedLeaveAtClock("12:05 PM")).toBe("12:05")
    expect(parseTypedLeaveAtClock("16:30")).toBe("16:30")
    expect(parseTypedLeaveAtClock("9:05")).toBe("09:05")
    expect(parseTypedLeaveAtClock("not a time")).toBeNull()
    expect(parseTypedLeaveAtClock("25:00")).toBeNull()
  })

  it("leave-at mask formats and parses _:__ AM/PM", () => {
    expect(formatLeaveAtMask({ hour: "", minute: "", period: "PM" })).toBe(
      "_:__ PM"
    )
    expect(formatLeaveAtMask({ hour: "3", minute: "4", period: "AM" })).toBe(
      "3:4_ AM"
    )
    expect(formatLeaveAtMask({ hour: "3", minute: "46", period: "PM" })).toBe(
      "3:46 PM"
    )
    expect(
      parseLeaveAtMask({ hour: "4", minute: "30", period: "PM" })
    ).toBe("16:30")
    expect(parseLeaveAtMask({ hour: "4", minute: "3", period: "PM" })).toBeNull()
    expect(sanitizeLeaveAtMaskHour("15")).toBe("1")
    expect(sanitizeLeaveAtMaskHour("12")).toBe("12")
    expect(sanitizeLeaveAtMaskMinute("99")).toBe("9")
    expect(sanitizeLeaveAtMaskMinute("59")).toBe("59")
  })

  it("leaveAtToTimeInputValue formats Eastern HH:mm", () => {
    const leaveAt = parseEasternDate("2024-06-15")
    // midnight Eastern
    expect(leaveAtToTimeInputValue(leaveAt)).toBe("00:00")
  })
})
