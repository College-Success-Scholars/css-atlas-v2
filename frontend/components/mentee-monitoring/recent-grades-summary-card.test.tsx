import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import type { LatestGradeEntry, LatestGradesSummary } from "@/lib/types/mentee-review"

import { RecentGradesSummaryCard } from "./recent-grades-summary-card"

function entry(overrides: Partial<LatestGradeEntry> = {}): LatestGradeEntry {
  return {
    submissionId: "current",
    submittedAt: "2026-09-16T16:00:00.000Z",
    course: "CMSC420",
    assessment: "Quiz",
    rawGrade: "90%",
    percent: 90,
    band: "green",
    comparison: null,
    firstGrade: false,
    ...overrides,
  }
}

function summary(overrides: Partial<LatestGradesSummary> = {}): LatestGradesSummary {
  return {
    status: "grades",
    // The newest WAHF may be empty; it must not supply the displayed entries' dates.
    submissionId: "empty",
    submittedAt: "2026-09-17T16:00:00.000Z",
    entries: [entry()],
    ...overrides,
  }
}

describe("RecentGradesSummaryCard", () => {
  it("labels the two-week window and displays each submission's Eastern date", () => {
    const html = renderToStaticMarkup(<RecentGradesSummaryCard summary={summary({ entries: [
      entry(),
      entry({ submissionId: "previous", submittedAt: "2026-09-09T02:30:00.000Z" }),
    ] })} />)

    expect(html).toContain("This week and last week")
    expect(html).toContain('aria-label="Grades from this week and last week"')
    expect(html).toContain('dateTime="2026-09-16T16:00:00.000Z"')
    expect(html).toContain("Sep 16 at 12:00pm ET")
    expect(html).toContain("Sep 8 at 10:30pm ET")
    expect(html).not.toContain("Sep 17")
    expect(html).not.toContain("latest WAHF")
    expect(html.match(/<li /g)).toHaveLength(2)
  })

  it("preserves repeated grades, order, raw unsupported scores, and comparison labels", () => {
    const html = renderToStaticMarkup(<RecentGradesSummaryCard summary={summary({ entries: [
      entry({ assessment: "Exam", comparison: { direction: "up", priorPercent: 80, priorAssessment: "Quiz" } }),
      entry({ firstGrade: true }),
      entry({ firstGrade: true }),
      entry({ course: "ENGL101", assessment: "Essay", rawGrade: "A-", percent: null, band: null }),
    ] })} />)

    expect(html.match(/<li /g)).toHaveLength(4)
    expect(html.match(/First grade logged/g)).toHaveLength(2)
    expect(html).toContain("↑ from 80.0% (Quiz)")
    expect(html).toContain(">A-<")
    expect(html.indexOf("Exam")).toBeLessThan(html.indexOf("First grade logged"))
    expect(html.indexOf("First grade logged")).toBeLessThan(html.indexOf("ENGL101"))
  })

  it.each([
    ["empty", "No grades reported this week or last week."],
    ["error", "Grades could not be read."],
  ] as const)("shows the %s state without an outdated latest-submission claim", (status, message) => {
    const html = renderToStaticMarkup(<RecentGradesSummaryCard summary={summary({ status, entries: [] })} />)
    expect(html).toContain(message)
    expect(html).not.toContain("<ul")
    expect(html).not.toContain("most recent WAHF")
  })

  it("supports legacy single-submission fixtures with summary provenance only", () => {
    const html = renderToStaticMarkup(<RecentGradesSummaryCard summary={summary({
      submissionId: "legacy",
      submittedAt: "2026-09-16T16:00:00.000Z",
      entries: [entry({ submissionId: undefined, submittedAt: undefined })],
    })} />)
    expect(html).toContain("Sep 16 at 12:00pm ET")
  })
})
