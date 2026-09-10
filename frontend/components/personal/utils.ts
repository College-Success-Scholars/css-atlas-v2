import {
  format,
  differenceInMilliseconds,
  differenceInCalendarDays,
} from "date-fns"
import type { WahfRow, McfRow, WplRow, MenteeRow } from "@/lib/types/supabase"
import {
  getWhafDeadlineForWeek,
  getMcfWplDeadlineForWeek,
  isWhafLateForWeek,
  isMcfLateForWeek,
  isWplLateForWeek,
} from "@/lib/format/form-deadlines"
import { campusWeekToDateRange, dateToCampusWeek } from "@/lib/format/time"

// ---------------------------------------------------------------------------
// Week options (campus calendar — shared by Personal + Mentee)
// ---------------------------------------------------------------------------

export type WeekOption = {
  weekNum: number
  label: string
  isCurrent: boolean
}

function formatCampusWeekLabel(
  weekNum: number,
  now: Date,
): string | null {
  const range = campusWeekToDateRange(weekNum)
  if (!range) return null

  const displayEnd = range.endDate > now ? now : range.endDate
  const end = displayEnd < range.startDate ? range.endDate : displayEnd
  return `${format(range.startDate, "MMM d")}\u2013${format(end, "MMM d")}`
}

/**
 * Campus weeks from 1 through the current campus week (newest first).
 * Empty when the collection year has not started (`currentCampusWeek` is null).
 */
export function computeWeekOptions(
  currentCampusWeek: number | null,
  now: Date = new Date(),
): WeekOption[] {
  if (currentCampusWeek == null || currentCampusWeek < 1) return []

  const options: WeekOption[] = []
  for (let wk = 1; wk <= currentCampusWeek; wk++) {
    const label = formatCampusWeekLabel(wk, now)
    if (!label) continue
    options.push({
      weekNum: wk,
      label,
      isCurrent: wk === currentCampusWeek,
    })
  }

  return options.reverse()
}

// ---------------------------------------------------------------------------
// Form status
// ---------------------------------------------------------------------------

export type FormType = "WAHF" | "WPL" | "MCF"

export type FormStatus = "done" | "pending" | "overdue" | "missed" | "incomplete"

export type FormStatusResult = {
  formType: FormType
  status: FormStatus
  submittedAt: string | null
  isLate: boolean
  daysOverdue: number
  hoursLeft: number
  submission: WahfRow | McfRow | WplRow | null
  /** Distinct mentees with an MCF this week (MCF only; 0/1 for WAHF/WPL). */
  completedCount: number
  /**
   * Forms owed this week. MCF uses roster `mentee_count` (≤0 including −1 = none owed).
   * WAHF/WPL always owe 1.
   */
  requiredCount: number
}

export type McfMenteeOption = {
  key: string
  menteeUid: string | null
  menteeName: string
  submission: McfRow | null
}

export function findSubmissionsForCampusWeek<T extends { created_at: string }>(
  rows: T[],
  weekNum: number,
): T[] {
  return rows.filter((r) => {
    const created = new Date(r.created_at)
    if (Number.isNaN(created.getTime())) return false
    return dateToCampusWeek(created) === weekNum
  })
}

export function findSubmissionForCampusWeek<T extends { created_at: string }>(
  rows: T[],
  weekNum: number,
): T | null {
  return findSubmissionsForCampusWeek(rows, weekNum)[0] ?? null
}

export function latestSubmissionForCampusWeek<T extends { created_at: string }>(
  rows: T[],
  weekNum: number,
): T | null {
  const matches = findSubmissionsForCampusWeek(rows, weekNum)
  if (matches.length === 0) return null
  return matches.reduce((best, row) =>
    (row.created_at ?? "") > (best.created_at ?? "") ? row : best,
  )
}

/** Roster sentinel −1 (no mentor_mentee row) and 0 both mean nothing owed. */
export function countableMcfRequired(menteeCount: number | null | undefined): number {
  return Math.max(0, menteeCount ?? 0)
}

export function menteeDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "Unknown mentee",
): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || fallback
}

export function mcfMenteeKey(row: Pick<McfRow, "id" | "mentee_uid" | "mentee_name">): string {
  if (row.mentee_uid) return row.mentee_uid
  const named = row.mentee_name?.trim()
  if (named) return `name:${named}`
  return `log:${row.id}`
}

/**
 * Assigned mentees plus anyone who already has an MCF this campus week.
 * Duplicate logs for the same mentee keep the latest `created_at`.
 */
export function buildMcfMenteeOptions(
  mentees: MenteeRow[],
  mcf: McfRow[],
  weekNum: number,
): McfMenteeOption[] {
  const byKey = new Map<string, McfMenteeOption>()

  for (const mentee of mentees) {
    if (!mentee.scholar_uid) continue
    byKey.set(mentee.scholar_uid, {
      key: mentee.scholar_uid,
      menteeUid: mentee.scholar_uid,
      menteeName: menteeDisplayName(mentee.first_name, mentee.last_name),
      submission: null,
    })
  }

  const weekLogs = [...findSubmissionsForCampusWeek(mcf, weekNum)].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )
  for (const row of weekLogs) {
    const key = mcfMenteeKey(row)
    const existing = byKey.get(key)
    byKey.set(key, {
      key,
      menteeUid: row.mentee_uid ?? existing?.menteeUid ?? null,
      menteeName: row.mentee_name?.trim() || existing?.menteeName || "Unknown mentee",
      submission: row,
    })
  }

  return [...byKey.values()].sort((a, b) => a.menteeName.localeCompare(b.menteeName))
}

export function countDistinctMcfMentees(mcf: McfRow[], weekNum: number): number {
  const keys = new Set(findSubmissionsForCampusWeek(mcf, weekNum).map(mcfMenteeKey))
  return keys.size
}

function incompleteStatusForWeek(
  weekNum: number,
  currentCampusWeek: number | null,
  deadline: Date | null,
  now: Date,
): Pick<FormStatusResult, "status" | "daysOverdue" | "hoursLeft"> {
  let daysOverdue = 0
  let hoursLeft = 0

  if (currentCampusWeek != null && weekNum < currentCampusWeek) {
    if (deadline) daysOverdue = Math.max(0, differenceInCalendarDays(now, deadline))
    return { status: "missed", daysOverdue, hoursLeft }
  }

  if (currentCampusWeek != null && weekNum === currentCampusWeek) {
    if (deadline && now.getTime() > deadline.getTime()) {
      daysOverdue = Math.max(0, differenceInCalendarDays(now, deadline))
      return { status: "overdue", daysOverdue, hoursLeft }
    }
    if (deadline) {
      const msLeft = differenceInMilliseconds(deadline, now)
      hoursLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60)))
    }
    return { status: "pending", daysOverdue, hoursLeft }
  }

  return { status: "pending", daysOverdue, hoursLeft }
}

export function getFormStatusForWeek(
  formType: FormType,
  wahf: WahfRow[],
  mcf: McfRow[],
  wpl: WplRow[],
  weekNum: number,
  currentCampusWeek: number | null,
  menteeCount: number | null = null,
): FormStatusResult {
  const now = new Date()
  const deadline =
    formType === "WAHF" ? getWhafDeadlineForWeek(weekNum) : getMcfWplDeadlineForWeek(weekNum)

  if (formType === "MCF") {
    const weekLogs = findSubmissionsForCampusWeek(mcf, weekNum)
    const submission = latestSubmissionForCampusWeek(mcf, weekNum)
    const requiredCount = countableMcfRequired(menteeCount)
    const completedCount = countDistinctMcfMentees(mcf, weekNum)
    const isLate = weekLogs.some((row) => isMcfLateForWeek(row.created_at, weekNum))
    const complete = requiredCount <= 0 || completedCount >= requiredCount
    const partial = requiredCount > 1 && completedCount > 0 && completedCount < requiredCount
    const clock = complete
      ? { status: "done" as const, daysOverdue: 0, hoursLeft: 0 }
      : incompleteStatusForWeek(weekNum, currentCampusWeek, deadline, now)
    const status =
      complete
        ? clock.status
        : partial && clock.status !== "pending"
          ? "incomplete"
          : clock.status

    return {
      formType,
      status,
      submittedAt: submission?.created_at ?? null,
      isLate,
      daysOverdue: clock.daysOverdue,
      hoursLeft: clock.hoursLeft,
      submission,
      completedCount,
      requiredCount,
    }
  }

  const submission =
    formType === "WAHF"
      ? findSubmissionForCampusWeek(wahf, weekNum)
      : findSubmissionForCampusWeek(wpl, weekNum)
  const isLate = submission
    ? formType === "WAHF"
      ? isWhafLateForWeek(submission.created_at, weekNum)
      : isWplLateForWeek(submission.created_at, weekNum)
    : false
  const complete = submission != null
  const incomplete = complete
    ? { status: "done" as const, daysOverdue: 0, hoursLeft: 0 }
    : incompleteStatusForWeek(weekNum, currentCampusWeek, deadline, now)

  return {
    formType,
    status: incomplete.status,
    submittedAt: submission?.created_at ?? null,
    isLate,
    daysOverdue: incomplete.daysOverdue,
    hoursLeft: incomplete.hoursLeft,
    submission,
    completedCount: complete ? 1 : 0,
    requiredCount: 1,
  }
}

export function mcfProgressLabel(completedCount: number, requiredCount: number): string {
  if (requiredCount <= 0) return "No mentee assigned"
  return `${completedCount} of ${requiredCount} mentees`
}

export function canBrowseMcf(result: FormStatusResult): boolean {
  return result.formType === "MCF" && (result.requiredCount > 0 || result.completedCount > 0)
}

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------

const EASTERN_TIMEZONE = "America/New_York"

export function getGreeting(): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10,
  )
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

export function formatCampusWeekDateRange(weekNum: number): string {
  const range = campusWeekToDateRange(weekNum)
  if (!range) return `Week ${weekNum}`
  return `${format(range.startDate, "MMM d")}\u2013${format(range.endDate, "MMM d")}`
}

export function formatSubmittedDay(createdAt: string): string {
  const d = new Date(createdAt)
  return format(d, "EEE MMM d")
}

/**
 * Calendar span for a campus week with year (e.g. "Mar 24–30, 2026").
 */
export function formatCampusWeekRangeWithYear(weekNum: number): string {
  const range = campusWeekToDateRange(weekNum)
  if (!range) return `Week ${weekNum}`

  const { startDate: displayStart, endDate: displayEnd } = range
  const yStart = displayStart.getFullYear()
  const yEnd = displayEnd.getFullYear()
  const mStart = displayStart.getMonth()
  const mEnd = displayEnd.getMonth()

  if (yStart === yEnd && mStart === mEnd) {
    return `${format(displayStart, "MMM d")}\u2013${format(displayEnd, "d, yyyy")}`
  }
  if (yStart === yEnd) {
    return `${format(displayStart, "MMM d")}\u2013${format(displayEnd, "MMM d, yyyy")}`
  }
  return `${format(displayStart, "MMM d, yyyy")}\u2013${format(displayEnd, "MMM d, yyyy")}`
}

/** Date and time of submission in US Eastern (matches form deadline zone). */
export function formatSubmittedDateTime(createdAt: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(createdAt))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  const formatted = `${part("weekday")}, ${part("month")} ${part("day")}, ${part("hour")}:${part("minute")} ${part("dayPeriod")}`
  return formatted
}
