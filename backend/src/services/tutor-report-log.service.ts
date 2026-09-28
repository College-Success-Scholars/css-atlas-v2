/**
 * @file tutor-report-log.service.ts
 * @module backend/services
 *
 * Tutor session report log service.
 * Queries the tutor_report_logs Supabase table to track whether scholars
 * attended required tutoring sessions each campus week.
 *
 * Week assignment matches the mentee page: session `date` (YYYY-MM-DD),
 * then a parseable `start_time` timestamp. Form `created_at` is not used.
 *
 * Probe rows (`scholar_uid` "test", any case) stay in Supabase and are omitted
 * from every read. Empty sessions are `n/a` (any case) and `111111111` only.
 *
 * ## Responsibilities
 * - Fetch tutor report logs by weekNum, by uid, or by uid+weekNum
 * - Check if a specific scholar attended tutoring for a given week
 * - Drop probe uids and label empty-session uids
 * - Resolve week rows to scholar names for the teams tutoring table
 * - Delete one row with the caller JWT (RLS: `is_team_leader_or_above()`)
 *
 * ## What belongs here
 * - All Supabase queries on tutor_report_logs table
 *
 * ## What does NOT belong here
 * - Session log queries (that's session-log.service.ts)
 * - HTTP request/response logic
 */
import { getSupabaseClient } from "../supabase/client.js";
import {
  addEasternCalendarDays,
  campusWeekToDateRange,
  dateToCampusWeek,
  EASTERN_TIMEZONE,
  getEasternDateParts,
  parseEasternDate,
} from "./time.service.js";
import { fetchScholarNamesByUids } from "./user.service.js";
import type { TutorReportLogRow, TutorReportWeekRow } from "../models/tutor-report-log.model.js";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_SESSION_NAME = "EMPTY SESSION";

/** Form practice rows. They remain in Supabase and are not collected. */
export function isProbeTutorReportUid(uid: string | null | undefined): boolean {
  return (uid ?? "").trim().toLowerCase() === "test";
}

/** No scholar attended. `n/a` is case-insensitive; `111111111` is exact. */
export function isEmptyTutoringSessionUid(uid: string | null | undefined): boolean {
  const trimmed = (uid ?? "").trim();
  return trimmed.toLowerCase() === "n/a" || trimmed === "111111111";
}

export function tutorReportScholarName(
  uid: string | null | undefined,
  nameByUid: ReadonlyMap<string, string>,
): string {
  if (isEmptyTutoringSessionUid(uid)) return EMPTY_SESSION_NAME;
  if (!uid?.trim()) return "";
  return nameByUid.get(uid) ?? uid;
}

function withoutProbeTutorReports(rows: TutorReportLogRow[]): TutorReportLogRow[] {
  return rows.filter((row) => !isProbeTutorReportUid(row.scholar_uid));
}

function easternYmd(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function weekDateBounds(weekNum: number): { startYmd: string; nextYmd: string } | null {
  const range = campusWeekToDateRange(weekNum);
  if (!range) return null;
  return {
    startYmd: easternYmd(range.startDate),
    nextYmd: easternYmd(addEasternCalendarDays(range.endDate, 1)),
  };
}

/**
 * Prefer session `date` (YYYY-MM-DD); fall back to a valid ISO `start_time`.
 * Same rule as frontend `campusWeekForTutoringRow` on the mentee page.
 */
export function campusWeekForTutoringRow(
  row: Pick<TutorReportLogRow, "date" | "start_time">
): number | null {
  const day = row.date?.slice(0, 10);
  if (day && YMD.test(day)) {
    try {
      return dateToCampusWeek(parseEasternDate(day));
    } catch {
      // fall through to start_time
    }
  }
  if (!row.start_time) return null;
  const start = new Date(row.start_time);
  if (Number.isNaN(start.getTime())) return null;
  return dateToCampusWeek(start);
}

export function filterTutorReportsForCampusWeek(
  rows: TutorReportLogRow[],
  weekNum: number
): TutorReportLogRow[] {
  return rows.filter((row) => campusWeekForTutoringRow(row) === weekNum);
}

/** Short weekday for the session calendar day (not form submission time). */
export function tutoringSessionDayOfWeek(
  row: Pick<TutorReportLogRow, "date" | "start_time">
): string {
  const day = row.date?.slice(0, 10);
  if (day && YMD.test(day)) {
    try {
      return parseEasternDate(day).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: EASTERN_TIMEZONE,
      });
    } catch {
      // fall through to start_time
    }
  }
  if (!row.start_time) return "—";
  const start = new Date(row.start_time);
  if (Number.isNaN(start.getTime())) return "—";
  return start.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: EASTERN_TIMEZONE,
  });
}

async function fetchTutorReportsForCampusWeek(
  weekNum: number,
  scholarUid?: string
): Promise<TutorReportLogRow[]> {
  const bounds = weekDateBounds(weekNum);
  if (!bounds) return [];
  const supabase = getSupabaseClient();
  let query = supabase.from("tutor_report_logs").select("*");
  if (scholarUid) {
    query = query.eq("scholar_uid", scholarUid);
  }
  const { data, error } = await query
    .or(`and(date.gte.${bounds.startYmd},date.lt.${bounds.nextYmd}),date.is.null`)
    .order("date", { ascending: true });
  if (error) throw error;
  return withoutProbeTutorReports(
    filterTutorReportsForCampusWeek((data ?? []) as TutorReportLogRow[], weekNum),
  );
}

export async function getTutorReportLogsForWeek(weekNum: number): Promise<TutorReportLogRow[]> {
  return fetchTutorReportsForCampusWeek(weekNum);
}

/** Week rows with roster names and session weekday for the teams table. */
export async function getTutorReportWeekRows(weekNum: number): Promise<TutorReportWeekRow[]> {
  const rows = await fetchTutorReportsForCampusWeek(weekNum);
  const scholarUids = rows
    .map((row) => row.scholar_uid)
    .filter((uid): uid is string => Boolean(uid) && !isEmptyTutoringSessionUid(uid));
  const nameByUid = await fetchScholarNamesByUids(scholarUids);
  return rows.map((row) => ({
    ...row,
    scholar_name: tutorReportScholarName(row.scholar_uid, nameByUid),
    day_of_week: tutoringSessionDayOfWeek(row),
  }));
}

/** Deletes one row under the caller JWT. Returns false when no row was removed. */
export async function deleteTutorReportLog(id: number): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tutor_report_logs")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function getTutorReportLogsByUid(uid: string): Promise<TutorReportLogRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tutor_report_logs")
    .select("*")
    .eq("scholar_uid", uid)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return withoutProbeTutorReports((data ?? []) as TutorReportLogRow[]);
}

export async function getTutorReportLogsByUidAndWeek(
  uid: string,
  weekNum: number
): Promise<TutorReportLogRow[]> {
  return fetchTutorReportsForCampusWeek(weekNum, uid);
}

export async function getTutorReportLogsByUids(uids: string[]): Promise<TutorReportLogRow[]> {
  if (!uids.length) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tutor_report_logs")
    .select("*")
    .in("scholar_uid", uids);
  if (error) throw error;
  return withoutProbeTutorReports((data ?? []) as TutorReportLogRow[]);
}

export async function didScholarAttendTutoring(
  uid: string,
  weekNum: number
): Promise<boolean> {
  if (!uid || isProbeTutorReportUid(uid) || isEmptyTutoringSessionUid(uid)) return false;
  const rows = await fetchTutorReportsForCampusWeek(weekNum, uid);
  return rows.length > 0;
}
