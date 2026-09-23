/**
 * @file attendance-week.service.ts
 * @module backend/services
 *
 * Campus-week attendance board: minutes from cleaned tickets (on read) +
 * excuses from scholar_week_excuses. Does not read or write frozen *_records_legacy.
 *
 * ## Responsibilities
 * - Build week boards for front_desk / study_session
 * - Upsert excuse minutes + description
 * - Completion helpers (effective = logged + excuse_min)
 *
 * ## What belongs here
 * - Ticket → campus-week minute aggregation (via weekly-minutes helpers)
 * - scholar_week_excuses queries keyed by week_start
 * - Shared getCampusWeekAttendance for Memo and teams boards
 * - Mentee UID slice via getWeekAttendanceForUids
 *
 * ## What does NOT belong here
 * - HTTP request/response logic
 * - Frozen *_records_legacy tables
 */
import { getSupabaseClient } from "../supabase/client.js";
import {
  campusWeekToDateRange,
  getEasternDateParts,
  getWeekFetchEnd,
} from "./time.service.js";
import {
  getFrontDeskCompletedSessions,
  getStudySessionCompletedSessions,
} from "./session-log.service.js";
import { computeWeeklyMinutesByUid } from "./weekly-minutes.service.js";
import { fetchAllUsersForMemo, isEligibleScholar } from "./user.service.js";
import { EMPTY_WEEKLY_MINUTES } from "../models/weekly-minutes.model.js";
import type { WeeklyMinutesByDay } from "../models/weekly-minutes.model.js";
import type {
  AttendanceForUids,
  AttendanceKind,
  AttendanceWeekBoard,
  AttendanceWeekBoardRow,
  CampusWeekAttendance,
  CampusWeekAttendanceTotals,
  ScholarWeekExcuseRow,
  UpsertExcusePayload,
} from "../models/attendance-week.model.js";

export function loggedMinutes(m: WeeklyMinutesByDay): number {
  return m.mon_min + m.tues_min + m.wed_min + m.thurs_min + m.fri_min;
}

export function effectiveMinutes(logged: number, excuseMin: number): number {
  return logged + excuseMin;
}

export function completionPct(
  effective: number,
  required: number | null
): number | null {
  if (required == null || required <= 0) return null;
  return Math.round((effective / required) * 100);
}

function isAttendanceKind(value: string): value is AttendanceKind {
  return value === "front_desk" || value === "study_session";
}

export function parseAttendanceKind(
  value: string | undefined | null
): AttendanceKind | null {
  if (!value) return null;
  return isAttendanceKind(value) ? value : null;
}

/** Eastern YYYY-MM-DD of campusWeekToDateRange(weekNum).startDate. */
export function campusWeekStartDate(weekNum: number): string | null {
  const range = campusWeekToDateRange(weekNum);
  if (!range) return null;
  const { year, month, day } = getEasternDateParts(range.startDate);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mapExcuseRow(row: {
  scholar_uid: string;
  week_start: string;
  week_num: number;
  kind: string;
  excuse_min: number | null;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}): ScholarWeekExcuseRow | null {
  if (!isAttendanceKind(row.kind)) return null;
  return {
    scholar_uid: String(row.scholar_uid),
    week_start: String(row.week_start),
    week_num: Number(row.week_num),
    kind: row.kind,
    excuse_min: row.excuse_min != null ? Number(row.excuse_min) : null,
    description: row.description ?? null,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at,
  };
}

async function fetchExcusesForWeekStart(
  weekStart: string,
  scholarUids?: string[]
): Promise<{
  front_desk: Map<string, ScholarWeekExcuseRow>;
  study_session: Map<string, ScholarWeekExcuseRow>;
}> {
  const empty = {
    front_desk: new Map<string, ScholarWeekExcuseRow>(),
    study_session: new Map<string, ScholarWeekExcuseRow>(),
  };
  if (scholarUids && scholarUids.length === 0) return empty;

  const supabase = getSupabaseClient();
  let query = supabase
    .from("scholar_week_excuses")
    .select("*")
    .eq("week_start", weekStart);
  if (scholarUids?.length) query = query.in("scholar_uid", scholarUids);
  const { data, error } = await query;
  if (error) throw error;
  const front_desk = new Map<string, ScholarWeekExcuseRow>();
  const study_session = new Map<string, ScholarWeekExcuseRow>();
  for (const row of data ?? []) {
    const mapped = mapExcuseRow(row);
    if (!mapped) continue;
    if (mapped.kind === "front_desk") front_desk.set(mapped.scholar_uid, mapped);
    else study_session.set(mapped.scholar_uid, mapped);
  }
  return { front_desk, study_session };
}

const ZERO_TOTALS: CampusWeekAttendanceTotals = {
  minutes: EMPTY_WEEKLY_MINUTES,
  loggedMin: 0,
  excuseMin: 0,
  description: null,
};

function totalsForUid(
  uid: string,
  minutesByUid: Map<string, WeeklyMinutesByDay>,
  excuses: Map<string, ScholarWeekExcuseRow>
): CampusWeekAttendanceTotals {
  const minutes = minutesByUid.get(uid) ?? EMPTY_WEEKLY_MINUTES;
  const excuse = excuses.get(uid);
  const excuseMin = excuse?.excuse_min != null ? Number(excuse.excuse_min) : 0;
  return {
    minutes,
    loggedMin: loggedMinutes(minutes),
    excuseMin,
    description: excuse?.description ?? null,
  };
}

function buildTotalsMap(
  minutesByUid: Map<string, WeeklyMinutesByDay>,
  excuses: Map<string, ScholarWeekExcuseRow>
): Map<string, CampusWeekAttendanceTotals> {
  const uids = new Set([...minutesByUid.keys(), ...excuses.keys()]);
  const map = new Map<string, CampusWeekAttendanceTotals>();
  for (const uid of uids) {
    map.set(uid, totalsForUid(uid, minutesByUid, excuses));
  }
  return map;
}

function uniqueUids(uids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of uids) {
    const uid = String(raw ?? "").trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    out.push(uid);
  }
  return out;
}

function rowFromTotals(
  uid: string,
  weekNum: number,
  kind: AttendanceKind,
  totals: CampusWeekAttendanceTotals
): AttendanceWeekBoardRow {
  return {
    scholar_uid: uid,
    scholar_name: null,
    week_num: weekNum,
    kind,
    mon_min: totals.minutes.mon_min,
    tues_min: totals.minutes.tues_min,
    wed_min: totals.minutes.wed_min,
    thurs_min: totals.minutes.thurs_min,
    fri_min: totals.minutes.fri_min,
    logged_min: totals.loggedMin,
    excuse_min: totals.excuseMin,
    description: totals.description,
    required_min: null,
    effective_min: effectiveMinutes(totals.loggedMin, totals.excuseMin),
    completion_pct: null,
  };
}

/** One FD and one SS row per UID, zeros when there are no tickets or excuse. */
export function attendanceRowsForUids(
  weekNum: number,
  uids: string[],
  fdByUid: Map<string, CampusWeekAttendanceTotals>,
  ssByUid: Map<string, CampusWeekAttendanceTotals>
): AttendanceWeekBoardRow[] {
  const rows: AttendanceWeekBoardRow[] = [];
  for (const uid of uniqueUids(uids)) {
    rows.push(
      rowFromTotals(uid, weekNum, "front_desk", fdByUid.get(uid) ?? ZERO_TOTALS)
    );
    rows.push(
      rowFromTotals(
        uid,
        weekNum,
        "study_session",
        ssByUid.get(uid) ?? ZERO_TOTALS
      )
    );
  }
  return rows;
}

/**
 * Minutes from cleaned tickets + excuses for both duty kinds, one campus week.
 * Callers look up missing UIDs as zeros (empty tickets / no excuse).
 */
export async function getCampusWeekAttendance(
  weekNum: number
): Promise<CampusWeekAttendance> {
  const range = campusWeekToDateRange(weekNum);
  if (!range) throw new Error(`Invalid week number: ${weekNum}`);
  const weekStart = campusWeekStartDate(weekNum);
  if (!weekStart) throw new Error(`Invalid week number: ${weekNum}`);
  const fetchEnd = getWeekFetchEnd(range);
  const weekRange = { startDate: range.startDate, endDate: range.endDate };

  const [users, fdSessions, ssSessions, excuses] = await Promise.all([
    fetchAllUsersForMemo(),
    getFrontDeskCompletedSessions({
      startDate: range.startDate,
      endDate: fetchEnd,
    }),
    getStudySessionCompletedSessions({
      startDate: range.startDate,
      endDate: fetchEnd,
    }),
    fetchExcusesForWeekStart(weekStart),
  ]);

  const fdMinutes = computeWeeklyMinutesByUid(fdSessions, weekRange);
  const ssMinutes = computeWeeklyMinutesByUid(ssSessions, weekRange);

  return {
    week_num: weekNum,
    week_start: weekStart,
    users,
    fdByUid: buildTotalsMap(fdMinutes, excuses.front_desk),
    ssByUid: buildTotalsMap(ssMinutes, excuses.study_session),
    fdSessions,
    ssSessions,
  };
}

/**
 * Campus-week FD/SS minutes + excuses for specific scholars (mentees page).
 * Same ticket + scholar_week_excuses math as Memo / week boards.
 */
export async function getWeekAttendanceForUids(
  weekNum: number,
  uids: string[]
): Promise<AttendanceForUids> {
  const range = campusWeekToDateRange(weekNum);
  if (!range) throw new Error(`Invalid week number: ${weekNum}`);
  const weekStart = campusWeekStartDate(weekNum);
  if (!weekStart) throw new Error(`Invalid week number: ${weekNum}`);
  const scholarUids = uniqueUids(uids);
  if (scholarUids.length === 0) {
    return { week_num: weekNum, week_start: weekStart, rows: [] };
  }

  const fetchEnd = getWeekFetchEnd(range);
  const weekRange = { startDate: range.startDate, endDate: range.endDate };
  const [fdSessions, ssSessions, excuses] = await Promise.all([
    getFrontDeskCompletedSessions({
      startDate: range.startDate,
      endDate: fetchEnd,
      scholarUids,
    }),
    getStudySessionCompletedSessions({
      startDate: range.startDate,
      endDate: fetchEnd,
      scholarUids,
    }),
    fetchExcusesForWeekStart(weekStart, scholarUids),
  ]);

  const fdByUid = buildTotalsMap(
    computeWeeklyMinutesByUid(fdSessions, weekRange),
    excuses.front_desk
  );
  const ssByUid = buildTotalsMap(
    computeWeeklyMinutesByUid(ssSessions, weekRange),
    excuses.study_session
  );

  return {
    week_num: weekNum,
    week_start: weekStart,
    rows: attendanceRowsForUids(weekNum, scholarUids, fdByUid, ssByUid),
  };
}

/**
 * Eligible scholars for a duty kind: enrolled freshman/sophomore scholars
 * with that required > 0.
 */
function filterEligibleForKind(
  users: Awaited<ReturnType<typeof fetchAllUsersForMemo>>,
  kind: AttendanceKind
): {
  uid: string;
  name: string | null;
  required: number | null;
}[] {
  const out: { uid: string; name: string | null; required: number | null }[] = [];
  for (const u of users) {
    if (!isEligibleScholar(u)) continue;
    const required =
      kind === "front_desk" ? u.fd_required : u.ss_required;
    const reqNum = required != null ? Number(required) : 0;
    if (reqNum <= 0) continue;
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    out.push({
      uid: u.uid,
      name: name || null,
      required: reqNum,
    });
  }
  return out;
}

export async function getWeekBoard(
  weekNum: number,
  kind: AttendanceKind
): Promise<AttendanceWeekBoard> {
  const attendance = await getCampusWeekAttendance(weekNum);
  const eligible = filterEligibleForKind(attendance.users, kind);
  const byUid = kind === "front_desk" ? attendance.fdByUid : attendance.ssByUid;

  const rows: AttendanceWeekBoardRow[] = eligible.map((s) => {
    const totals = byUid.get(s.uid) ?? ZERO_TOTALS;
    const effective = effectiveMinutes(totals.loggedMin, totals.excuseMin);
    const pct = completionPct(effective, s.required);
    return {
      scholar_uid: s.uid,
      scholar_name: s.name,
      week_num: weekNum,
      kind,
      mon_min: totals.minutes.mon_min,
      tues_min: totals.minutes.tues_min,
      wed_min: totals.minutes.wed_min,
      thurs_min: totals.minutes.thurs_min,
      fri_min: totals.minutes.fri_min,
      logged_min: totals.loggedMin,
      excuse_min: totals.excuseMin,
      description: totals.description,
      required_min: s.required,
      effective_min: effective,
      completion_pct: pct,
    };
  });

  rows.sort((a, b) =>
    (a.scholar_name ?? a.scholar_uid).localeCompare(
      b.scholar_name ?? b.scholar_uid,
      undefined,
      { sensitivity: "base" }
    )
  );

  let atOrAbove90 = 0;
  let below75 = 0;
  for (const r of rows) {
    if (r.completion_pct == null) continue;
    if (r.completion_pct >= 90) atOrAbove90 += 1;
    if (r.completion_pct < 75) below75 += 1;
  }

  return {
    week_num: weekNum,
    week_start: attendance.week_start,
    kind,
    rows,
    summary: {
      scholar_count: rows.length,
      at_or_above_90: atOrAbove90,
      below_75: below75,
    },
  };
}

export async function upsertExcuse(
  payload: UpsertExcusePayload
): Promise<ScholarWeekExcuseRow> {
  const {
    scholar_uid,
    week_num,
    kind,
    excuse_min,
    description,
    updated_by,
  } = payload;

  if (!scholar_uid) throw new Error("Missing scholar_uid");
  if (!week_num || week_num < 1) throw new Error("Invalid week_num");
  if (!isAttendanceKind(kind)) throw new Error("Invalid kind");
  const weekStart = campusWeekStartDate(week_num);
  if (!weekStart) throw new Error("Invalid week_num");
  if (excuse_min != null && (Number.isNaN(excuse_min) || excuse_min < 0)) {
    throw new Error("excuse_min must be null or a non-negative number");
  }
  if (
    excuse_min != null &&
    excuse_min > 0 &&
    !(description && description.trim())
  ) {
    throw new Error("description is required when excuse_min > 0");
  }

  const supabase = getSupabaseClient();
  const row = {
    scholar_uid: String(scholar_uid),
    week_start: weekStart,
    week_num,
    kind,
    excuse_min: excuse_min ?? null,
    description: description?.trim() ? description.trim() : null,
    updated_by: updated_by ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("scholar_week_excuses")
    .upsert(row, { onConflict: "scholar_uid,week_start,kind" })
    .select()
    .single();
  if (error) throw error;

  const mapped = mapExcuseRow(data);
  if (!mapped) throw new Error("Invalid kind");
  return mapped;
}
