import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("./memo-accordion-section", () => ({
  MemoAccordionSection: ({ children }: { children: React.ReactNode }) =>
    React.createElement("section", null, children),
}))

import { TutoringLogSection } from "./tutoring-log-section"
import type { TutoringLogSectionData } from "../types"

const data: TutoringLogSectionData = {
  badgeText: "2 sessions",
  rightLabel: "Sessions · Empty sessions",
  tabs: [
    {
      id: "sessions",
      label: "Sessions",
      rows: [
        {
          id: 1,
          scholarId: "mentee-1",
          isMentee: true,
          scholarName: "Alice Scholar",
          dayOfWeek: "Mon",
          tutorName: "Dr. Smith",
          courses: ["Calculus I"],
          startTime: "2:00 PM",
          endTime: "3:00 PM",
        },
        {
          id: 2,
          scholarId: "scholar-2",
          isMentee: false,
          scholarName: "Bob Scholar",
          dayOfWeek: "Tue",
          tutorName: "Dr. Jones",
          courses: ["Chemistry"],
          startTime: "4:00 PM",
          endTime: "5:00 PM",
        },
      ],
    },
  ],
}

describe("TutoringLogSection", () => {
  it("links mentee names in the sessions tab and leaves non-mentee names plain", () => {
    const html = renderToStaticMarkup(<TutoringLogSection data={data} />)

    expect(html).toContain("Alice Scholar")
    expect(html).toContain('href="/dashboard/directory/mentee-1"')
    expect(html).toContain("Bob Scholar")
    expect(html).not.toContain('href="/dashboard/directory/scholar-2"')
  })
})
