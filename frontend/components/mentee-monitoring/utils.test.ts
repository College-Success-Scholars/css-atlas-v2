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
  addComplianceToDailyHours,
  dailyHoursFromAttendance,
  attendanceRowForKind,
  minutesToHours,
  durationMinutesFromClockTimes,
  clockStringToMinutes,
} from "./utils"
import type { ShiftComplianceByKind, WahfRow, TutoringRow } from "@/lib/types/supabase"
import type { AttendanceWeekBoardRow } from "@/lib/types/attendance-week"

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

function mockAttendanceRow(
  overrides: Partial<AttendanceWeekBoardRow> & Pick<AttendanceWeekBoardRow, "kind">,
): AttendanceWeekBoardRow {
  return {
    scholar_uid: UID,
    scholar_name: null,
    week_num: 2,
    mon_min: 0,
    tues_min: 0,
    wed_min: 0,
    thurs_min: 0,
    fri_min: 0,
    logged_min: 0,
    excuse_min: 0,
    description: null,
    required_min: null,
    effective_min: 0,
    completion_pct: null,
    ...overrides,
  }
}

describe("dailyHoursFromAttendance", () => {
  it("maps Mon–Fri ticket minutes and ignores missing rows", () => {
    const row = mockAttendanceRow({
      kind: "study_session",
      mon_min: 90,
      wed_min: 30,
      logged_min: 120,
      excuse_min: 15,
      effective_min: 135,
    })
    const daily = dailyHoursFromAttendance(row)
    expect(daily).toHaveLength(5)
    expect(daily.map((d) => d.dayLabel)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"])
    expect(daily[0].hours).toBe(1.5)
    expect(daily[1].hours).toBe(0)
    expect(daily[2].hours).toBe(0.5)
    expect(dailyHoursFromAttendance(null).every((d) => d.hours === 0)).toBe(true)
  })

  it("picks the row for uid and kind", () => {
    const rows = [
      mockAttendanceRow({ kind: "front_desk", scholar_uid: UID, logged_min: 30 }),
      mockAttendanceRow({ kind: "study_session", scholar_uid: UID, logged_min: 90, excuse_min: 15 }),
      mockAttendanceRow({ kind: "study_session", scholar_uid: "other", logged_min: 10 }),
    ]
    expect(attendanceRowForKind(rows, UID, "study_session")?.logged_min).toBe(90)
    expect(attendanceRowForKind(rows, UID, "front_desk")?.logged_min).toBe(30)
    expect(attendanceRowForKind(rows, "missing", "front_desk")).toBeNull()
  })

  it("converts minutes to hours at one decimal", () => {
    expect(minutesToHours(90)).toBe(1.5)
    expect(minutesToHours(15)).toBe(0.3)
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

    const daily = dailyHoursFromAttendance(
      mockAttendanceRow({
        kind: "study_session",
        mon_min: 90,
        logged_min: 90,
        effective_min: 90,
      }),
    )
    const result = addComplianceToDailyHours(daily, compliance, week)

    expect(result[0]).toMatchObject({ hours: 1.5, scheduledHours: 2, noShow: false })
    expect(result[1]).toMatchObject({ hours: 0, scheduledHours: 2, noShow: true })
    expect(result[2]).toMatchObject({ hours: 0, scheduledHours: 0, unscheduled: true })
    expect(result).toHaveLength(5)
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
