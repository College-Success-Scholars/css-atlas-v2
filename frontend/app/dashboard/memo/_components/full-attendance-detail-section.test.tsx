import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("./memo-accordion-section", () => ({
  MemoAccordionSection: ({ children }: { children: React.ReactNode }) =>
    React.createElement("section", null, children),
}))

import { FullAttendanceDetailSection } from "./full-attendance-detail-section"
import type { FullAttendanceDetailSectionData } from "../types"

const data: FullAttendanceDetailSectionData = {
  rightLabel: "Front desk · Study sessions · WAHF",
  wahfCensus: { onTime: 1, late: 0, missing: 0 },
  tabs: [
    {
      id: "front-desk",
      label: "Front desk",
      rows: [
        {
          scholarId: "mentee-1",
          isMentee: true,
          scholarName: "Alice Scholar",
          scholarYear: "Freshman",
          completedMinutes: 120,
          excuseMinutes: 0,
          requiredMinutes: 120,
          completionPct: 100,
        },
        {
          scholarId: "scholar-2",
          isMentee: false,
          scholarName: "Bob Scholar",
          scholarYear: "Sophomore",
          completedMinutes: 30,
          excuseMinutes: 0,
          requiredMinutes: 120,
          completionPct: 25,
        },
      ],
    },
  ],
}

describe("FullAttendanceDetailSection", () => {
  it("links mentee names and leaves non-mentee names plain", () => {
    const html = renderToStaticMarkup(<FullAttendanceDetailSection data={data} />)

    expect(html).toContain("Alice Scholar")
    expect(html).toContain('href="/dashboard/directory/mentee-1"')
    expect(html).toContain("Bob Scholar")
    expect(html).not.toContain('href="/dashboard/directory/scholar-2"')
  })
})
