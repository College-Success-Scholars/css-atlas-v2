import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { HoursCard } from "./hours-card"
import type { DailyHoursEntry } from "./utils"

const emptyWeek: DailyHoursEntry[] = ["Mon", "Tue", "Wed", "Thu", "Fri"].map(
  (dayLabel) => ({
    dayLabel,
    hours: dayLabel === "Mon" ? 1.5 : 0,
    scheduledHours: 0,
    scheduledStart: null,
    scheduledEnd: null,
    noShow: false,
    unscheduled: false,
  }),
)

describe("HoursCard", () => {
  it("shows excused hours alongside completed hours and counts them toward remaining", () => {
    const html = renderToStaticMarkup(
      <HoursCard
        title="Study session hours"
        completed={1.5}
        total={3}
        color="emerald"
        dailyHours={emptyWeek}
        todayLabel="Mon"
        excuseHours={0.5}
        excuseDescription="Doctor appointment"
      />,
    )

    expect(html).toContain("Study session hours")
    expect(html).toContain("1.5")
    expect(html).toContain("3 hrs")
    expect(html).toContain("0.5 hrs excused")
    expect(html).toContain("Doctor appointment")
    expect(html).toContain("1 hrs left")
    expect(html).toContain("This week")
    expect(html).not.toContain("UTC")
  })

  it("hides the excused badge when there is no excuse", () => {
    const html = renderToStaticMarkup(
      <HoursCard
        title="Front desk hours"
        completed={2}
        total={2}
        color="sky"
        dailyHours={emptyWeek}
        todayLabel="Mon"
      />,
    )

    expect(html).not.toContain("hrs excused")
    expect(html).toContain("0 hrs left")
  })
})
