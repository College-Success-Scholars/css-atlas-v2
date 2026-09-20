import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const {
  mockGetWeeklyMemoPageData,
  mockWeeklyMemoNavSync,
  mockWeeklyKpiCards,
  mockTeamLeaderPerformanceTable,
  mockScholarFollowUpTable,
  mockRecognitionBoardSection,
  mockTutoringLogSection,
  mockFullAttendanceDetailSection,
} = vi.hoisted(() => ({
  mockGetWeeklyMemoPageData: vi.fn(),
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

vi.mock("../_lib/memo-source", () => ({
  backendMemoSource: {
    getWeeklyMemoPageData: mockGetWeeklyMemoPageData,
  },
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

import { WeeklyMemoAsyncContent } from "./weekly-memo-async-content"

const renderAsyncContent = async (props: { weekParam?: string } = {}) => {
  const element = await WeeklyMemoAsyncContent(props)
  renderToStaticMarkup(element)
}

const buildMemoData = (overrides: Record<string, unknown> = {}) => ({
  scholars: [
    {
      scholarId: "2024-001",
      scholarName: "Alice Scholar",
      cohort: 2024,
      teamLeader: "TL One",
      fdPct: 95,
      ssPct: 91,
      fdRequired: 120,
      ssRequired: 120,
      fdTotal: 0,
      ssTotal: 0,
      fdExcuseMin: 0,
      ssExcuseMin: 0,
      wahfStatus: "on-time",
      wahfSubmittedAt: "2026-04-02T16:00:00.000Z",
      fdCompliance: { insideMinutes: 114, outsideMinutes: 0, noShowCount: 0, dates: [] },
      ssCompliance: { insideMinutes: 109, outsideMinutes: 0, noShowCount: 0, dates: [] },
    },
    {
      scholarId: "2023-010",
      scholarName: "Bob Scholar",
      cohort: 2024,
      teamLeader: "Unassigned",
      fdPct: 50,
      ssPct: 70,
      fdRequired: 120,
      ssRequired: 120,
      fdTotal: 0,
      ssTotal: 0,
      fdExcuseMin: 0,
      ssExcuseMin: 0,
      wahfStatus: "missing",
      wahfSubmittedAt: null,
      fdCompliance: { insideMinutes: 24, outsideMinutes: 6, noShowCount: 0, dates: [] },
      ssCompliance: { insideMinutes: 40, outsideMinutes: 44, noShowCount: 0, dates: [] },
    },
  ],
  teamLeaders: [],
  pieData: {
    cohort2024: { total: 0, fdCompleteCount: 0, ssCompleteCount: 0, fdPercent: 0, ssPercent: 0 },
    cohort2025: { total: 0, fdCompleteCount: 0, ssCompleteCount: 0, fdPercent: 0, ssPercent: 0 },
  },
  formCompletionOverall: {
    wahfCompleted: 1,
    wahfRequired: 2,
    wahfLateCount: 0,
    wplCompleted: 2,
    wplRequired: 2,
    wplLateCount: 0,
    mcfCompleted: 1,
    mcfRequired: 2,
    mcfLateCount: 0,
  },
  completedStudy: [
    { scholarId: "2024-001", scholarName: "Alice Scholar", durationMs: 60 * 60 * 1000 },
    { scholarId: "2023-010", scholarName: "Bob Scholar", durationMs: 20 * 60 * 1000 },
  ],
  completedFd: [
    { scholarId: "2024-001", scholarName: "Alice Scholar", durationMs: 90 * 60 * 1000 },
    { scholarId: "2023-010", scholarName: "Bob Scholar", durationMs: 45 * 60 * 1000 },
  ],
  trafficWeeklyData: [
    { weekNumber: 4, entryCount: 80 },
    { weekNumber: 5, entryCount: 100 },
  ],
  trafficEntryCountForSelectedWeek: 100,
  trafficSessions: [{ id: "session-1" }],
  tutorReports: [{ id: 1, scholarId: "1", scholarName: "A", tutorName: "T", courses: [], startTime: "", endTime: "", dayOfWeek: "Mon" }],
  gradeBreakdown: {
    high: [{ scholarName: "Alice Scholar", course: "CMSC131", assessment: "Quiz", grade: "95%", percent: 95 }],
    mid: [{ scholarName: "Alice Scholar", course: "MATH140", assessment: "HW 4", grade: "82%", percent: 82 }],
    low: [{ scholarName: "Bob Scholar", course: "X", assessment: "Y", grade: "60", percent: 60 }],
  },
  wahfDonut: { total: 0, completeCount: 0, lateCount: 0, percentComplete: 0 },
  teamLeaderFormStats: [
    {
      scholarId: "tl-1",
      name: "TL One",
      programRole: null,
      mcfCompleted: 0,
      mcfRequired: 1,
      mcfLate: false,
      mcfPct: 0,
      mcfLatestAt: "",
      wplCompleted: 1,
      wplRequired: 1,
      wplLate: false,
      wplPct: 100,
      wplLatestAt: "",
      wahfCompleted: 1,
      wahfRequired: 1,
      wahfLate: false,
      wahfPct: 100,
      wahfLatestAt: "",
    },
  ],
  weekLabel: "Apr 1 - Apr 7",
  currentCampusWeek: 6,
  selectedWeekNumber: 5,
  ...overrides,
})

describe("WeeklyMemoAsyncContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls memo source with week param", async () => {
    mockGetWeeklyMemoPageData.mockResolvedValue(buildMemoData())

    await WeeklyMemoAsyncContent({ weekParam: "7" })
    await WeeklyMemoAsyncContent({ weekParam: undefined })

    expect(mockGetWeeklyMemoPageData).toHaveBeenNthCalledWith(1, "7")
    expect(mockGetWeeklyMemoPageData).toHaveBeenNthCalledWith(2, undefined)
  })

  it("syncs sparse week navigation metadata to header context", async () => {
    mockGetWeeklyMemoPageData.mockResolvedValue(
      buildMemoData({
        selectedWeekNumber: 5,
        currentCampusWeek: 7,
        trafficWeeklyData: [
          { weekNumber: 4, entryCount: 70 },
          { weekNumber: 6, entryCount: 90 },
        ],
      })
    )

    await renderAsyncContent({})

    expect(mockWeeklyMemoNavSync).toHaveBeenCalledWith(
      expect.objectContaining({
        weekNumber: 5,
        weekStartLabel: "Apr 1",
        weekEndLabel: "Apr 7",
        availableWeeks: [4, 5, 6, 7],
        prevWeek: 4,
        nextWeek: 6,
        currentCampusWeek: 7,
        yearNotStarted: false,
      }),
      undefined
    )
  })

  it("renders year-not-started empty state when API reports pre-Fall", async () => {
    mockGetWeeklyMemoPageData.mockResolvedValue({
      yearNotStarted: true,
      currentCampusWeek: null,
    })

    const markup = renderToStaticMarkup(await WeeklyMemoAsyncContent({}))

    expect(markup).toContain("year-not-started")
    expect(mockWeeklyKpiCards).not.toHaveBeenCalled()
    expect(mockWeeklyMemoNavSync).toHaveBeenCalledWith(
      expect.objectContaining({
        yearNotStarted: true,
        currentCampusWeek: null,
        availableWeeks: [],
      }),
      undefined
    )
  })

  it("passes transformed props to section components", async () => {
    mockGetWeeklyMemoPageData.mockResolvedValue(buildMemoData())

    await renderAsyncContent({})

    expect(mockWeeklyKpiCards).toHaveBeenCalledWith(
      expect.objectContaining({
        cards: expect.arrayContaining([
          expect.objectContaining({ title: "Visits this week", primaryValue: "100" }),
          expect.objectContaining({ title: "Front desk completion", primaryValue: "73%" }),
        ]),
      }),
      undefined
    )

    expect(mockTeamLeaderPerformanceTable).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ leaderName: "TL One", mcf: "missing", wpl: "on-time", wahf: "on-time" })],
      }),
      undefined
    )

    expect(mockScholarFollowUpTable).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            scholarName: "Bob Scholar",
            flags: expect.arrayContaining(["Low front desk completion", "Low study session completion", "Low grade", "Missing WAHF"]),
            issues: expect.arrayContaining([
              { kind: "front-desk", glance: "Front desk", pct: 50, requiredMinutes: 120, insideMinutes: 24, outsideMinutes: 6 },
              { kind: "study-session", glance: "Study session", pct: 70, requiredMinutes: 120, insideMinutes: 40, outsideMinutes: 44 },
              { kind: "grade", glance: "X · Y", pct: 60 },
              { kind: "wahf", glance: "WAHF", status: "missing", submittedAtLabel: null },
            ]),
            fdRequired: 120,
            ssRequired: 120,
          }),
        ],
      }),
      undefined
    )

    expect(mockTutoringLogSection).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          badgeText: "1 session",
          tabs: expect.arrayContaining([
            expect.objectContaining({ id: "sessions" }),
            expect.objectContaining({ id: "empty-sessions" }),
          ]),
        }),
      }),
      undefined
    )

    expect(mockRecognitionBoardSection).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          badgeText: "3 grades",
          rightLabel: "90–100% · 70–89% · Below 70%",
          bands: [
            expect.objectContaining({
              id: "high",
              label: "90 – 100%",
              entries: [expect.objectContaining({ scholarName: "Alice Scholar", course: "CMSC131", assessment: "Quiz" })],
            }),
            expect.objectContaining({
              id: "mid",
              entries: [expect.objectContaining({ scholarName: "Alice Scholar", course: "MATH140" })],
            }),
            expect.objectContaining({
              id: "low",
              entries: [expect.objectContaining({ scholarName: "Bob Scholar", course: "X", assessment: "Y" })],
            }),
          ],
        }),
      }),
      undefined
    )

    expect(mockFullAttendanceDetailSection).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wahfCensus: { onTime: 1, late: 0, missing: 1 },
          tabs: expect.arrayContaining([
            expect.objectContaining({ id: "front-desk" }),
            expect.objectContaining({ id: "study-sessions" }),
          ]),
        }),
      }),
      undefined
    )
  })
})
