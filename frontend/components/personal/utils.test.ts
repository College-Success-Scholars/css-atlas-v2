import { describe, it, expect, vi, afterEach } from "vitest"
import {
  FALL_SEMESTER_FIRST_DAY,
  WINTER_BREAK_FIRST_DAY,
  WINTER_BREAK_LAST_DAY,
  addEasternCalendarDays,
  campusWeekToDateRange,
  dateToCampusWeek,
  getEasternDateParts,
  parseEasternDate,
} from "@/lib/format/time"
import {
  computeWeekOptions,
  findSubmissionForCampusWeek,
  getFormStatusForWeek,
  formatCampusWeekRangeWithYear,
  countableMcfRequired,
  buildMcfMenteeOptions,
} from "./utils"
import type { WahfRow, McfRow, MenteeRow } from "@/lib/types/supabase"

/** YYYY-MM-DD in Eastern. */
function toCampusDay(d: Date): string {
  const { year, month, day } = getEasternDateParts(d)
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Local noon-ish Instant on an Eastern calendar day (stable for weekOf). */
function noonOnDay(day: string): Date {
  return new Date(parseEasternDate(day).getTime() + 12 * 60 * 60 * 1000)
}

/** Monday (start) of campus week N as YYYY-MM-DD. */
function mondayOfCampusWeek(weekNum: number): string {
  const range = campusWeekToDateRange(weekNum)
  if (!range) throw new Error(`No range for campus week ${weekNum}`)
  return toCampusDay(range.startDate)
}

afterEach(() => {
  vi.useRealTimers()
})

describe("computeWeekOptions", () => {
  it("returns empty when collection year has not started", () => {
    expect(computeWeekOptions(null)).toEqual([])
  })

  it("returns weeks 1..current newest-first and marks current", () => {
    // Monday of week 3 relative to configured Fall start.
    vi.useFakeTimers({ now: noonOnDay(mondayOfCampusWeek(3)) })
    const current = dateToCampusWeek(new Date())
    expect(current).toBe(3)

    const options = computeWeekOptions(current)
    expect(options.map((o) => o.weekNum)).toEqual([3, 2, 1])
    expect(options.find((o) => o.isCurrent)?.weekNum).toBe(3)
    expect(options.every((o) => o.label.includes("–"))).toBe(true)
  })

  it("includes a single winter-break campus week (not many ISO weeks)", () => {
    vi.useFakeTimers({ now: noonOnDay(WINTER_BREAK_FIRST_DAY) })
    const breakWeek = dateToCampusWeek(noonOnDay(WINTER_BREAK_FIRST_DAY))
    const lastBreak = dateToCampusWeek(noonOnDay(WINTER_BREAK_LAST_DAY))
    expect(breakWeek).not.toBeNull()
    expect(breakWeek).toBe(lastBreak)

    const options = computeWeekOptions(breakWeek)
    const breakOptions = options.filter((o) => o.weekNum === breakWeek)
    expect(breakOptions).toHaveLength(1)

    const range = campusWeekToDateRange(breakWeek!)
    expect(range).not.toBeNull()
    expect(range!.endDate.getTime() - range!.startDate.getTime()).toBeGreaterThan(
      7 * 24 * 60 * 60 * 1000,
    )
  })
})

describe("findSubmissionForCampusWeek", () => {
  it("matches rows by campus week of created_at", () => {
    const week1Mon = mondayOfCampusWeek(1)
    const week2Mon = mondayOfCampusWeek(2)
    const week2Tue = toCampusDay(addEasternCalendarDays(parseEasternDate(week2Mon), 1))

    vi.useFakeTimers({ now: noonOnDay(week2Tue) })
    const week = dateToCampusWeek(noonOnDay(week2Mon))
    expect(week).toBe(2)

    const rows = [
      { created_at: noonOnDay(week1Mon).toISOString(), id: "w1" },
      { created_at: noonOnDay(week2Tue).toISOString(), id: "w2" },
    ]
    expect(findSubmissionForCampusWeek(rows, week!)?.id).toBe("w2")
    expect(findSubmissionForCampusWeek(rows, 1)?.id).toBe("w1")
  })
})

describe("getFormStatusForWeek", () => {
  function mockWahf(created_at: string): WahfRow {
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
      scholar_uid: "s1",
      created_at,
    }
  }

  it("marks past campus week without submission as missed", () => {
    vi.useFakeTimers({ now: noonOnDay(mondayOfCampusWeek(3)) })
    const current = dateToCampusWeek(new Date())!
    const status = getFormStatusForWeek("WAHF", [], [], [], current - 1, current)
    expect(status.status).toBe("missed")
  })

  it("marks done when submission falls in that campus week", () => {
    const week2Tue = toCampusDay(
      addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(2)), 1),
    )
    const createdAt = noonOnDay(week2Tue).toISOString()
    vi.useFakeTimers({ now: noonOnDay(week2Tue) })
    const week = dateToCampusWeek(noonOnDay(week2Tue))!
    const status = getFormStatusForWeek(
      "WAHF",
      [mockWahf(createdAt)],
      [],
      [],
      week,
      week,
    )
    expect(status.status).toBe("done")
    expect(status.submission?.created_at).toBe(createdAt)
    expect(status.completedCount).toBe(1)
    expect(status.requiredCount).toBe(1)
  })
})

function mockMcf(overrides: Partial<McfRow> & { created_at: string; id: string }): McfRow {
  return {
    mentor_name: "TL",
    mentor_uid: "tl-1",
    mentee_name: "Ada",
    mentee_uid: "s-1",
    meeting_date: null,
    meeting_time: null,
    met_in_person: null,
    reason_no_meeting: null,
    tasks_completed: null,
    meeting_notes: null,
    tutoring_status: null,
    needs_tutor: null,
    support_rank: null,
    submitted_by_email: null,
    ...overrides,
  }
}

describe("countableMcfRequired", () => {
  it("treats missing, zero, and -1 as nothing owed", () => {
    expect(countableMcfRequired(null)).toBe(0)
    expect(countableMcfRequired(0)).toBe(0)
    expect(countableMcfRequired(-1)).toBe(0)
    expect(countableMcfRequired(2)).toBe(2)
  })
})

describe("buildMcfMenteeOptions", () => {
  it("lists assigned mentees and keeps the latest log per mentee", () => {
    const week2Tue = toCampusDay(
      addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(2)), 1),
    )
    const week2Wed = toCampusDay(
      addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(2)), 2),
    )
    const mentees: MenteeRow[] = [
      { scholar_uid: "s-1", first_name: "Ada", last_name: "Lovelace", fd_required: 120, ss_required: 180 },
      { scholar_uid: "s-2", first_name: "Grace", last_name: "Hopper", fd_required: 120, ss_required: 180 },
    ]
    const logs: McfRow[] = [
      mockMcf({
        id: "old",
        created_at: noonOnDay(week2Tue).toISOString(),
        mentee_uid: "s-1",
        mentee_name: "Ada Lovelace",
        meeting_notes: "first",
      }),
      mockMcf({
        id: "new",
        created_at: noonOnDay(week2Wed).toISOString(),
        mentee_uid: "s-1",
        mentee_name: "Ada Lovelace",
        meeting_notes: "latest",
      }),
    ]

    const options = buildMcfMenteeOptions(mentees, logs, 2)
    expect(options.map((o) => o.key)).toEqual(["s-1", "s-2"])
    expect(options[0]?.submission?.id).toBe("new")
    expect(options[1]?.submission).toBeNull()
  })

  it("includes a week log mentee who is no longer on the roster", () => {
    const week2Tue = toCampusDay(
      addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(2)), 1),
    )
    const logs: McfRow[] = [
      mockMcf({
        id: "alumni",
        created_at: noonOnDay(week2Tue).toISOString(),
        mentee_uid: "s-9",
        mentee_name: "Former Mentee",
      }),
    ]
    const options = buildMcfMenteeOptions([], logs, 2)
    expect(options).toHaveLength(1)
    expect(options[0]?.menteeName).toBe("Former Mentee")
  })
})

describe("getFormStatusForWeek MCF", () => {
  it("is done with no mentees owed even without a log", () => {
    vi.useFakeTimers({ now: noonOnDay(mondayOfCampusWeek(2)) })
    const status = getFormStatusForWeek("MCF", [], [], [], 2, 2, -1)
    expect(status.status).toBe("done")
    expect(status.requiredCount).toBe(0)
    expect(status.completedCount).toBe(0)
  })

  it("stays pending when only one of two mentees has a log this week", () => {
    const week2Tue = toCampusDay(
      addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(2)), 1),
    )
    vi.useFakeTimers({ now: noonOnDay(week2Tue) })
    const status = getFormStatusForWeek(
      "MCF",
      [],
      [
        mockMcf({
          id: "one",
          created_at: noonOnDay(week2Tue).toISOString(),
          mentee_uid: "s-1",
        }),
      ],
      [],
      2,
      2,
      2,
    )
    expect(status.status).toBe("pending")
    expect(status.completedCount).toBe(1)
    expect(status.requiredCount).toBe(2)
  })

  it("is done when each mentee has a log", () => {
    const week2Tue = toCampusDay(
      addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(2)), 1),
    )
    vi.useFakeTimers({ now: noonOnDay(week2Tue) })
    const createdAt = noonOnDay(week2Tue).toISOString()
    const status = getFormStatusForWeek(
      "MCF",
      [],
      [
        mockMcf({ id: "a", created_at: createdAt, mentee_uid: "s-1" }),
        mockMcf({ id: "b", created_at: createdAt, mentee_uid: "s-2", mentee_name: "Grace" }),
      ],
      [],
      2,
      2,
      2,
    )
    expect(status.status).toBe("done")
    expect(status.completedCount).toBe(2)
  })

  it("does not treat two logs for the same mentee as complete", () => {
    const week1Mon = mondayOfCampusWeek(1)
    vi.useFakeTimers({ now: noonOnDay(mondayOfCampusWeek(2)) })
    const createdAt = noonOnDay(week1Mon).toISOString()
    const status = getFormStatusForWeek(
      "MCF",
      [],
      [
        mockMcf({ id: "a", created_at: createdAt, mentee_uid: "s-1" }),
        mockMcf({ id: "b", created_at: createdAt, mentee_uid: "s-1", mentee_name: "Ada" }),
      ],
      [],
      1,
      2,
      2,
    )
    expect(status.status).toBe("incomplete")
    expect(status.completedCount).toBe(1)
    expect(status.requiredCount).toBe(2)
  })

  it("is incomplete after the deadline when only some mentees have a log", () => {
    const week2Fri = toCampusDay(
      addEasternCalendarDays(parseEasternDate(mondayOfCampusWeek(2)), 4),
    )
    vi.useFakeTimers({
      now: new Date(parseEasternDate(week2Fri).getTime() + 18 * 60 * 60 * 1000),
    })
    const status = getFormStatusForWeek(
      "MCF",
      [],
      [
        mockMcf({
          id: "one",
          created_at: noonOnDay(week2Fri).toISOString(),
          mentee_uid: "s-1",
        }),
      ],
      [],
      2,
      2,
      2,
    )
    expect(status.status).toBe("incomplete")
    expect(status.completedCount).toBe(1)
    expect(status.requiredCount).toBe(2)
  })
})

describe("formatCampusWeekRangeWithYear", () => {
  it("includes year for a known campus week", () => {
    const fallYear = FALL_SEMESTER_FIRST_DAY.slice(0, 4)
    const label = formatCampusWeekRangeWithYear(1)
    expect(label).toContain(fallYear)
    expect(label).toContain("–")
  })
})
