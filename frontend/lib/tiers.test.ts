import { describe, expect, it } from "vitest"

import {
  applyWeekTiers,
  getClassYear,
  getSummaryTier,
  getWeekTier,
} from "./tiers"
import type {
  HourWeekSummary,
  MenteeReview,
  ShiftSessionKind,
  WeekReviewSummary,
} from "@/lib/types/mentee-review"

const FALL_2026 = new Date("2026-08-31T04:00:00.000Z") // Monday, Aug 31, Eastern
const SPRING_2027 = new Date("2027-01-19T05:00:00.000Z") // Tuesday, Jan 19, Eastern

function hour(
  kind: ShiftSessionKind,
  loggedMinutes: number,
  targetMinutes: number,
): HourWeekSummary {
  const percent = (loggedMinutes / targetMinutes) * 100
  return {
    kind,
    assignmentAvailable: true,
    loggedMinutes,
    targetMinutes,
    percent,
    band: percent >= 90 ? "green" : percent >= 60 ? "orange" : "red",
    displayHours: loggedMinutes / 60,
    overageMinutes: Math.max(0, Math.round(loggedMinutes - targetMinutes)),
    pending: false,
    noShowCount: 0,
    hasActivity: true,
    shifts: [],
    offShiftLogs: [],
  }
}

function week(
  weekNumber: number,
  fdMinutes: number,
  ssMinutes: number,
  fdRequired = 300,
  ssRequired = 300,
): WeekReviewSummary {
  return {
    weekNumber,
    weekStart: "2026-09-07T04:00:00.000Z",
    weekEnd: "2026-09-13T04:00:00.000Z",
    phase: "past",
    hours: [hour("front_desk", fdMinutes, fdRequired), hour("study_session", ssMinutes, ssRequired)],
    wahf: {
      status: "submitted",
      dueAt: "2026-09-11T03:59:59.999Z",
      submittedAt: "2026-09-10T14:00:00.000Z",
      onTime: true,
      submissionId: "w1",
    },
    tutoring: { status: "none", recordedAttendance: false, reports: [] },
  }
}

function review(weeks: WeekReviewSummary[], cohort: number | null = 2026): MenteeReview {
  const selected = weeks[0] ?? null
  return {
    asOf: "2026-09-10T19:12:00.000Z",
    mentee: { uid: "1", fullName: "Test Scholar", email: null, cohort },
    calendar: {
      semesterId: "1",
      semesterStart: FALL_2026.toISOString(),
      semesterEnd: "2026-12-12T04:00:00.000Z",
      currentWeek: 1,
      weeks: [],
      noActiveWeek: false,
    },
    currentWeek: 1,
    selectedWeek: selected?.weekNumber ?? null,
    semesterGrid: { ok: true, data: weeks, loadedAt: "2026-09-10T19:12:00.000Z" },
    selectedWeekReview: { ok: true, data: selected, loadedAt: "2026-09-10T19:12:00.000Z" },
    latestGrades: {
      ok: true,
      data: { status: "empty", submissionId: null, submittedAt: null, entries: [] },
      loadedAt: "2026-09-10T19:12:00.000Z",
    },
    meetingPreference: { ok: true, data: null, loadedAt: "2026-09-10T19:12:00.000Z" },
  }
}

describe("getClassYear", () => {
  it("treats a fall semester as the start of that academic year", () => {
    expect(getClassYear(2026, FALL_2026)).toBe(0)
    expect(getClassYear(2025, FALL_2026)).toBe(1)
  })

  it("keeps a spring semester in the academic year that began the previous August", () => {
    expect(getClassYear(2026, SPRING_2027)).toBe(0)
    expect(getClassYear(2023, SPRING_2027)).toBe(3)
  })
})

describe("getWeekTier", () => {
  const base = {
    fdMinutes: 0,
    ssMinutes: 0,
    fdRequired: 100,
    ssRequired: 100,
    classYear: 0,
  }

  it("counts a week exactly at the cutoff", () => {
    expect(getWeekTier({ ...base, fdMinutes: 105, ssMinutes: 105 })).toBe("rare")
  })

  it("uses the weakest link, never the stronger requirement", () => {
    expect(getWeekTier({ ...base, fdMinutes: 200, ssMinutes: 104 })).toBeNull()
  })

  it("requires both requirements to be positive", () => {
    expect(getWeekTier({ ...base, fdMinutes: 500, ssMinutes: 500, ssRequired: 0 })).toBeNull()
    expect(getWeekTier({ ...base, fdMinutes: 500, ssMinutes: 500, fdRequired: 0 })).toBeNull()
  })

  it("does not tier juniors or above", () => {
    expect(getWeekTier({ ...base, fdMinutes: 500, ssMinutes: 500, classYear: 2 })).toBeNull()
  })

  it("applies the sophomore cutoffs", () => {
    expect(getWeekTier({ ...base, fdMinutes: 154.9, ssMinutes: 154.9, classYear: 1 })).toBe("epic")
    expect(getWeekTier({ ...base, fdMinutes: 155, ssMinutes: 155, classYear: 1 })).toBe("legendary")
  })

  it("takes the highest tier met", () => {
    expect(getWeekTier({ ...base, fdMinutes: 115, ssMinutes: 115 })).toBe("epic")
    expect(getWeekTier({ ...base, fdMinutes: 125, ssMinutes: 125 })).toBe("legendary")
  })
})

describe("getSummaryTier", () => {
  it("uses logged minutes and the evaluator's targets", () => {
    expect(getSummaryTier(week(1, 330, 330), 0)).toBe("rare")
    expect(getSummaryTier(week(1, 350, 320), 0)).toBe("rare")
  })

  it("tiers the done-when freshman week: 3.3 of 3h front desk + 5.3 of 5h study", () => {
    expect(getSummaryTier(week(1, 198, 318, 180, 300), 0)).toBe("rare")
  })

  it("does not tier a week with a missing target", () => {
    const summary = week(1, 330, 330)
    summary.hours = [
      hour("front_desk", 330, 300),
      { ...hour("study_session", 330, 300), targetMinutes: null, percent: null, band: null },
    ]
    expect(getSummaryTier(summary, 0)).toBeNull()
  })
})

describe("applyWeekTiers", () => {
  it("attaches the same tier to the grid and the selected week", () => {
    const tiered = applyWeekTiers(review([week(1, 330, 330)]))
    expect(tiered.semesterGrid.ok && tiered.semesterGrid.data[0]?.tier).toBe("rare")
    expect(tiered.selectedWeekReview.ok && tiered.selectedWeekReview.data?.tier).toBe("rare")
  })

  it("defaults to freshman cutoffs when the API omits cohort", () => {
    const tiered = applyWeekTiers(review([week(1, 330, 330)], null))
    expect(tiered.semesterGrid.ok && tiered.semesterGrid.data[0]?.tier).toBe("rare")
    expect(tiered.selectedWeekReview.ok && tiered.selectedWeekReview.data?.tier).toBe("rare")
  })

  it("does not tier weeks without a semester start", () => {
    const source = review([week(1, 330, 330)])
    source.calendar.semesterStart = null
    const tiered = applyWeekTiers(source)
    expect(tiered.semesterGrid.ok && tiered.semesterGrid.data[0]?.tier).toBeNull()
  })

  it("uses the cohort passed from the weekly memo", () => {
    const source = review([week(1, 330, 330)], null)

    const freshman = applyWeekTiers(source, 2026)
    expect(freshman.semesterGrid.ok && freshman.semesterGrid.data[0]?.tier).toBe("rare")

    const sophomore = applyWeekTiers(source, 2025)
    expect(sophomore.semesterGrid.ok && sophomore.semesterGrid.data[0]?.tier).toBeNull()
  })
})
