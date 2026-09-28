/**
 * @file campus-week.ts
 * @module frontend/lib/format
 *
 * Campus-week labels and week-list helpers for the shared week selector.
 * Date spans come from the shared campus calendar (`campusWeekToDateRange`).
 *
 * ## What belongs here
 * - Week-number labels that include the calendar days they represent
 * - Contiguous week lists and previous/next neighbors by week number
 *
 * ## What does NOT belong here
 * - Route navigation (`?week=` pushes live in the week selector component)
 * - Form deadline math (see form-deadlines.ts)
 */

import { format } from "date-fns"

import { campusWeekToDateRange } from "./time"

export function parseWeekParam(weekParam?: string): number | null {
  if (!weekParam || !/^\d+$/.test(weekParam)) return null
  const weekNumber = Number(weekParam)
  return weekNumber > 0 ? weekNumber : null
}

/** Monday–Sunday span for a campus week, e.g. "Aug 31–Sep 6". */
export function formatCampusWeekDateRange(weekNum: number): string {
  const range = campusWeekToDateRange(weekNum)
  if (!range) return `Week ${weekNum}`
  return `${format(range.startDate, "MMM d")}\u2013${format(range.endDate, "MMM d")}`
}

/** Closed-control and menu label: "Week 3 (current) · Aug 31–Sep 6". */
export function formatCampusWeekOptionLabel(
  weekNum: number,
  currentCampusWeek: number | null,
): string {
  const dates = formatCampusWeekDateRange(weekNum)
  const title = weekNum === currentCampusWeek ? `Week ${weekNum} (current)` : `Week ${weekNum}`
  if (dates === `Week ${weekNum}`) return title
  return `${title} · ${dates}`
}

/** Weeks 1 through `maxWeek`, ascending. Empty when the year has not started. */
export function campusWeekNumbers(maxWeek: number | null): number[] {
  if (maxWeek == null || maxWeek < 1) return []
  return Array.from({ length: maxWeek }, (_, i) => i + 1)
}

/**
 * Previous is the greatest week below the selection; next is the smallest week above it.
 * Array order does not matter, so a newest-first list still moves left to an older week.
 */
export function adjacentCampusWeeks(
  weeks: number[],
  selectedWeek: number | null,
): { prevWeek: number | null; nextWeek: number | null } {
  if (selectedWeek == null) return { prevWeek: null, nextWeek: null }

  let prevWeek: number | null = null
  let nextWeek: number | null = null
  for (const week of weeks) {
    if (week < selectedWeek && (prevWeek == null || week > prevWeek)) prevWeek = week
    if (week > selectedWeek && (nextWeek == null || week < nextWeek)) nextWeek = week
  }
  return { prevWeek, nextWeek }
}
