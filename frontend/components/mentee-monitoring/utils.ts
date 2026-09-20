import {
  format,
  parseISO,
  getISODay,
  differenceInCalendarDays,
} from "date-fns"
import { getWhafDeadlineForWeek } from "@/lib/format/form-deadlines"
import { dateToCampusWeek, parseEasternDate } from "@/lib/format/time"
import type {
  ActivityRow,
  ShiftComplianceByKind,
  WahfRow,
  TutoringRow,
} from "@/lib/types/supabase"
import {
  computeWeekOptions,
  findSubmissionForCampusWeek,
  type WeekOption,
} from "@/components/personal/utils"

export { computeWeekOptions, type WeekOption }

// ---------------------------------------------------------------------------
// Activity filtering
// ---------------------------------------------------------------------------

export type DailyHoursEntry = {
  dayLabel: string
  hours: number
  scheduledHours: number
  scheduledStart: string | null
  scheduledEnd: string | null
  noShow: boolean
  unscheduled: boolean
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

/** Campus week from activity_date — never trust stored week_num. */
function campusWeekForActivityDate(activityDate: string): number | null {
  const day = activityDate.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    try {
      return dateToCampusWeek(parseEasternDate(day))
    } catch {
      return null
    }
  }
  const d = new Date(activityDate)
  if (Number.isNaN(d.getTime())) return null
  return dateToCampusWeek(d)
}

export function filterActivityForMenteeWeek(
  activity: ActivityRow[],
  uid: string,
  weekNum: number,
) {
  const rows = activity.filter((r) => {
    if (r.scholar_uid !== uid) return false
    return campusWeekForActivityDate(r.activity_date) === weekNum
  })
  const studySession = rows.filter((r) => r.log_source === "study_session_logs")
  const frontDesk = rows.filter((r) => r.log_source === "front_desk_logs")
  return { studySession, frontDesk }
}

export function computeDailyHours(rows: ActivityRow[]): DailyHoursEntry[] {
  const buckets = new Array<number>(7).fill(0)

  for (const row of rows) {
    const date = parseISO(row.activity_date)
    const dayIndex = getISODay(date) - 1 // 1=Mon → 0, 7=Sun → 6
    buckets[dayIndex] += row.duration_minutes
  }

  return buckets.map((mins, i) => ({
    dayLabel: DAY_LABELS[i],
    hours: Math.round((mins / 60) * 10) / 10,
    scheduledHours: 0,
    scheduledStart: null,
    scheduledEnd: null,
    noShow: false,
    unscheduled: false,
  }))
}

/** Adds assignment-aware schedule details without changing the actual log totals. */
export function addComplianceToDailyHours(
  dailyHours: DailyHoursEntry[],
  compliance: ShiftComplianceByKind | null,
  weekNum: number,
): DailyHoursEntry[] {
  if (!compliance) return dailyHours

  const entries = dailyHours.map((day) => ({ ...day }))

  for (const date of compliance.dates) {
    let dateValue: Date
    try {
      dateValue = parseEasternDate(date.date)
    } catch {
      continue
    }
    if (dateToCampusWeek(dateValue) !== weekNum) continue

    const dayIndex = getISODay(dateValue) - 1
    const entry = entries[dayIndex]
    if (!entry) continue

    entry.noShow ||= date.noShow
    entry.unscheduled ||= date.unscheduled
    if (!date.scheduledStart || !date.scheduledEnd) continue

    const scheduledHours =
      (new Date(date.scheduledEnd).getTime() - new Date(date.scheduledStart).getTime()) /
      (60 * 60 * 1000)
    if (!Number.isFinite(scheduledHours) || scheduledHours <= 0) continue

    entry.scheduledHours += scheduledHours
    entry.scheduledStart ??= date.scheduledStart
    entry.scheduledEnd = date.scheduledEnd
  }

  return entries
}

export function sumMinutesToHours(rows: ActivityRow[]): number {
  const total = rows.reduce((sum, r) => sum + r.duration_minutes, 0)
  return Math.round((total / 60) * 10) / 10
}

// ---------------------------------------------------------------------------
// WAHF status
// ---------------------------------------------------------------------------

export type WahfStatus = {
  submitted: boolean
  dueDate: string
  daysOverdue: number
  latestSubmission: WahfRow | null
}

export function computeWahfStatus(
  wahf: WahfRow[],
  uid: string,
  weekNum: number,
  currentCampusWeek: number | null,
): WahfStatus {
  const menteeWahf = wahf.filter((w) => w.scholar_uid === uid)
  const submission = findSubmissionForCampusWeek(menteeWahf, weekNum)
  const submitted = submission != null

  const now = new Date()
  const deadline = getWhafDeadlineForWeek(weekNum)
  const dueDate = deadline ? format(deadline, "MMM d, yyyy") : ""

  let daysOverdue = 0
  if (submission) {
    daysOverdue = 0
  } else if (currentCampusWeek != null && weekNum < currentCampusWeek) {
    if (deadline) {
      daysOverdue = Math.max(0, differenceInCalendarDays(now, deadline))
    }
  } else if (currentCampusWeek != null && weekNum === currentCampusWeek) {
    if (deadline && now.getTime() > deadline.getTime()) {
      daysOverdue = Math.max(0, differenceInCalendarDays(now, deadline))
    }
  }

  return {
    submitted,
    dueDate,
    daysOverdue,
    latestSubmission: submission,
  }
}

// ---------------------------------------------------------------------------
// Tutoring
// ---------------------------------------------------------------------------

export type TutoringSessionDerived = {
  id: number
  course: string
  tutorName: string
  durationMinutes: number
}

/** Prefer session `date` (YYYY-MM-DD); fall back to valid ISO `start_time`. Skip bad rows. */
function campusWeekForTutoringRow(t: TutoringRow): number | null {
  const day = t.date?.slice(0, 10)
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    try {
      return dateToCampusWeek(parseEasternDate(day))
    } catch {
      // fall through to start_time
    }
  }
  if (!t.start_time) return null
  const start = new Date(t.start_time)
  if (Number.isNaN(start.getTime())) return null
  return dateToCampusWeek(start)
}

/**
 * Parse form clock strings like "15:00" or "3:00 PM" to minutes since midnight.
 * `start_time` / `end_time` on tutor_report_logs are text, not timestamps.
 */
export function clockStringToMinutes(value: string): number | null {
  const s = value.trim()
  const m24 = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (m24) {
    const h = Number(m24[1])
    const min = Number(m24[2])
    if (h > 23 || min > 59) return null
    return h * 60 + min
  }
  const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s)
  if (m12) {
    let h = Number(m12[1])
    const min = Number(m12[2])
    const ap = m12[3].toUpperCase()
    if (h < 1 || h > 12 || min > 59) return null
    if (ap === "AM") h = h === 12 ? 0 : h
    else h = h === 12 ? 12 : h + 12
    return h * 60 + min
  }
  return null
}

/** Duration in minutes from tutor form clock fields (e.g. "14:00" → "15:00" = 60). */
export function durationMinutesFromClockTimes(start: string, end: string): number {
  const a = clockStringToMinutes(start)
  const b = clockStringToMinutes(end)
  if (a == null || b == null) return 0
  let diff = b - a
  if (diff < 0) diff += 24 * 60
  return diff
}

export function computeTutoringSessions(
  tutoring: TutoringRow[],
  uid: string,
  weekNum: number,
): TutoringSessionDerived[] {
  const rows = tutoring.filter((t) => {
    if (t.scholar_uid !== uid) return false
    return campusWeekForTutoringRow(t) === weekNum
  })

  return rows.flatMap((row) => {
    const durationMinutes = durationMinutesFromClockTimes(
      row.start_time ?? "",
      row.end_time ?? "",
    )

    return (row.courses ?? []).map((course) => ({
      id: row.id,
      course,
      tutorName: row.tutor_name,
      durationMinutes,
    }))
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function menteeName(
  mentee: { first_name: string | null; last_name: string | null },
): string {
  return [mentee.first_name, mentee.last_name].filter(Boolean).join(" ") || "Unknown"
}

export function getTodayDayLabel(): string {
  const idx = getISODay(new Date()) - 1
  return DAY_LABELS[idx]
}
