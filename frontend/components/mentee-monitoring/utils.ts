import {
  EASTERN_TIMEZONE,
  addEasternCalendarDays,
  parseEasternDate,
} from "@/lib/format/time"
import type { GradeBand, HourBand, ShiftSessionKind, ShiftStatus } from "@css-atlas/shared/contracts/mentees"
import type { WahfRow } from "@/lib/types/supabase"
import {
  computeWeekOptions,
  type WeekOption,
} from "@/components/personal/utils"

export { computeWeekOptions, type WeekOption }

// ---------------------------------------------------------------------------
// Campus-week hours (tickets + excuses — same scale as Weekly Memo)
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

// ---------------------------------------------------------------------------
// WAHF status
// ---------------------------------------------------------------------------

export type WahfStatus = {
  submitted: boolean
  dueDate: string
  daysOverdue: number
  latestSubmission: WahfRow | null
}

export function wahfGradeEntries(submission: WahfRow | null) {
  return Object.entries(submission?.assignment_grades ?? {}).flatMap(([course, assignments]) =>
    Object.entries(assignments).flatMap(([assessment, grade]) =>
      grade.trim() ? [{ course, assessment, grade }] : [],
    ),
  )
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function menteeName(
  mentee: { first_name: string | null; last_name: string | null },
): string {
  return [mentee.first_name, mentee.last_name].filter(Boolean).join(" ") || "Unknown"
}

// ---------------------------------------------------------------------------
// Mentee review presentation (redesign)
// ---------------------------------------------------------------------------

export const HOUR_BAND_STYLES: Record<HourBand, { text: string; bar: string; pill: string }> = {
  green: {
    text: "text-success-muted-foreground",
    bar: "bg-success",
    pill: "border-success/40 bg-success-muted text-success-muted-foreground",
  },
  orange: {
    text: "text-warning-muted-foreground",
    bar: "bg-warning",
    pill: "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  },
  red: {
    text: "text-destructive",
    bar: "bg-destructive",
    pill: "border-destructive/40 bg-destructive/10 text-destructive",
  },
}

/** Muted blue for unfinished current-week items; never orange or red. */
export const PENDING_STYLES = {
  text: "text-info-muted-foreground",
  bar: "bg-info",
  pill: "border-info/40 bg-info-muted text-info-muted-foreground",
  cell: "border-dashed border-info bg-card text-info-muted-foreground",
}

export const GRADE_BAND_STYLES: Record<GradeBand, string> = {
  green: "border-success/40 bg-success-muted text-success-muted-foreground",
  neutral: "border-border bg-muted text-muted-foreground",
  orange: "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  red: "border-destructive/40 bg-destructive/10 text-destructive",
}

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

/** One-decimal hours from exact minutes. */
export function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

export function formatHours(minutes: number): string {
  return hoursFromMinutes(minutes).toFixed(1)
}

export function formatPercent(percent: number): string {
  return `${(Math.round(percent * 10) / 10).toFixed(1)}%`
}

/** Compact session duration: 2h, 1.1h. */
export function formatCompactHours(minutes: number): string {
  const hours = hoursFromMinutes(minutes)
  return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)}h`
}

export function hourCardTitle(kind: ShiftSessionKind): string {
  return kind === "front_desk" ? "Front desk" : "Study sessions"
}

/** Short status copy for a scheduled shift row on the hour card. */
export function shiftStatusLabel(status: ShiftStatus): string {
  switch (status) {
    case "attended":
      return "Attended"
    case "short":
      return "Short"
    case "no_show":
      return "No-show"
    case "active":
      return "In progress"
    case "upcoming":
      return "Upcoming"
    case "unconfirmed":
      return "Unconfirmed"
  }
}

/** Program-local clock, e.g. "3:00pm". */
export function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: EASTERN_TIMEZONE,
  }).format(date)
  return formatted.replace(/\s?([AP])M$/, (_match, meridiem: string) => `${meridiem.toLowerCase()}m`)
}

/** Program-local range with explicit meridiems, including noon crossings. */
export function formatClockRange(startIso: string, endIso: string): string {
  const start = formatClock(startIso)
  const end = formatClock(endIso)
  return start && end ? `${start}–${end}` : ""
}

/** Program-local shift day, e.g. "Tuesday, Sep 8". */
export function formatShiftDay(date: string): string {
  let parsed: Date
  try {
    parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseEasternDate(date) : new Date(date)
    if (Number.isNaN(parsed.getTime())) return ""
  } catch {
    return date
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: EASTERN_TIMEZONE,
  }).format(parsed)
}

/** 24-hour "HH:MM" to a program-local label, e.g. "3:00pm". No timezone conversion. */
export function formatTimeOfDay(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return value
  const hour = Number(match[1])
  if (!Number.isInteger(hour) || hour > 23) return value
  const suffix = hour < 12 ? "am" : "pm"
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${match[2]}${suffix}`
}

export function formatDayMonth(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: EASTERN_TIMEZONE,
  }).format(date)
}

/** "Week 3 · Sep 7 – Sep 13". */
export function formatWeekTitle(weekNumber: number, weekStart: string, weekEnd: string): string {
  const start = formatDayMonth(weekStart)
  const end = formatDayMonth(weekEnd)
  return start && end ? `Week ${weekNumber} · ${start} – ${end}` : `Week ${weekNumber}`
}

export function formatWeekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday - 1] ?? ""
}

/** Program-local weekday + date, e.g. "Friday, Oct 30". */
export function formatWeekdayDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: EASTERN_TIMEZONE,
  }).format(date)
}

/** Friday of the current program-local week, e.g. "Friday, Oct 30". */
export function formatWeekFriday(weekStartIso: string): string {
  const start = new Date(weekStartIso)
  if (Number.isNaN(start.getTime())) return ""
  return formatWeekdayDate(addEasternCalendarDays(start, 4).toISOString())
}

/** "Friday 3:12pm" — the local weekday/time the data was loaded. */
export function formatAsOf(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: EASTERN_TIMEZONE,
  }).format(date)
  const time = formatClock(iso)
  return time ? `${weekday} ${time}` : weekday
}

export function menteeFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}
