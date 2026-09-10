import { describe, expect, it } from "vitest"
import { freshmanCohortYear, sophomoreCohortYear } from "@/lib/format/time"
import type { MemoLivePageData } from "../types"
import { assembleWeeklyMemo } from "./weekly-memo-assembler"

const freshman = freshmanCohortYear()
const sophomore = sophomoreCohortYear()

const buildMemoData = (): MemoLivePageData =>
  ({
    scholars: [
      {
        scholarId: "2024-001",
        scholarName: "Alice Scholar",
        cohort: freshman,
        teamLeader: "TL One",
        fdPct: 95,
        ssPct: 91,
        fdRequired: 120,
        ssRequired: 120,
        fdTotal: 114,
        ssTotal: 109,
        fdExcuseMin: 0,
        ssExcuseMin: 0,
        wahfStatus: "on-time" as const,
        wahfSubmittedAt: "2026-04-02T16:00:00.000Z",
        fdCompliance: { insideMinutes: 114, outsideMinutes: 0, noShowCount: 0, dates: [] },
        ssCompliance: { insideMinutes: 109, outsideMinutes: 0, noShowCount: 0, dates: [] },
      },
      {
        scholarId: "2023-010",
        scholarName: "Bob Scholar",
        cohort: sophomore,
        teamLeader: "TL Two",
        fdPct: 50,
        ssPct: 70,
        fdRequired: 120,
        ssRequired: 120,
        fdTotal: 30,
        ssTotal: 84,
        fdExcuseMin: 30,
        ssExcuseMin: 0,
        wahfStatus: "missing" as const,
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
    tutorReports: [
      { id: 1, scholarId: "1", scholarName: "A", tutorName: "T", courses: [], startTime: "", endTime: "", dayOfWeek: "Mon" },
      { id: 2, scholarId: null, scholarName: "EMPTY SESSION", tutorName: "T2", courses: [], startTime: "", endTime: "", dayOfWeek: "Tue" },
    ],
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
  }) as unknown as MemoLivePageData

describe("weekly-memo-assembler", () => {
  it("assembles top-level weekly memo sections from memo page data", () => {
    const result = assembleWeeklyMemo(buildMemoData())

    expect(result.weekStartLabel).toBe("Apr 1")
    expect(result.weekEndLabel).toBe("Apr 7")
    expect(result.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Visits this week", primaryValue: "100" }),
        expect.objectContaining({ title: "Front desk completion", primaryValue: "73%" }),
      ])
    )
    expect(result.teamLeaderRows[0]).toMatchObject({
      leaderName: "TL One",
      mcf: "missing",
      wpl: "on-time",
      wahf: "on-time",
      hasNoMentee: false,
    })
    expect(result.scholarRows[0]).toMatchObject({
      scholarName: "Bob Scholar",
      teamLeader: "TL Two",
      flags: ["Low front desk completion", "Low study session completion", "Low grade", "Missing WAHF"],
      issues: [
        { kind: "front-desk", glance: "Front desk", pct: 50, requiredMinutes: 120, insideMinutes: 24, outsideMinutes: 6 },
        { kind: "study-session", glance: "Study session", pct: 70, requiredMinutes: 120, insideMinutes: 40, outsideMinutes: 44 },
        { kind: "grade", glance: "X · Y", pct: 60 },
        { kind: "wahf", glance: "WAHF", status: "missing", submittedAtLabel: null },
      ],
      fdRequired: 120,
      ssRequired: 120,
    })
    expect(result.tutoringLog).toMatchObject({
      badgeText: "1 session",
      rightLabel: "Sessions · Empty sessions",
      tabs: [
        expect.objectContaining({
          id: "sessions",
          rows: [expect.objectContaining({ scholarName: "A", tutorName: "T" })],
        }),
        expect.objectContaining({
          id: "empty-sessions",
          rows: [expect.objectContaining({ scholarName: "EMPTY SESSION", tutorName: "T2" })],
        }),
      ],
    })
    expect(result.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Tutoring sessions held", secondaryText: "1 empty session" }),
      ])
    )
  })

  it("builds attendance tabs from scholar logged + excuse minutes, including zeros", () => {
    const result = assembleWeeklyMemo(buildMemoData())
    const fdTab = result.fullAttendanceDetail.tabs.find((tab) => tab.id === "front-desk")
    expect(fdTab?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scholarName: "Alice Scholar",
          completedMinutes: 114,
          excuseMinutes: 0,
          requiredMinutes: 120,
          completionPct: 95,
        }),
        expect.objectContaining({
          scholarName: "Bob Scholar",
          completedMinutes: 60,
          excuseMinutes: 30,
          requiredMinutes: 120,
          completionPct: 50,
        }),
      ])
    )
    expect(result.fullAttendanceDetail.wahfCensus).toEqual({ onTime: 1, late: 0, missing: 1 })
  })

  it("builds a three-band WAHF grade census and leaves follow-up on low grades only", () => {
    const result = assembleWeeklyMemo(buildMemoData())

    expect(result.recognitionBoard).toEqual({
      badgeText: "3 grades",
      rightLabel: "90–100% · 70–89% · Below 70%",
      bands: [
        {
          id: "high",
          label: "90 – 100%",
          entries: [{ scholarName: "Alice Scholar", course: "CMSC131", assessment: "Quiz", grade: "95%", percent: 95 }],
        },
        {
          id: "mid",
          label: "70 – 89%",
          entries: [{ scholarName: "Alice Scholar", course: "MATH140", assessment: "HW 4", grade: "82%", percent: 82 }],
        },
        {
          id: "low",
          label: "Below 70%",
          entries: [{ scholarName: "Bob Scholar", course: "X", assessment: "Y", grade: "60", percent: 60 }],
        },
      ],
    })
    expect(result.scholarRows[0]?.issues.filter((issue) => issue.kind === "grade")).toEqual([
      { kind: "grade", glance: "X · Y", pct: 60 },
    ])
    expect(result.scholarRows.flatMap((row) => row.issues.filter((issue) => issue.kind === "grade"))).toHaveLength(1)
    expect(result.scholarRows.flatMap((row) => row.issues.filter((issue) => issue.kind === "wahf"))).toHaveLength(1)
  })

  it("keeps a WAHF-only scholar on scholar follow-up", () => {
    const result = assembleWeeklyMemo({
      ...buildMemoData(),
      scholars: [
        ...buildMemoData().scholars,
        {
          scholarId: "wahf-only",
          scholarName: "Cara OnlyWahf",
          cohort: freshman,
          teamLeader: "TL One",
          fdPct: 100,
          ssPct: 100,
          fdRequired: 120,
          ssRequired: 120,
          fdTotal: 120,
          ssTotal: 120,
          fdExcuseMin: 0,
          ssExcuseMin: 0,
          wahfStatus: "late" as const,
          wahfSubmittedAt: "2026-04-04T12:00:00.000Z",
        },
      ],
    })

    expect(result.scholarRows.map((row) => row.scholarName)).toEqual(["Bob Scholar", "Cara OnlyWahf"])
    expect(result.scholarRows.find((row) => row.scholarName === "Cara OnlyWahf")).toMatchObject({
      flags: ["Late WAHF"],
      issues: [expect.objectContaining({ kind: "wahf", status: "late" })],
    })
  })

  it("sorts recognition-board grades descending by percent within each band", () => {
    const result = assembleWeeklyMemo({
      ...buildMemoData(),
      gradeBreakdown: {
        high: [
          { scholarName: "Zed Scholar", course: "CMSC131", assessment: "Quiz", grade: "91%", percent: 91 },
          { scholarName: "Ann Scholar", course: "MATH140", assessment: "Exam", grade: "100%", percent: 100 },
        ],
        mid: [
          { scholarName: "Ann Scholar", course: "PHYS161", assessment: "Lab", grade: "71%", percent: 71 },
          { scholarName: "Ann Scholar", course: "ENGL101", assessment: "Essay", grade: "88%", percent: 88 },
        ],
        low: [
          { scholarName: "Bob Scholar", course: "X", assessment: "Y", grade: "40", percent: 40 },
          { scholarName: "Bob Scholar", course: "Z", assessment: "W", grade: "69", percent: 69 },
        ],
      },
    })

    expect(result.recognitionBoard.bands.map((band) => band.entries.map((entry) => entry.percent))).toEqual([
      [100, 91],
      [88, 71],
      [69, 40],
    ])
  })

  it("marks MCF on-time with hasNoMentee when required is the -1 sentinel", () => {
    const result = assembleWeeklyMemo({
      ...buildMemoData(),
      teamLeaderFormStats: [
        {
          scholarId: "tl-none",
          name: "TL None",
          programRole: "Team Leader",
          mcfCompleted: 0,
          mcfRequired: -1,
          mcfLate: false,
          mcfPct: 100,
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
    })

    expect(result.teamLeaderRows[0]).toMatchObject({
      leaderName: "TL None",
      mcf: "on-time",
      hasNoMentee: true,
    })
  })

  it("marks MCF incomplete when some but not all mentee forms are in", () => {
    const result = assembleWeeklyMemo({
      ...buildMemoData(),
      teamLeaderFormStats: [
        {
          scholarId: "tl-partial",
          name: "TL Partial",
          programRole: "Team Leader",
          mcfCompleted: 1,
          mcfRequired: 3,
          mcfLate: false,
          mcfPct: 33,
          mcfLatestAt: "2026-04-03T12:00:00.000Z",
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
    })

    expect(result.teamLeaderRows[0]).toMatchObject({
      leaderName: "TL Partial",
      mcf: "incomplete",
      wpl: "on-time",
      wahf: "on-time",
    })
  })

  it("keeps partial MCF incomplete even when a submitted check-in was late", () => {
    const result = assembleWeeklyMemo({
      ...buildMemoData(),
      teamLeaderFormStats: [
        {
          scholarId: "tl-partial-late",
          name: "TL Partial Late",
          programRole: "Team Leader",
          mcfCompleted: 1,
          mcfRequired: 2,
          mcfLate: true,
          mcfPct: 50,
          mcfLatestAt: "2026-04-04T22:00:00.000Z",
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
    })

    expect(result.teamLeaderRows[0]?.mcf).toBe("incomplete")
  })
})
