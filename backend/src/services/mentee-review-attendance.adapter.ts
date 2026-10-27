/**
 * @file mentee-review-attendance.adapter.ts
 * @module backend/services
 *
 * Attendance adapter for the mentee review. Reads standing shift assignments
 * and logged intervals for ONE scholar over a whole semester in bounded queries
 * (never per-cell/per-week), then maps them to the evaluator's normalized
 * evidence. Open/unmatched tickets are kept non-terminal: they never become a
 * confirmed no-show.
 *
 * This adapter deliberately does NOT reuse the grace-based compliance flags in
 * session-log.service (task 1.2 decision). It reuses only low-level ticket
 * cleaning and DST-safe timestamp helpers.
 *
 * ## Responsibilities
 * - Expand semester-scoped standing assignments into dated shift occurrences
 * - Map completed sessions into logged intervals
 * - Record open/errored evidence dates as non-terminal
 * - Attach campus-week excuses from scholar_week_excuses
 *
 * ## What does NOT belong here
 * - Weekly classification/totals (mentee-review-evaluator)
 * - Roster/authorization (mentee.service)
 * - HTTP handlers
 */
import { getSupabaseClient } from "../supabase/client.js";
import { fetchScholarWeekExcuses } from "./attendance-week.service.js";
import {
  addEasternCalendarDays,
  getEasternDateParts,
  getEasternDayOfWeek,
  getStartOfDayEastern,
} from "./time.service.js";
import {
  fetchFrontDeskLogs,
  fetchStudySessionLogs,
  getCleanedAndErroredTickets,
  getScholarsWithValidEntryExit,
} from "./session-log.service.js";
import type { ScholarWeekExcuseRow } from "../models/attendance-week.model.js";
import type { ScholarShiftAssignment, SessionLogRow } from "../models/session-log.model.js";
import type {
  LoggedIntervalInput,
  ScheduledShiftInput,
  ShiftSessionKind,
  WeekExcuseInput,
} from "../models/mentee-review.model.js";

/** One campus-week excuse row, keyed for evaluateWeek. */
export interface ExcuseEvidence {
  weekNum: number;
  /** Eastern YYYY-MM-DD Monday — unique across years (unlike weekNum alone). */
  weekStart: string;
  kind: ShiftSessionKind;
  minutes: number;
  description: string | null;
}

export interface AttendanceEvidence {
  shifts: ScheduledShiftInput[];
  logs: LoggedIntervalInput[];
  /** Program-local dates (YYYY-MM-DD) with open or unmatched evidence. */
  nonTerminalDates: string[];
  /** All scholar_week_excuses for this scholar (any campus week). */
  excuses: ExcuseEvidence[];
}

export function mapExcuseRowsToEvidence(rows: ScholarWeekExcuseRow[]): ExcuseEvidence[] {
  const out: ExcuseEvidence[] = [];
  for (const row of rows) {
    if (row.kind !== "front_desk" && row.kind !== "study_session") continue;
    const minutes = row.excuse_min != null && Number.isFinite(row.excuse_min) ? Number(row.excuse_min) : 0;
    out.push({
      weekNum: row.week_num,
      weekStart: String(row.week_start).slice(0, 10),
      kind: row.kind,
      minutes: minutes > 0 ? minutes : 0,
      description: row.description?.trim() ? row.description.trim() : null,
    });
  }
  return out.sort(
    (a, b) =>
      a.weekStart.localeCompare(b.weekStart) || a.kind.localeCompare(b.kind)
  );
}

/** Lookup FD/SS excuses for one campus week from semester-wide evidence. */
export function excusesForWeek(
  excuses: ExcuseEvidence[],
  weekStartYmd: string
): Partial<Record<ShiftSessionKind, WeekExcuseInput>> {
  const result: Partial<Record<ShiftSessionKind, WeekExcuseInput>> = {};
  for (const row of excuses) {
    if (row.weekStart !== weekStartYmd) continue;
    result[row.kind] = { minutes: row.minutes, description: row.description };
  }
  return result;
}

interface UntypedQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  eq: (column: string, value: unknown) => UntypedQuery;
  in: (column: string, values: string[]) => UntypedQuery;
}
interface UntypedClient {
  from: (table: string) => { select: (columns: string) => UntypedQuery };
}

const SHIFT_KINDS: ShiftSessionKind[] = ["front_desk", "study_session"];

function easternDateKey(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shortTime(value: string): string {
  return value.trim().slice(0, 5);
}

/** Expand active assignments into dated occurrences within [semesterStart, semesterEnd]. */
export function expandShiftOccurrences(params: {
  scholarUid: string;
  semesterId: string | null;
  semesterStart: Date | null;
  semesterEnd: Date | null;
  assignments: ScholarShiftAssignment[];
}): ScheduledShiftInput[] {
  const { scholarUid, semesterId, semesterStart, semesterEnd, assignments } = params;
  if (!semesterStart || !semesterEnd) return [];

  const start = getStartOfDayEastern(semesterStart);
  const endMs = getStartOfDayEastern(semesterEnd).getTime();

  const applicable = assignments.filter(
    (a) =>
      a.is_active &&
      a.scholar_id === scholarUid &&
      (semesterId == null || a.semester_id === semesterId) &&
      SHIFT_KINDS.includes(a.session_kind as ShiftSessionKind)
  );

  const shifts: ScheduledShiftInput[] = [];
  for (const assignment of applicable) {
    for (let date = start; date.getTime() <= endMs; date = addEasternCalendarDays(date, 1)) {
      if (getEasternDayOfWeek(date) !== assignment.day_of_week) continue;
      const dateKey = easternDateKey(date);
      shifts.push({
        // Distinct per occurrence so multiple same-kind shifts on one date are preserved.
        sourceId: `${assignment.id ?? `${assignment.session_kind}:${assignment.day_of_week}`}:${dateKey}`,
        kind: assignment.session_kind as ShiftSessionKind,
        date: dateKey,
        startTime: shortTime(assignment.start_time),
        endTime: shortTime(assignment.end_time),
      });
    }
  }
  return shifts;
}

function buildKindEvidence(
  kind: ShiftSessionKind,
  rows: SessionLogRow[],
  scholarUid: string,
  asOf: Date,
  logs: LoggedIntervalInput[],
  nonTerminal: Set<string>
): void {
  const completed = getScholarsWithValidEntryExit(rows).filter((s) => s.scholarId === scholarUid);
  const completedEntryAts = new Set<string>();
  for (const session of completed) {
    completedEntryAts.add(session.entryAt);
    if (new Date(session.exitAt).getTime() > new Date(session.entryAt).getTime()) {
      logs.push({
        sourceId: session.entryTicket.id,
        kind,
        start: new Date(session.entryAt),
        end: new Date(session.exitAt),
      });
    }
  }

  const { byScholarUid } = getCleanedAndErroredTickets(rows);
  const scholarTickets = byScholarUid.get(scholarUid);
  if (!scholarTickets) return;

  for (const processed of scholarTickets.cleaned) {
    if ((processed.ticket.action_type ?? "").trim() !== "Entry") continue;
    if (completedEntryAts.has(processed.ticket.created_at)) continue;
    const start = new Date(processed.ticket.created_at);
    nonTerminal.add(easternDateKey(start));
    // An open entry stays bounded to its own local day so it cannot bleed across weeks.
    const dayEndMs = addEasternCalendarDays(start, 1).getTime() - 1;
    const endMs = Math.min(asOf.getTime(), dayEndMs);
    if (endMs > start.getTime()) {
      logs.push({ sourceId: processed.ticket.id, kind, start, end: new Date(endMs) });
    }
  }

  for (const processed of scholarTickets.errored) {
    nonTerminal.add(easternDateKey(new Date(processed.ticket.created_at)));
  }
}

/** Pure: map already-fetched rows into normalized evidence. */
export function buildAttendanceEvidence(params: {
  scholarUid: string;
  semesterId: string | null;
  semesterStart: Date | null;
  semesterEnd: Date | null;
  assignments: ScholarShiftAssignment[];
  frontDeskRows: SessionLogRow[];
  studyRows: SessionLogRow[];
  asOf: Date;
  excuseRows?: ScholarWeekExcuseRow[];
}): AttendanceEvidence {
  const {
    scholarUid,
    semesterId,
    semesterStart,
    semesterEnd,
    assignments,
    frontDeskRows,
    studyRows,
    asOf,
    excuseRows = [],
  } = params;

  const shifts = expandShiftOccurrences({
    scholarUid,
    semesterId,
    semesterStart,
    semesterEnd,
    assignments,
  });

  const logs: LoggedIntervalInput[] = [];
  const nonTerminal = new Set<string>();
  buildKindEvidence("front_desk", frontDeskRows, scholarUid, asOf, logs, nonTerminal);
  buildKindEvidence("study_session", studyRows, scholarUid, asOf, logs, nonTerminal);

  logs.sort((a, b) => a.start.getTime() - b.start.getTime());
  shifts.sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  );

  return {
    shifts,
    logs,
    nonTerminalDates: [...nonTerminal].sort(),
    excuses: mapExcuseRowsToEvidence(excuseRows),
  };
}

async function fetchAssignmentsForScholar(
  scholarUid: string,
  semesterId: string | null
): Promise<ScholarShiftAssignment[]> {
  // The generated database types predate this live table.
  const supabase = getSupabaseClient() as unknown as UntypedClient;
  let query = supabase
    .from("scholar_shift_assignments")
    .select("id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active")
    .eq("scholar_id", scholarUid)
    .eq("is_active", true);
  if (semesterId != null) query = query.eq("semester_id", semesterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ScholarShiftAssignment[];
}

/** Bounded semester-wide reads for one scholar, mapped to evaluator evidence. */
export async function fetchMenteeAttendanceEvidence(params: {
  scholarUid: string;
  semesterId: string | null;
  semesterStart: Date | null;
  semesterEnd: Date | null;
  asOf: Date;
}): Promise<AttendanceEvidence> {
  const { scholarUid, semesterId, semesterStart, semesterEnd, asOf } = params;

  const assignments = await fetchAssignmentsForScholar(scholarUid, semesterId);

  let frontDeskRows: SessionLogRow[] = [];
  let studyRows: SessionLogRow[] = [];
  let excuseRows: ScholarWeekExcuseRow[] = [];
  if (semesterStart && semesterEnd) {
    const logEnd = new Date(addEasternCalendarDays(semesterEnd, 1).getTime() - 1);
    [frontDeskRows, studyRows, excuseRows] = await Promise.all([
      fetchFrontDeskLogs({ scholarUids: [scholarUid], startDate: semesterStart, endDate: logEnd }),
      fetchStudySessionLogs({ scholarUids: [scholarUid], startDate: semesterStart, endDate: logEnd }),
      fetchScholarWeekExcuses(scholarUid),
    ]);
  }

  return buildAttendanceEvidence({
    scholarUid,
    semesterId,
    semesterStart,
    semesterEnd,
    assignments,
    frontDeskRows,
    studyRows,
    asOf,
    excuseRows,
  });
}
