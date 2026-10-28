import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import type {
  HourWeekSummary,
  ShiftEvidence,
  WeekTier,
} from "@/lib/types/mentee-review"

import { HourSummaryCard } from "./hour-summary-card"
import { TIER_UI } from "./tier-badge"
import tierStyles from "./tier-styles.module.css"

// Markup tests use stable class names; check-tier-navigation.mjs exercises the real CSS in Chrome.
vi.mock("./tier-styles.module.css", () => ({ default: {
  palette: "tier-palette", rare: "tier-rare", epic: "tier-epic", legendary: "tier-legendary",
  pill: "tier-pill", cell: "tier-cell", card: "tier-card", text: "tier-text",
  bar: "tier-bar", sheen: "tier-sheen", legendaryHours: "tier-legendary-hours",
} }))

const ATTENDED_SHIFT: ShiftEvidence = {
  sourceId: "shift-1",
  kind: "front_desk",
  date: "2026-09-11",
  scheduledStart: "2026-09-11T16:00:00.000Z",
  scheduledEnd: "2026-09-11T18:00:00.000Z",
  scheduledMinutes: 120,
  loggedStart: "2026-09-11T16:00:00.000Z",
  loggedEnd: "2026-09-11T18:00:00.000Z",
  overlapMinutes: 120,
  status: "attended",
}

function summary(overrides: Partial<HourWeekSummary> = {}): HourWeekSummary {
  return {
    kind: "front_desk",
    assignmentAvailable: true,
    loggedMinutes: 340,
    excuseMinutes: 0,
    excuseDescription: null,
    targetMinutes: 300,
    percent: 113.333,
    band: "green",
    displayHours: 5.7,
    overageMinutes: 40,
    pending: false,
    noShowCount: 0,
    hasActivity: true,
    shifts: [ATTENDED_SHIFT],
    offShiftLogs: [],
    ...overrides,
  }
}

const TIERS: WeekTier[] = ["rare", "epic", "legendary"]

describe("HourSummaryCard", () => {
  it("renders each scheduled shift as day, scheduled time, and compact duration under the bar", () => {
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary()} />,
    )

    expect(html).toContain("Assigned shifts")
    expect(html).toContain(">Fri<")
    expect(html).toContain("12:00pm–2:00pm")
    expect(html).toContain(">2h<")
    expect(html).toContain('data-slot="scheduled-shifts"')
    expect(html).toContain('data-slot="completion-bar"')
    expect(html).toContain('role="progressbar"')
  })

  it.each(["front_desk", "study_session"] as const)("shows the %s percentage without redundant pending text", (kind) => {
    const html = renderToStaticMarkup(
      <HourSummaryCard
        summary={summary({ kind, percent: 70, band: "orange", pending: true })}
      />,
    )

    expect(html).toContain("70.0%")
    expect(html).not.toContain("In progress")
  })

  it("preserves the no-hours-required status when there is no target", () => {
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary({ targetMinutes: 0, percent: null, pending: true })} />,
    )

    expect(html).toContain("No hours required")
    expect(html).not.toContain("In progress")
  })

  it("does not render the old no-shift assignment copy", () => {
    const html = renderToStaticMarkup(
      <HourSummaryCard
        summary={summary({
          assignmentAvailable: false,
          shifts: [],
          offShiftLogs: [],
          targetMinutes: null,
          percent: null,
          band: null,
        })}
      />,
    )

    expect(html).not.toContain("No shifts assigned")
  })

  it("shows scheduled shifts the mentee missed with No-show status", () => {
    const noShow: ShiftEvidence = {
      ...ATTENDED_SHIFT,
      sourceId: "shift-2",
      loggedStart: null,
      loggedEnd: null,
      overlapMinutes: 0,
      status: "no_show",
    }
    const html = renderToStaticMarkup(
      <HourSummaryCard
        summary={summary({ shifts: [noShow], noShowCount: 1 })}
      />,
    )

    expect(html).toContain("Assigned shifts")
    expect(html).toContain("12:00pm–2:00pm")
    expect(html).toContain("No-show")
    expect(html).not.toContain(">2h<")
  })

  it("shows logged clock range under the assigned window when they differ", () => {
    const shortShift: ShiftEvidence = {
      ...ATTENDED_SHIFT,
      loggedStart: "2026-09-11T16:15:00.000Z",
      loggedEnd: "2026-09-11T17:45:00.000Z",
      overlapMinutes: 90,
      status: "short",
    }
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary({ shifts: [shortShift], overageMinutes: 0 })} />,
    )
    expect(html).toContain("12:00pm–2:00pm")
    expect(html).toContain("logged 12:15pm–1:45pm")
    expect(html).toContain("1.5h · Short")
  })

  it("lists upcoming and in-progress scheduled shifts with status labels", () => {
    const upcoming: ShiftEvidence = {
      ...ATTENDED_SHIFT,
      sourceId: "shift-up",
      date: "2026-09-14",
      scheduledStart: "2026-09-14T16:00:00.000Z",
      scheduledEnd: "2026-09-14T18:00:00.000Z",
      loggedStart: null,
      loggedEnd: null,
      overlapMinutes: 0,
      status: "upcoming",
    }
    const active: ShiftEvidence = {
      ...ATTENDED_SHIFT,
      sourceId: "shift-active",
      date: "2026-09-10",
      scheduledStart: "2026-09-10T16:00:00.000Z",
      scheduledEnd: "2026-09-10T18:00:00.000Z",
      loggedStart: "2026-09-10T16:00:00.000Z",
      loggedEnd: "2026-09-10T17:00:00.000Z",
      overlapMinutes: 60,
      status: "active",
    }
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary({ shifts: [upcoming, active] })} />,
    )

    expect(html).toContain("Upcoming")
    expect(html).toContain(">1h<")
    expect(html).toContain("Thu")
    expect(html).toContain("Mon")
  })

  it.each(TIERS)("shows the %s tier pill, card treatment, and tinted extra minutes", (tier) => {
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary()} tier={tier} />,
    )

    expect(html).toContain(`data-tier="${tier}"`)
    expect(html).toContain(TIER_UI[tier].card)
    expect(html).toContain(TIER_UI[tier].text)
    expect(html).toContain("+40 min extra")
  })

  it.each(TIERS)("keeps the %s badge beside the percentage instead of stacking another header row", (tier) => {
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary({ pending: true })} tier={tier} />,
    )
    const metrics = html.match(/<div class="([^"]+)" data-slot="completion-metrics">(.*?)<\/div>/)

    expect(metrics).not.toBeNull()
    expect(metrics![1]).toContain("flex-nowrap")
    expect(metrics![1]).toContain("min-h-6")
    expect(metrics![1]).not.toContain("flex-col")
    expect(metrics![2]).toContain(`data-tier="${tier}"`)
    expect(metrics![2]).toContain("113.3%")
    expect(metrics![2]).not.toContain("In progress")
    expect(html).not.toContain("In progress")
    expect(metrics![2]).toContain("px-2 py-0.75")
    expect(metrics![2]).toContain("@max-[340px]:text-[11px]")
  })

  it("adds the legendary text shadow to the hours number", () => {
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary()} tier="legendary" />,
    )

    expect(html).toContain(tierStyles.legendaryHours)
  })

  it("renders off-shift logs under Extra logged with clock times", () => {
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary({ shifts: [], offShiftLogs: [{
        kind: "front_desk", sourceIds: ["log-1"],
        start: "2026-09-11T18:01:00.000Z", end: "2026-09-11T20:07:00.000Z", minutes: 126,
      }] })} />,
    )
    expect(html).toContain("Extra logged")
    expect(html).toContain('data-slot="off-shift-logs"')
    expect(html).toContain(">Fri<")
    expect(html).not.toContain(">202<")
    expect(html).toContain("2:01pm–4:07pm")
    expect(html).toContain(">2.1h<")
    expect(html).not.toContain("Not scheduled")
    expect(html).toContain('class="flex items-center gap-2 border-t')
  })

  it("fills the bar for a completed target even without a shift assignment", () => {
    const html = renderToStaticMarkup(
      <HourSummaryCard summary={summary({ assignmentAvailable: false, percent: null })} tier="rare" />,
    )
    expect(html).toContain('aria-valuenow="100"')
    expect(html).toContain("width:100%")
    expect(html).toContain(TIER_UI.rare.bar)
  })

  it("shows excused hours and the excuse note beside logged hours", () => {
    const html = renderToStaticMarkup(
      <HourSummaryCard
        summary={summary({
          loggedMinutes: 240,
          excuseMinutes: 30,
          excuseDescription: "Doctor appointment",
          percent: 90,
          overageMinutes: 0,
        })}
      />,
    )
    expect(html).toContain("0.5h excused")
    expect(html).toContain("Doctor appointment")
  })
})
