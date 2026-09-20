import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { WeeklyMemoDataSkeleton } from "./weekly-memo-data-skeleton"
import { WEEKLY_MEMO_KPI_TITLES } from "../_lib/memo-kpi-titles"

describe("WeeklyMemoDataSkeleton", () => {
  it("renders static section titles and KPI labels while skeletonizing values", () => {
    const html = renderToStaticMarkup(<WeeklyMemoDataSkeleton />)

    for (const title of WEEKLY_MEMO_KPI_TITLES) {
      expect(html).toContain(title)
    }

    expect(html).toContain("Team leader performance")
    expect(html).toContain("Scholar follow-up")
    expect(html).not.toContain("Scholar WAHF")
    expect(html).toContain("Tutoring log")
    expect(html).toContain("Recognition board")
    expect(html).toContain("90–100% · 70–89% · Below 70%")
    expect(html).toContain("Full attendance detail")
    expect(html).not.toContain("Form submissions")
    expect(html).not.toContain("list-disc")
    expect(html).toContain('data-slot="skeleton"')
  })
})
