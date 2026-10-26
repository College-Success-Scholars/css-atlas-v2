import { describe, expect, it } from "vitest"

import {
  applyWeekTiers,
  getClassYear,
  getHourTier,
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

describe("getHourTier", () => {
  const base = {
    loggedMinutes: 0,
    targetMinutes: 100,
    classYear: 0,
  }

  it.each([
    [104.99, null], [105, "rare"], [114.99, "rare"],
    [115, "epic"], [124.99, "epic"], [125, "legendary"],
  ] as const)("awards the highest freshman tier at %f percent", (loggedMinutes, expected) => {
    expect(getHourTier({ ...base, loggedMinutes })).toBe(expected)
  })

  it.each([
    [114.99, null], [115, "rare"], [134.99, "rare"],
    [135, "epic"], [154.99, "epic"], [155, "legendary"],
  ] as const)("awards the highest sophomore tier at %f percent", (loggedMinutes, expected) => {
    expect(getHourTier({ ...base, loggedMinutes, classYear: 1 })).toBe(expected)
  })

  it.each([0, -1, null, Number.NaN, Number.POSITIVE_INFINITY])("ignores invalid target %s", (targetMinutes) => {
    expect(getHourTier({ ...base, loggedMinutes: 500, targetMinutes })).toBeNull()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -10])("ignores invalid logged minutes %s", (loggedMinutes) => {
    expect(getHourTier({ ...base, loggedMinutes })).toBeNull()
  })

  it.each([2, 3, -1, Number.NaN])("does not tier unsupported class year %s", (classYear) => {
    expect(getHourTier({ ...base, loggedMinutes: 500, classYear })).toBeNull()
  })
})

describe("applyWeekTiers", () => {
  function tiers(result: MenteeReview) {
    return {
      grid: result.semesterGrid.ok ? result.semesterGrid.data[0]?.hours.map((h) => h.tier) : null,
      cards: result.selectedWeekReview.ok ? result.selectedWeekReview.data?.hours.map((h) => h.tier) : null,
    }
  }

  it.each([
    [360, "epic"], [504, "legendary"], [502.06, "legendary"],
  ] as const)("tiers %f study minutes independently of front desk", (studyMinutes, expected) => {
    const source = review([week(1, 182.83, studyMinutes, 180, 300)])
    expect(tiers(applyWeekTiers(source))).toEqual({ grid: [null, expected], cards: [null, expected] })
    expect(source.semesterGrid.ok && source.semesterGrid.data[0]?.hours[1]?.tier).toBeUndefined()
  })

  it("does not let low study hours suppress an earned front-desk tier", () => {
    expect(tiers(applyWeekTiers(review([week(1, 225, 60, 180, 300)])))).toEqual({
      grid: ["legendary", null], cards: ["legendary", null],
    })
  })

  it("can award different tiers to the two requirements", () => {
    expect(tiers(applyWeekTiers(review([week(1, 198, 360, 180, 300)])))).toEqual({
      grid: ["rare", "epic"], cards: ["rare", "epic"],
    })
  })

  it("ignores excuse-adjusted percent and uses exact logged minutes", () => {
    const summary = week(1, 180, 300, 180, 300)
    summary.hours.forEach((h) => { h.percent = 150 })
    expect(tiers(applyWeekTiers(review([summary])))).toEqual({ grid: [null, null], cards: [null, null] })
  })

  it("a missing front-desk target does not suppress study tiers", () => {
    const summary = week(1, 0, 360, 180, 300)
    summary.hours[0] = { ...summary.hours[0]!, targetMinutes: null, percent: null, band: null }
    expect(tiers(applyWeekTiers(review([summary])))).toEqual({ grid: [null, "epic"], cards: [null, "epic"] })
  })

  it("defaults to freshman cutoffs when the API omits cohort", () => {
    expect(tiers(applyWeekTiers(review([week(1, 330, 330)], null)))).toEqual({
      grid: ["rare", "rare"], cards: ["rare", "rare"],
    })
  })

  it("does not tier weeks without a semester start", () => {
    const source = review([week(1, 330, 330)])
    source.calendar.semesterStart = null
    expect(tiers(applyWeekTiers(source))).toEqual({ grid: [null, null], cards: [null, null] })
  })

  it("uses the roster cohort for sophomore cutoffs", () => {
    expect(tiers(applyWeekTiers(review([week(1, 330, 405)], 2025)))).toEqual({
      grid: [null, "epic"], cards: [null, "epic"],
    })
  })

  it("uses the cohort passed from the weekly memo as a legacy fallback", () => {
    const source = review([week(1, 330, 330)], null)

    const freshman = applyWeekTiers(source, 2026)
    expect(tiers(freshman)).toEqual({ grid: ["rare", "rare"], cards: ["rare", "rare"] })

    const sophomore = applyWeekTiers(source, 2025)
    expect(tiers(sophomore)).toEqual({ grid: [null, null], cards: [null, null] })
  })

  it("prefers the authoritative roster cohort over a stale URL cohort", () => {
    expect(tiers(applyWeekTiers(review([week(1, 330, 405)], 2025), 2026))).toEqual({
      grid: [null, "epic"], cards: [null, "epic"],
    })
  })

  it("never awards a future week's tiers", () => {
    const summary = week(1, 500, 500)
    summary.phase = "future"
    expect(tiers(applyWeekTiers(review([summary])))).toEqual({ grid: [null, null], cards: [null, null] })
  })
})
