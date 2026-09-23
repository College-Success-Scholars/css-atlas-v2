import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { WeeklyKpiCards } from "./weekly-kpi-cards"

describe("WeeklyKpiCards", () => {
  it("renders progress tracks on hours cards and skips them on count-only cards", () => {
    const html = renderToStaticMarkup(
      <WeeklyKpiCards
        cards={[
          {
            title: "Visits this week",
            primaryValue: "100",
            secondaryText: "1 traffic session",
            trendText: "",
            subStats: [],
          },
          {
            title: "Front desk hours",
            primaryValue: "1 / 2",
            secondaryText: "80% or more",
            trendText: "",
            pct: 50,
            subStats: [
              { label: "Sophomores", value: "0 / 1 (0%)", pct: 0 },
              { label: "Freshmen", value: "1 / 1 (100%)", pct: 100 },
            ],
          },
          {
            title: "Study session hours",
            primaryValue: "1 / 2",
            secondaryText: "80% or more",
            trendText: "",
            pct: 50,
            subStats: [
              { label: "Sophomores", value: "0 / 1 (0%)", pct: 0 },
              { label: "Freshmen", value: "1 / 1 (100%)", pct: 100 },
            ],
          },
        ]}
      />,
    )

    expect(html).toContain("Visits this week")
    expect(html).toContain("Front desk hours")
    expect(html).toContain("Sophomores")
    expect(html).toContain("Freshmen")
    expect(html.match(/data-slot="progress"/g)?.length).toBe(6)
    expect(html).toContain("bg-front-desk/20")
    expect(html).toContain("[&amp;_[data-slot=progress-indicator]]:bg-front-desk")
    expect(html).toContain("bg-study/20")
    expect(html).toContain("[&amp;_[data-slot=progress-indicator]]:bg-study")
    expect(html).toContain('aria-label="Front desk hours 1 / 2"')
    expect(html).toContain('aria-label="Sophomores 0 / 1 (0%)"')
    expect(html).toContain('aria-label="Freshmen 1 / 1 (100%)"')
  })
})
