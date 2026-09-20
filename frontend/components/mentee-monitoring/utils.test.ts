import { describe, it, expect, vi, afterEach } from "vitest"
import {
  addEasternCalendarDays,
  campusWeekToDateRange,
  dateToCampusWeek,
  getEasternDateParts,
  parseEasternDate,
} from "@/lib/format/time"
import {
  computeWahfStatus,
  computeTutoringSessions,
  filterActivityForMenteeWeek,
  addComplianceToDailyHours,
  computeDailyHours,
  durationMinutesFromClockTimes,
  clockStringToMinutes,
} from "./utils"
import type { ActivityRow, ShiftComplianceByKind, WahfRow, TutoringRow } from "@/lib/types/supabase"

const UID = "scholar-1"

/** YYYY-MM-DD in Eastern. */
function toCampusDay(d: Date): string {
  const { year, month, day } = getEasternDateParts(d)
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function noonOnDay(day: string): Date {
  return new Date(parseEasternDate(day).getTime() + 12 * 60 * 60 * 1000)
}

function mondayOfCampusWeek(weekNum: number): string {
  const range = campusWeekToDateRange(weekNum)
  if (!range) throw new Error(`No range for campus week ${weekNum}`)
  return toCampusDay(range.startDate)
}

/** Offset from Monday of a campus week as YYYY-MM-DD (0=Mon … 6=Sun). */
function dayInCampusWeek(weekNum: number, dayOffset: number): string {
  return toCampusDay(
    addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(weekNum)), dayOffset),
  )
}

function mockWahf(
  overrides: Partial<WahfRow> & Pick<WahfRow, "created_at">,
): WahfRow {
  return {
    id: "row-1",
    scholar_name: "",
    team_leader_contact: "",
    tl_meeting_in_person: "",
    course_changes: "",
    assignment_grades: {},
    missed_classes: "",
    missed_assignments: "",
    submitted_by_email: "",
    course_change_details: null,
    scholar_uid: UID,
    ...overrides,
  }
}

describe("computeWahfStatus", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("current campus week Mon before Thu deadline: prior-week submission only -> not overdue", () => {
    // Use week 3 so a prior week exists; Monday is before Thursday WAHF deadline.
    const week = 3
    vi.useFakeTimers({ now: noonOnDay(dayInCampusWeek(week, 0)) })
    const w = dateToCampusWeek(new Date())!
    expect(w).toBe(week)

    const priorWeekTue = dayInCampusWeek(week - 1, 1)
    const wahf: WahfRow[] = [
      mockWahf({ created_at: noonOnDay(priorWeekTue).toISOString() }),
    ]
    const status = computeWahfStatus(wahf, UID, w, w)
    expect(status.submitted).toBe(false)
    expect(status.daysOverdue).toBe(0)
  })

  it("current campus week Fri after Thu deadline: no submission -> overdue", () => {
    const week = 3
    vi.useFakeTimers({ now: noonOnDay(dayInCampusWeek(week, 4)) }) // Friday
    const w = dateToCampusWeek(new Date())!
    expect(w).toBe(week)
    const status = computeWahfStatus([], UID, w, w)
    expect(status.submitted).toBe(false)
    expect(status.daysOverdue).toBeGreaterThan(0)
  })

  it("current campus week with submission in that week -> submitted", () => {
    const week = 3
    const tue = dayInCampusWeek(week, 1)
    vi.useFakeTimers({ now: noonOnDay(tue) })
    const w = dateToCampusWeek(new Date())!
    const wahf: WahfRow[] = [
      mockWahf({ id: "a", created_at: noonOnDay(tue).toISOString() }),
    ]
    const status = computeWahfStatus(wahf, UID, w, w)
    expect(status.submitted).toBe(true)
    expect(status.daysOverdue).toBe(0)
    expect(status.latestSubmission?.id).toBe("a")
  })

  it("past campus week without submission -> daysOverdue reflects missed deadline", () => {
    const week = 4
    vi.useFakeTimers({ now: noonOnDay(dayInCampusWeek(week, 0)) })
    const current = dateToCampusWeek(new Date())!
    expect(current).toBe(week)
    const pastWeek = current - 1
    const status = computeWahfStatus([], UID, pastWeek, current)
    expect(status.submitted).toBe(false)
    expect(status.daysOverdue).toBeGreaterThan(0)
  })

  it("future campus week -> not overdue", () => {
    const week = 3
    vi.useFakeTimers({ now: noonOnDay(dayInCampusWeek(week, 0)) })
    const current = dateToCampusWeek(new Date())!
    const status = computeWahfStatus([], UID, current + 1, current)
    expect(status.submitted).toBe(false)
    expect(status.daysOverdue).toBe(0)
  })
})

describe("filterActivityForMenteeWeek", () => {
  it("buckets by campus week of activity_date, ignoring wrong week_num", () => {
    const week = 2
    const inWeek = dayInCampusWeek(week, 1)
    const priorWeek = dayInCampusWeek(week - 1, 1)
    vi.useFakeTimers({ now: noonOnDay(inWeek) })
    expect(dateToCampusWeek(noonOnDay(inWeek))).toBe(week)

    const activity: ActivityRow[] = [
      {
        scholar_uid: UID,
        activity_date: inWeek,
        week_num: 999, // intentionally wrong — must not be used
        log_source: "study_session_logs",
        duration_minutes: 60,
      },
      {
        scholar_uid: UID,
        activity_date: priorWeek,
        week_num: week, // stored as target week but date is prior week
        log_source: "front_desk_logs",
        duration_minutes: 30,
      },
      {
        scholar_uid: "other",
        activity_date: inWeek,
        week_num: week,
        log_source: "study_session_logs",
        duration_minutes: 45,
      },
    ]

    const { studySession, frontDesk } = filterActivityForMenteeWeek(
      activity,
      UID,
      week,
    )
    expect(studySession).toHaveLength(1)
    expect(studySession[0].duration_minutes).toBe(60)
    expect(frontDesk).toHaveLength(0)
  })
})

describe("addComplianceToDailyHours", () => {
  it("preserves actual bars while adding scheduled intervals and no-show or unscheduled status", () => {
    const week = 2
    const monday = dayInCampusWeek(week, 0)
    const tuesday = dayInCampusWeek(week, 1)
    const wednesday = dayInCampusWeek(week, 2)
    const compliance: ShiftComplianceByKind = {
      insideMinutes: 60,
      outsideMinutes: 30,
      noShowCount: 1,
      dates: [
        {
          date: monday,
          scheduledStart: `${monday}T14:00:00.000Z`,
          scheduledEnd: `${monday}T16:00:00.000Z`,
          insideMinutes: 60,
          outsideMinutes: 0,
          noShow: false,
          unscheduled: false,
          sessions: [],
        },
        {
          date: tuesday,
          scheduledStart: `${tuesday}T14:00:00.000Z`,
          scheduledEnd: `${tuesday}T16:00:00.000Z`,
          insideMinutes: 0,
          outsideMinutes: 0,
          noShow: true,
          unscheduled: false,
          sessions: [],
        },
        {
          date: wednesday,
          scheduledStart: null,
          scheduledEnd: null,
          insideMinutes: 0,
          outsideMinutes: 30,
          noShow: false,
          unscheduled: true,
          sessions: [],
        },
      ],
    }

    const daily = computeDailyHours([
      {
        scholar_uid: UID,
        activity_date: monday,
        week_num: week,
        log_source: "study_session_logs",
        duration_minutes: 90,
      },
    ])
    const result = addComplianceToDailyHours(daily, compliance, week)

    expect(result[0]).toMatchObject({ hours: 1.5, scheduledHours: 2, noShow: false })
    expect(result[1]).toMatchObject({ hours: 0, scheduledHours: 2, noShow: true })
    expect(result[2]).toMatchObject({ hours: 0, scheduledHours: 0, unscheduled: true })
  })
})

describe("durationMinutesFromClockTimes", () => {
  it("parses 24h form times like 15:00", () => {
    expect(clockStringToMinutes("15:00")).toBe(15 * 60)
    expect(durationMinutesFromClockTimes("14:00", "15:00")).toBe(60)
    expect(durationMinutesFromClockTimes("14:30", "16:00")).toBe(90)
    expect(durationMinutesFromClockTimes("2:00 PM", "3:00 PM")).toBe(60)
    expect(durationMinutesFromClockTimes("", "15:00")).toBe(0)
  })
})

describe("computeTutoringSessions", () => {
  it("filters by campus week of date and uses clock duration", () => {
    const week = 2
    const inWeek = dayInCampusWeek(week, 1)
    const priorWeek = dayInCampusWeek(week - 1, 1)
    vi.useFakeTimers({ now: noonOnDay(inWeek) })

    const tutoring: TutoringRow[] = [
      {
        id: 1,
        created_at: noonOnDay(inWeek).toISOString(),
        date: inWeek,
        scholar_uid: UID,
        start_time: "14:00",
        end_time: "15:00",
        courses: ["MATH 101"],
        tutor_name: "Alex",
      },
      {
        id: 2,
        created_at: noonOnDay(priorWeek).toISOString(),
        date: priorWeek,
        scholar_uid: UID,
        start_time: "14:00",
        end_time: "15:00",
        courses: ["CHEM 101"],
        tutor_name: "Sam",
      },
    ]

    const sessions = computeTutoringSessions(tutoring, UID, week)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].course).toBe("MATH 101")
    expect(sessions[0].durationMinutes).toBe(60)
  })

  it("uses date when start_time is a clock string and skips rows with no date", () => {
    const week = 2
    const inWeek = dayInCampusWeek(week, 1)
    vi.useFakeTimers({ now: noonOnDay(inWeek) })

    const tutoring: TutoringRow[] = [
      {
        id: 1,
        created_at: noonOnDay(inWeek).toISOString(),
        date: inWeek,
        scholar_uid: UID,
        start_time: "15:00",
        end_time: "16:30",
        courses: ["MATH 101"],
        tutor_name: "Alex",
      },
      {
        id: 2,
        created_at: noonOnDay(inWeek).toISOString(),
        date: null,
        scholar_uid: UID,
        start_time: "not-a-date",
        end_time: "also-bad",
        courses: ["SKIP"],
        tutor_name: "Bad",
      },
    ]

    const sessions = computeTutoringSessions(tutoring, UID, week)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].course).toBe("MATH 101")
    expect(sessions[0].durationMinutes).toBe(90)
  })
})
