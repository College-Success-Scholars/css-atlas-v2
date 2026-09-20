import { describe, expect, it } from "vitest"

import {
  formatDurationShort,
  formatEnteredTime,
  formatSnapshotLabel,
} from "./room-format"

describe("formatEnteredTime", () => {
  it("formats an Eastern wall-clock time", () => {
    // 16:30 UTC on 2026-09-06 is 12:30 PM EDT.
    expect(formatEnteredTime("2026-09-06T16:30:00.000Z")).toBe("12:30 PM")
  })
})

describe("formatDurationShort", () => {
  it("floors to minutes and never goes negative", () => {
    expect(formatDurationShort(0)).toBe("0m")
    expect(formatDurationShort(59_999)).toBe("0m")
    expect(formatDurationShort(-1)).toBe("0m")
  })

  it("shows hours when the stay is at least 60 minutes", () => {
    expect(formatDurationShort(60_000)).toBe("1m")
    expect(formatDurationShort(3_600_000)).toBe("1h 0m")
    expect(formatDurationShort(3_660_000)).toBe("1h 1m")
  })
})

describe("formatSnapshotLabel", () => {
  it("appends ET to an Eastern datetime", () => {
    const label = formatSnapshotLabel(new Date("2026-09-06T16:30:00.000Z"))
    expect(label).toBe("Sunday, September 6, 2026, 12:30 PM ET")
  })
})
