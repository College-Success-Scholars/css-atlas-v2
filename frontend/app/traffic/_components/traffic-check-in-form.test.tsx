import React, { createRef } from "react"
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import {
  assertNoColorTransitionAll,
  assertThemeSafeMarkup,
} from "@/lib/theme/theme-safety.test-helpers"
import { TrafficCheckInForm } from "./traffic-check-in-form"
import { leaveAtFromNowPlusMinutes } from "./traffic-format"

const baseProps = {
  uid: "123456789",
  uidError: "",
  uidInputRef: createRef<HTMLInputElement>(),
  quickStay: 60 as const,
  leaveAt: leaveAtFromNowPlusMinutes(60, new Date("2024-06-15T18:00:00.000Z")),
  leaveAtError: "",
  isSubmitting: false,
  onUidChange: vi.fn(),
  onSelectQuickStay: vi.fn(),
  onLeaveAtTimeChange: vi.fn(),
  onSubmit: vi.fn(),
}

describe("TrafficCheckInForm theme safety", () => {
  it("avoids palette greens, bg-white, and transition-all on themed surfaces", () => {
    const markup = renderToStaticMarkup(<TrafficCheckInForm {...baseProps} />)
    assertThemeSafeMarkup(markup, "TrafficCheckInForm")
    assertNoColorTransitionAll(markup, "TrafficCheckInForm")
    expect(markup).toContain("bg-success")
    expect(markup).toContain("Record Traffic")
    expect(markup).toContain("What time are you leaving?")
    expect(markup).toContain("Quick stay")
    expect(markup).toContain("Enter 9-digit UID")
    expect(markup).toContain("Press Enter to submit")
    expect(markup).not.toContain("How long will you stay?")
    expect(markup).not.toContain("Custom Time Entry")
    expect(markup).not.toContain('type="time"')
    expect(markup).toContain("Type leave time")
  })

  it("uses destructive tokens for UID errors", () => {
    const markup = renderToStaticMarkup(
      <TrafficCheckInForm {...baseProps} uidError="UID must be exactly 9 digits" />
    )
    expect(markup).toContain("text-destructive")
    expect(markup).not.toMatch(/text-red-500|bg-red-50/)
    assertThemeSafeMarkup(markup, "TrafficCheckInForm (error)")
  })

  it("shows leave-at validation error at kiosk scale", () => {
    const markup = renderToStaticMarkup(
      <TrafficCheckInForm
        {...baseProps}
        leaveAtError="Leave time must be in the future."
      />
    )
    expect(markup).toContain("Leave time must be in the future.")
    expect(markup).toContain("text-destructive")
  })

  it("stays theme-safe under .dark", () => {
    const markup = renderToStaticMarkup(
      <div className="dark">
        <TrafficCheckInForm {...baseProps} />
      </div>
    )
    assertThemeSafeMarkup(markup, "TrafficCheckInForm (dark)")
  })
})
