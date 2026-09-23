/**
 * @file traffic.service.ts
 * @module backend/services
 *
 * Traffic entry counting service.
 * "Traffic" measures the volume of front-desk check-in/check-out entries
 * per campus week. Used in the memo and traffic analytics pages.
 *
 * ## Responsibilities
 * - Fetch traffic sessions (check-in/out pairs) for a week
 * - Count total entry events for a week
 * - Count prior-week entries through the same weekday/time for memo KPI trend
 * - Batch-count entries for multiple weeks (for trend charts)
 *
 * ## What belongs here
 * - All Supabase queries on traffic/session_log tables for entry counting
 *
 * ## What does NOT belong here
 * - Session log cleaning/pairing (that's session-log.service.ts)
 * - HTTP request/response logic
 */
import { getSupabaseClient } from "../supabase/client.js";
import {
  addEasternCalendarDays,
  campusWeekToDateRange,
  dateToCampusWeek,
  getStartOfDayEastern,
  getWeekFetchEnd,
} from "./time.service.js";
import type { TrafficRow, TrafficSession, WeekEntryCount } from "../models/traffic.model.js";

// ---------------------------------------------------------------------------
// Query limit guard
// ---------------------------------------------------------------------------

function requireDateOrUidLimit(options?: {
  startDate?: Date;
  endDate?: Date;
  scholarUids?: string[];
}): void {
  const hasDateRange = options?.startDate != null || options?.endDate != null;
  const hasUids = (options?.scholarUids?.length ?? 0) > 0;
  if (!hasDateRange && !hasUids) {
    throw new Error(
      "At least one of startDate, endDate, or scholarUids (non-empty) is required."
    );
  }
}

// ---------------------------------------------------------------------------
// Supabase fetch
// ---------------------------------------------------------------------------

export async function fetchTrafficLogs(options?: {
  startDate?: Date;
  endDate?: Date;
  scholarUids?: string[];
}): Promise<TrafficRow[]> {
  requireDateOrUidLimit(options);
  const supabase = getSupabaseClient();
  let query = supabase
    .from("traffic")
    .select("id, created_at, uid, traffic_type")
    .order("created_at", { ascending: true });
  if (options?.startDate) query = query.gte("created_at", options.startDate.toISOString());
  if (options?.endDate) query = query.lte("created_at", options.endDate.toISOString());
  if (options?.scholarUids?.length) query = query.in("uid", options.scholarUids);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TrafficRow[];
}

// ---------------------------------------------------------------------------
// Pure traffic session logic
// ---------------------------------------------------------------------------

const ONE_HOUR_MS = 60 * 60 * 1000;

function isTrafficEntry(row: TrafficRow): boolean {
  return (row.traffic_type ?? "").trim().toLowerCase() === "entry";
}

function isTrafficExit(row: TrafficRow): boolean {
  return (row.traffic_type ?? "").trim().toLowerCase() === "exit";
}

export function getTrafficSessions(rows: TrafficRow[]): TrafficSession[] {
  const byUid = new Map<string, TrafficRow[]>();
  for (const row of rows) {
    const uid = row.uid ?? "";
    if (!uid) continue;
    if (!byUid.has(uid)) byUid.set(uid, []);
    byUid.get(uid)!.push(row);
  }

  const result: TrafficSession[] = [];

  for (const [, tickets] of byUid) {
    const sorted = [...tickets].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let i = 0;
    while (i < sorted.length) {
      const row = sorted[i]!;
      if (isTrafficEntry(row)) {
        const entryAt = row.created_at;
        const entryMs = new Date(entryAt).getTime();

        if (i + 1 < sorted.length && isTrafficExit(sorted[i + 1]!)) {
          const exitRow = sorted[i + 1]!;
          const exitAt = exitRow.created_at;
          const exitMs = new Date(exitAt).getTime();
          result.push({ uid: row.uid!, entryAt, exitAt, durationMs: exitMs - entryMs, assumedExit: false });
          i += 2;
          continue;
        }

        const exitAt = new Date(entryMs + ONE_HOUR_MS).toISOString();
        result.push({ uid: row.uid!, entryAt, exitAt, durationMs: ONE_HOUR_MS, assumedExit: true });
        i += 1;
      } else {
        i += 1;
      }
    }
  }

  return result;
}

export function getEntryCountByWeek(rows: TrafficRow[], weekNumber: number): number {
  return rows.filter((row) => {
    if (!isTrafficEntry(row)) return false;
    const week = dateToCampusWeek(new Date(row.created_at));
    return week === weekNumber;
  }).length;
}

/** Same clock time seven Eastern calendar days earlier (DST-safe). */
export function sameTimeLastWeek(now: Date): Date {
  const todayStart = getStartOfDayEastern(now);
  const lastWeekDayStart = addEasternCalendarDays(now, -7);
  return new Date(lastWeekDayStart.getTime() + (now.getTime() - todayStart.getTime()));
}

/**
 * End of the prior-week window to compare against the selected week's traffic so far.
 * Current week: same weekday and time last week. Past week: full prior week.
 */
export function comparableLastWeekThroughDate(
  now: Date,
  selectedWeek: number,
  currentCampusWeek: number | null,
): Date | null {
  if (selectedWeek <= 1) return null;
  const priorRange = campusWeekToDateRange(selectedWeek - 1);
  if (!priorRange) return null;
  const priorEnd = getWeekFetchEnd(priorRange);
  if (selectedWeek === currentCampusWeek) {
    const sameTime = sameTimeLastWeek(now);
    return sameTime.getTime() < priorEnd.getTime() ? sameTime : priorEnd;
  }
  return priorEnd;
}

export function countTrafficEntriesThrough(rows: TrafficRow[], through: Date): number {
  const throughMs = through.getTime();
  return rows.filter((row) => {
    if (!isTrafficEntry(row)) return false;
    return new Date(row.created_at).getTime() <= throughMs;
  }).length;
}

// ---------------------------------------------------------------------------
// Week-level orchestration
// ---------------------------------------------------------------------------

export async function getTrafficSessionsForWeek(weekNumber: number): Promise<TrafficSession[]> {
  const range = campusWeekToDateRange(weekNumber);
  if (!range) return [];
  const endDate = getWeekFetchEnd(range);
  const rows = await fetchTrafficLogs({ startDate: range.startDate, endDate });
  return getTrafficSessions(rows);
}

export async function getTrafficEntryCountForWeek(weekNumber: number): Promise<number> {
  const range = campusWeekToDateRange(weekNumber);
  if (!range) return 0;
  const endDate = getWeekFetchEnd(range);
  const rows = await fetchTrafficLogs({ startDate: range.startDate, endDate });
  return getEntryCountByWeek(rows, weekNumber);
}

/** Entry count for a campus week, clipped at `through` (same-weekday last-week compare). */
export async function getTrafficEntryCountForWeekThrough(
  weekNumber: number,
  through: Date,
): Promise<number> {
  const range = campusWeekToDateRange(weekNumber);
  if (!range) return 0;
  const weekEnd = getWeekFetchEnd(range);
  const endDate = through.getTime() < weekEnd.getTime() ? through : weekEnd;
  if (endDate.getTime() < range.startDate.getTime()) return 0;
  const rows = await fetchTrafficLogs({ startDate: range.startDate, endDate });
  return countTrafficEntriesThrough(rows, endDate);
}

export async function getTrafficEntryCountsForWeeks(
  weekNumbers: number[]
): Promise<WeekEntryCount[]> {
  if (weekNumbers.length === 0) return [];
  const counts = await Promise.all(
    weekNumbers.map((weekNumber) => getTrafficEntryCountForWeek(weekNumber))
  );
  return weekNumbers.map((weekNumber, i) => ({ weekNumber, entryCount: counts[i]! }));
}
