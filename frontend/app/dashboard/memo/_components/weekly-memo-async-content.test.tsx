import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const {
  mockGetWeeklyMemo,
  mockWeeklyMemoNavSync,
  mockWeeklyKpiCards,
  mockTeamLeaderPerformanceTable,
  mockScholarFollowUpTable,
  mockRecognitionBoardSection,
  mockTutoringLogSection,
  mockFullAttendanceDetailSection,
} = vi.hoisted(() => ({
  mockGetWeeklyMemo: vi.fn(),
  mockWeeklyMemoNavSync: vi.fn(() => null),
  mockWeeklyKpiCards: vi.fn(() => React.createElement("section", { "data-testid": "weekly-kpi-cards" })),
  mockTeamLeaderPerformanceTable: vi.fn(() =>
    React.createElement("section", { "data-testid": "team-leader-performance-table" })
  ),
  mockScholarFollowUpTable: vi.fn(() => React.createElement("section", { "data-testid": "scholar-follow-up-table" })),
  mockRecognitionBoardSection: vi.fn(() => React.createElement("section", { "data-testid": "recognition-board-section" })),
  mockTutoringLogSection: vi.fn(() => React.createElement("section", { "data-testid": "tutoring-log-section" })),
  mockFullAttendanceDetailSection: vi.fn(() =>
    React.createElement("section", { "data-testid": "full-attendance-detail-section" })
  ),
}))

vi.mock("@/lib/server/data", () => ({
  getWeeklyMemo: mockGetWeeklyMemo,
}))

vi.mock("./weekly-memo-nav-context", () => ({
  WeeklyMemoNavSync: mockWeeklyMemoNavSync,
}))

vi.mock("./weekly-kpi-cards", () => ({
  WeeklyKpiCards: mockWeeklyKpiCards,
}))

vi.mock("./team-leader-performance-table", () => ({
  TeamLeaderPerformanceTable: mockTeamLeaderPerformanceTable,
}))

vi.mock("./scholar-follow-up-table", () => ({
  ScholarFollowUpTable: mockScholarFollowUpTable,
}))

vi.mock("./recognition-board-section", () => ({
  RecognitionBoardSection: mockRecognitionBoardSection,
}))

vi.mock("./tutoring-log-section", () => ({
  TutoringLogSection: mockTutoringLogSection,
}))

vi.mock("./full-attendance-detail-section", () => ({
  FullAttendanceDetailSection: mockFullAttendanceDetailSection,
}))

vi.mock("@/components/dashboard/widgets/year-not-started-state", () => ({
  YearNotStartedState: () => React.createElement("div", { "data-testid": "year-not-started" }),
}))

import type { WeeklyMemo } from "@css-atlas/shared/contracts/memo"
import { WeeklyMemoAsyncContent } from "./weekly-memo-async-content"

/** A finished memo as the backend sends it; the page only renders it. */
const memo: WeeklyMemo = {
  yearNotStarted: false,
  weekNumber: 5,
  weekStartLabel: "Apr 1",
  weekEndLabel: "Apr 7",
  navigation: { availableWeeks: [4, 5, 6, 7], prevWeek: 4, nextWeek: 6, currentCampusWeek: 7 },
  kpis: [{ title: "Visits this week", primaryValue: "100", secondaryText: "1 traffic sessions", trendText: "", subStats: [] }],
  teamLeaderRows: [{ leaderName: "TL One", mcf: "on-time", wpl: "late", wahf: "missing", menteesOk: "check", hasNoMentee: false }],
  scholarRows: [],
  tutoringLog: { badgeText: "1 session", rightLabel: "Tutoring", tabs: [] },
  recognitionBoard: { badgeText: "2 grades", rightLabel: "WAHF", bands: [] },
  fullAttendanceDetail: { rightLabel: "Front desk · Study sessions · WAHF", wahfCensus: { onTime: 1, late: 0, missing: 0 }, tabs: [] },
}

describe("WeeklyMemoAsyncContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWeeklyMemo.mockResolvedValue(memo)
  })

  it("asks for the requested week, or the current one when the param is missing or invalid", async () => {
    await WeeklyMemoAsyncContent({ weekParam: "7" })
    await WeeklyMemoAsyncContent({ weekParam: undefined })
    await WeeklyMemoAsyncContent({ weekParam: "abc" })
    expect(mockGetWeeklyMemo.mock.calls).toEqual([[7], [undefined], [undefined]])
  })

  it("syncs the memo's week navigation to the header", async () => {
    renderToStaticMarkup(await WeeklyMemoAsyncContent({ weekParam: "5" }))
    expect(mockWeeklyMemoNavSync).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStartLabel: "Apr 1",
        weekEndLabel: "Apr 7",
        weekNumber: 5,
        availableWeeks: [4, 5, 6, 7],
        prevWeek: 4,
        nextWeek: 6,
        currentCampusWeek: 7,
        yearNotStarted: false,
      }),
      undefined,
    )
  })

  it("renders the year-not-started state before the first campus week", async () => {
    mockGetWeeklyMemo.mockResolvedValue({ yearNotStarted: true })
    const markup = renderToStaticMarkup(await WeeklyMemoAsyncContent({}))
    expect(markup).toContain("year-not-started")
    expect(mockWeeklyKpiCards).not.toHaveBeenCalled()
    expect(mockWeeklyMemoNavSync).toHaveBeenCalledWith(expect.objectContaining({ yearNotStarted: true, availableWeeks: [] }), undefined)
  })

  it("hands each section to its component unchanged", async () => {
    renderToStaticMarkup(await WeeklyMemoAsyncContent({ weekParam: "5" }))
    expect(mockWeeklyKpiCards).toHaveBeenCalledWith({ cards: memo.kpis }, undefined)
    expect(mockTeamLeaderPerformanceTable).toHaveBeenCalledWith({ rows: memo.teamLeaderRows }, undefined)
    expect(mockScholarFollowUpTable).toHaveBeenCalledWith({ rows: memo.scholarRows }, undefined)
    expect(mockTutoringLogSection).toHaveBeenCalledWith({ data: memo.tutoringLog }, undefined)
    expect(mockRecognitionBoardSection).toHaveBeenCalledWith({ data: memo.recognitionBoard }, undefined)
    expect(mockFullAttendanceDetailSection).toHaveBeenCalledWith({ data: memo.fullAttendanceDetail }, undefined)
  })
})
