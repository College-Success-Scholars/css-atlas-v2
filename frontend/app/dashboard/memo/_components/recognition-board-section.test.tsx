import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("./memo-accordion-section", () => ({
  MemoAccordionSection: ({
    children,
    title,
    description,
    badgeText,
    rightLabel,
  }: {
    children: React.ReactNode
    title: string
    description?: string
    badgeText?: React.ReactNode
    rightLabel?: string
  }) =>
    React.createElement(
      "section",
      { "data-testid": "recognition-board" },
      React.createElement("h2", null, title),
      badgeText ? React.createElement("span", null, badgeText) : null,
      description ? React.createElement("p", null, description) : null,
      rightLabel ? React.createElement("span", null, rightLabel) : null,
      children
    ),
}))

import { RecognitionBoardSection } from "./recognition-board-section"
import type { RecognitionBoardSectionData } from "../types"

const censusData: RecognitionBoardSectionData = {
  badgeText: "3 grades",
  rightLabel: "90–100% · 70–89% · Below 70%",
  bands: [
    {
      id: "high",
      label: "90 – 100%",
      entries: [{ scholarName: "Alice Scholar", scholarId: "alice-1", isMentee: true, course: "CMSC131", assessment: "Quiz", grade: "95%", percent: 95 }],
    },
    {
      id: "mid",
      label: "70 – 89%",
      entries: [],
    },
    {
      id: "low",
      label: "Below 70%",
      entries: [{ scholarName: "Bob Scholar", scholarId: "bob-1", isMentee: false, course: "MATH140", assessment: "Exam", grade: "60%", percent: 60 }],
    },
  ],
}

describe("RecognitionBoardSection", () => {
  it("renders three WAHF grade bands with scholar · course · assessment and grade", () => {
    const html = renderToStaticMarkup(<RecognitionBoardSection data={censusData} />)

    expect(html).toContain("Recognition board")
    expect(html).toContain("90 – 100%")
    expect(html).toContain("70 – 89%")
    expect(html).toContain("Below 70%")
    expect(html).toContain("Alice Scholar")
    expect(html).toContain("CMSC131")
    expect(html).toContain("Quiz")
    expect(html).toContain("95%")
    expect(html).toContain("Bob Scholar")
    expect(html).toContain("MATH140")
    expect(html).toContain("Exam")
    expect(html).toContain("60%")
    expect(html).toContain("None")
    expect(html).toContain("md:grid-cols-3")
    expect(html).toContain("text-success")
    expect(html).toContain("text-warning-muted-foreground")
    expect(html).toContain("text-destructive")
    expect(html).toContain("tabular-nums")
    expect(html).toContain('href="/dashboard/directory/alice-1"')
    expect(html).not.toContain('href="/dashboard/directory/bob-1"')
    expect(html).not.toContain("emerald")
    expect(html).not.toContain("amber")
    expect(html).not.toContain('data-slot="table"')
    expect(html).not.toContain("Strong completion this week")
  })

  it("shows empty-week copy when no assignment grades were parsed", () => {
    const html = renderToStaticMarkup(
      <RecognitionBoardSection
        data={{
          badgeText: "0 grades",
          rightLabel: "90–100% · 70–89% · Below 70%",
          bands: [
            { id: "high", label: "90 – 100%", entries: [] },
            { id: "mid", label: "70 – 89%", entries: [] },
            { id: "low", label: "Below 70%", entries: [] },
          ],
        }}
      />
    )

    expect(html).toContain("No assignment grades submitted this week.")
    expect(html).not.toContain("90 – 100%")
    expect(html).not.toContain("None")
  })
})
