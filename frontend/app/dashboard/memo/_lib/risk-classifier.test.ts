import { describe, expect, it } from "vitest"
import { freshmanCohortYear, sophomoreCohortYear } from "@/lib/format/time"
import type { MemoLivePageData } from "../types"
import { classifyScholarFollowUpRisk } from "./risk-classifier"

const freshman = freshmanCohortYear()
const sophomore = sophomoreCohortYear()
const zeroCompliance = { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] }

describe("risk-classifier", () => {
  const baseData = {
    scholars: [
      { scholarId: "2024-001", scholarName: "A Scholar", cohort: freshman, teamLeader: "TL One", fdPct: 90, ssPct: 90, fdRequired: 120, ssRequired: 120, fdTotal: 0, ssTotal: 0, fdExcuseMin: 0, ssExcuseMin: 0, wahfStatus: "on-time", wahfSubmittedAt: "2026-04-02T16:00:00.000Z", fdCompliance: zeroCompliance, ssCompliance: zeroCompliance },
      { scholarId: "2023-010", scholarName: "B Scholar", cohort: sophomore, teamLeader: "TL One", fdPct: 60, ssPct: 90, fdRequired: 120, ssRequired: 120, fdTotal: 0, ssTotal: 0, fdExcuseMin: 0, ssExcuseMin: 0, wahfStatus: "on-time", wahfSubmittedAt: "2026-04-02T16:00:00.000Z", fdCompliance: zeroCompliance, ssCompliance: zeroCompliance },
      { scholarId: "2023-011", scholarName: "C Scholar", cohort: sophomore, teamLeader: "TL Two", fdPct: 70, ssPct: 50, fdRequired: 120, ssRequired: 120, fdTotal: 0, ssTotal: 0, fdExcuseMin: 0, ssExcuseMin: 0, wahfStatus: "on-time", wahfSubmittedAt: "2026-04-02T16:00:00.000Z", fdCompliance: zeroCompliance, ssCompliance: zeroCompliance },
      { scholarId: "2023-012", scholarName: "D Scholar", cohort: sophomore, teamLeader: "TL Two", fdPct: 90, ssPct: 90, fdRequired: 120, ssRequired: 120, fdTotal: 0, ssTotal: 0, fdExcuseMin: 0, ssExcuseMin: 0, wahfStatus: "missing", wahfSubmittedAt: null, fdCompliance: zeroCompliance, ssCompliance: zeroCompliance },
    ],
    teamLeaders: [],
    pieData: { cohort2024: { total: 0, fdCompleteCount: 0, ssCompleteCount: 0, fdPercent: 0, ssPercent: 0 }, cohort2025: { total: 0, fdCompleteCount: 0, ssCompleteCount: 0, fdPercent: 0, ssPercent: 0 } },
    formCompletionOverall: { wahfCompleted: 0, wahfRequired: 0, wahfLateCount: 0, wplCompleted: 0, wplRequired: 0, wplLateCount: 0, mcfCompleted: 0, mcfRequired: 0, mcfLateCount: 0 },
    completedStudy: [],
    completedFd: [],
    trafficWeeklyData: [],
    trafficEntryCountForSelectedWeek: 0,
    trafficSessions: [],
    tutorReports: [],
    gradeBreakdown: {
      low: [{ scholarName: "C Scholar", course: "X", assessment: "Y", grade: "60", percent: 60 }],
      high: [{ scholarName: "A Scholar", course: "CMSC131", assessment: "Quiz", grade: "95%", percent: 95 }],
      mid: [{ scholarName: "A Scholar", course: "MATH140", assessment: "HW 4", grade: "82%", percent: 82 }],
    },
    wahfDonut: { total: 0, completeCount: 0, lateCount: 0, percentComplete: 0 },
    teamLeaderFormStats: [],
    weekLabel: "Week 1",
    currentCampusWeek: 1,
    selectedWeekNumber: 1,
  } as MemoLivePageData

  it("flags scholars below completion thresholds and low grades", () => {
    const rows = classifyScholarFollowUpRisk(baseData)
    expect(rows.map((row) => row.scholarName)).toEqual(["C Scholar", "B Scholar", "D Scholar"])
    expect(rows[0]?.flags).toContain("Low study session completion")
    expect(rows[1]?.flags).toContain("Low front desk completion")
    expect(rows[0]?.issues).toEqual([
      { kind: "front-desk", glance: "Front desk", pct: 70, requiredMinutes: 120, insideMinutes: 0, outsideMinutes: 0 },
      { kind: "study-session", glance: "Study session", pct: 50, requiredMinutes: 120, insideMinutes: 0, outsideMinutes: 0 },
      { kind: "grade", glance: "X · Y", pct: 60 },
    ])
    expect(rows[1]?.issues).toEqual([
      { kind: "front-desk", glance: "Front desk", pct: 60, requiredMinutes: 120, insideMinutes: 0, outsideMinutes: 0 },
    ])
    expect(rows.find((row) => row.scholarName === "A Scholar")).toBeUndefined()
    expect(rows.find((row) => row.scholarName === "B Scholar")?.teamLeader).toBe("TL One")
    expect(rows.find((row) => row.scholarName === "C Scholar")?.teamLeader).toBe("TL Two")
    expect(rows.flatMap((row) => row.issues.filter((issue) => issue.kind === "grade"))).toHaveLength(1)
  })

  it("flags missing WAHF even when hours are complete", () => {
    const rows = classifyScholarFollowUpRisk(baseData)
    const missingWahf = rows.find((row) => row.scholarName === "D Scholar")
    expect(missingWahf?.flags).toEqual(["Missing WAHF"])
    expect(missingWahf?.issues).toEqual([
      { kind: "wahf", glance: "WAHF", status: "missing", submittedAtLabel: null },
    ])
  })

  it("shows late WAHF with the form-log submitted-at time", () => {
    const rows = classifyScholarFollowUpRisk({
      ...baseData,
      scholars: [
        {
          ...baseData.scholars[0]!,
          wahfStatus: "late",
          wahfSubmittedAt: "2026-04-04T12:00:00.000Z",
        },
      ],
      gradeBreakdown: { low: [], high: [], mid: [] },
    })
    expect(rows[0]?.flags).toEqual(["Late WAHF"])
    expect(rows[0]?.issues[0]).toMatchObject({ kind: "wahf", glance: "WAHF", status: "late" })
    const wahfIssue = rows[0]?.issues[0]
    expect(wahfIssue?.kind).toBe("wahf")
    if (wahfIssue?.kind === "wahf") {
      expect(wahfIssue.submittedAtLabel?.replace(/\s/g, " ")).toBe("Apr 4, 8:00 AM")
    }
  })

  it("passes required FD/SS minutes onto follow-up rows", () => {
    const rows = classifyScholarFollowUpRisk({
      ...baseData,
      scholars: [
        { ...baseData.scholars[1]!, fdRequired: 90, ssRequired: 180 },
        { ...baseData.scholars[0]!, fdRequired: null, ssRequired: null },
      ],
    })
    expect(rows[0]).toMatchObject({
      scholarName: "B Scholar",
      fdRequired: 90,
      ssRequired: 180,
    })
    expect(rows[0]?.issues).toEqual([
      { kind: "front-desk", glance: "Front desk", pct: 60, requiredMinutes: 90, insideMinutes: 0, outsideMinutes: 0 },
    ])
  })

  it("keeps Unassigned when the scholar has no mentor_mentee name", () => {
    const rows = classifyScholarFollowUpRisk({
      ...baseData,
      scholars: [{ ...baseData.scholars[1]!, teamLeader: "  " }],
      gradeBreakdown: { low: [], high: [], mid: [] },
    })
    expect(rows[0]?.teamLeader).toBe("Unassigned")
  })
})
