/**
 * @file session-log.service.ts
 * @module backend/services
 *
 * Raw session check-in/out log access service.
 * Queries Supabase for front-desk and study-session log entries, and provides
 * cleaning logic to match check-in/check-out pairs, identify open sessions,
 * and filter completed sessions.
 *
 * ## Responsibilities
 * - Fetch raw front-desk and study-session logs by date range and/or scholar UIDs
 * - Match check-in/out pairs and identify errored/unpaired entries
 * - Return scholars currently in-room (open sessions)
 * - Return completed (properly paired) sessions
 *
 * ## What belongs here
 * - All Supabase queries on session log tables
 * - Check-in/out pairing and cleaning logic
 *
 * ## What does NOT belong here
 * - Weekly minute aggregation (that's weekly-minutes.service / attendance-week.service)
 * - HTTP request/response logic
 */
import { getSupabaseClient } from "../supabase/client.js";
import {
  addEasternCalendarDays,
  getEasternDateParts,
  getEasternDayOfWeek,
  getStartOfDayEastern,
} from "./time.service.js";
import { fetchScholarNamesByUids } from "./user.service.js";
import { easternTimestamp } from "./shift-occurrence.service.js";
import {
  DEFAULT_SESSION_CONFIG,
  SESSION_TYPE_FRONT_DESK,
  SHIFT_GRACE_MINUTES,
} from "../models/session-log.model.js";
import type {
  SessionLogRow,
  SessionLogConfig,
  SessionType,
  ProcessedTicket,
  CleanedAndErroredResult,
  ScholarInRoom,
  ScholarWithCompletedSession,
  TicketErrorType,
  FrontDeskLogRow,
  StudySessionLogRow,
  DoubleEntry,
  ScholarShiftAssignment,
  ScholarShiftCompliance,
  ShiftComplianceByKind,
  ShiftComplianceDateRange,
  ShiftCompliancePerDate,
  ShiftComplianceSession,
  ShiftSessionKind,
} from "../models/session-log.model.js";

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
      "At least one of startDate, endDate, or scholarUids (non-empty) is required to limit the search."
    );
  }
}

// ---------------------------------------------------------------------------
// Row converters
// ---------------------------------------------------------------------------

function toSessionLogRowFrontDesk(row: FrontDeskLogRow): SessionLogRow {
  return {
    id: row.id,
    created_at: row.created_at,
    scholar_uid: row.scholar_uid,
    action_type: row.action_type,
    rep_name: row.rep_name ?? null,
    session_type: row.session_type ?? SESSION_TYPE_FRONT_DESK,
    submitted_by_email: row.submitted_by_email ?? null,
  };
}

function toSessionLogRowStudy(row: StudySessionLogRow): SessionLogRow {
  return {
    id: row.id,
    created_at: row.created_at,
    scholar_uid: row.scholar_uid,
    action_type: row.action_type,
    rep_name: row.rep_name,
    session_type: row.session_type,
    submitted_by_email: row.submitted_by_email,
  };
}

// ---------------------------------------------------------------------------
// Supabase fetch
// ---------------------------------------------------------------------------

export async function fetchFrontDeskLogs(options?: {
  startDate?: Date;
  endDate?: Date;
  scholarUids?: string[];
  sessionType?: SessionType | string;
}): Promise<SessionLogRow[]> {
  requireDateOrUidLimit(options);
  const supabase = getSupabaseClient();
  let query = supabase
    .from("front_desk_logs")
    .select("id, created_at, scholar_uid, action_type")
    .order("created_at", { ascending: true });
  if (options?.startDate) query = query.gte("created_at", options.startDate.toISOString());
  if (options?.endDate) query = query.lte("created_at", options.endDate.toISOString());
  if (options?.scholarUids?.length) query = query.in("scholar_uid", options.scholarUids);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => toSessionLogRowFrontDesk(row as FrontDeskLogRow));
}

export async function fetchStudySessionLogs(options?: {
  startDate?: Date;
  endDate?: Date;
  scholarUids?: string[];
  sessionType?: SessionType | string;
}): Promise<SessionLogRow[]> {
  requireDateOrUidLimit(options);
  const supabase = getSupabaseClient();
  let query = supabase
    .from("study_session_logs")
    .select("id, created_at, rep_name, scholar_uid, action_type, session_type, submitted_by_email")
    .order("created_at", { ascending: true });
  if (options?.startDate) query = query.gte("created_at", options.startDate.toISOString());
  if (options?.endDate) query = query.lte("created_at", options.endDate.toISOString());
  if (options?.scholarUids?.length) query = query.in("scholar_uid", options.scholarUids);
  if (options?.sessionType) query = query.eq("session_type", options.sessionType);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => toSessionLogRowStudy(row as StudySessionLogRow));
}

async function fetchActiveShiftAssignments(
  scholarIds: string[]
): Promise<ScholarShiftAssignment[]> {
  if (scholarIds.length === 0) return [];
  // The generated database types predate this live table.
  const supabase = getSupabaseClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (column: string, values: string[]) => {
          eq: (column: string, value: boolean) => Promise<{
            data: unknown;
            error: unknown;
          }>;
        };
      };
    };
  };
  const { data, error } = await supabase
    .from("scholar_shift_assignments")
    .select("scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active")
    .in("scholar_id", scholarIds)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as ScholarShiftAssignment[];
}

// ---------------------------------------------------------------------------
// Pure ticket processing
// ---------------------------------------------------------------------------

function isEntry(row: SessionLogRow, config: SessionLogConfig): boolean {
  return (row.action_type ?? "").trim() === config.entryAction;
}

function isExit(row: SessionLogRow, config: SessionLogConfig): boolean {
  return (row.action_type ?? "").trim() === config.exitAction;
}

function getEasternDayKey(createdAt: string): number {
  return getStartOfDayEastern(new Date(createdAt)).getTime();
}

function moveLastEntryToErrored(
  tickets: SessionLogRow[],
  lastEntryAt: string,
  config: SessionLogConfig,
  cleaned: ProcessedTicket[],
  errored: ProcessedTicket[]
): void {
  const lastEntryTicket = tickets.find(
    (t) => t.created_at === lastEntryAt && isEntry(t, config)
  );
  if (!lastEntryTicket) return;
  const idx = cleaned.findIndex((p) => p.ticket.id === lastEntryTicket.id);
  if (idx >= 0) {
    cleaned.splice(idx, 1);
    errored.push({ ticket: lastEntryTicket, error: "ENTRY_WITHOUT_SAME_DAY_EXIT" });
  }
}

export interface CleanedAndErroredOptions {
  treatUnclosedEntryAsError?: boolean;
  sessionType?: SessionType | string;
}

function filterBySessionType(
  rows: SessionLogRow[],
  sessionType?: SessionType | string
): SessionLogRow[] {
  if (sessionType == null || sessionType === "") return rows;
  return rows.filter((r) => (r.session_type ?? "").trim() === sessionType);
}

function processScholarTickets(
  tickets: SessionLogRow[],
  config: SessionLogConfig,
  treatUnclosedEntryAsError: boolean
): { cleaned: ProcessedTicket[]; errored: ProcessedTicket[] } {
  const cleaned: ProcessedTicket[] = [];
  const errored: ProcessedTicket[] = [];
  let inRoom = false;
  let lastEntryAt: string | null = null;
  let lastActionWasExit = false;

  for (const ticket of tickets) {
    const isEntryTicket = isEntry(ticket, config);
    const isExitTicket = isExit(ticket, config);

    if (!isEntryTicket && !isExitTicket) {
      cleaned.push({ ticket });
      lastActionWasExit = false;
      continue;
    }

    if (isEntryTicket) {
      lastActionWasExit = false;
      if (inRoom && lastEntryAt) {
        const lastEntryDay = getEasternDayKey(lastEntryAt);
        const newEntryDay = getEasternDayKey(ticket.created_at);
        if (newEntryDay !== lastEntryDay) {
          moveLastEntryToErrored(tickets, lastEntryAt, config, cleaned, errored);
          inRoom = true;
          lastEntryAt = ticket.created_at;
          cleaned.push({ ticket });
        } else {
          errored.push({ ticket, error: "DOUBLE_ENTER" });
        }
      } else if (inRoom) {
        errored.push({ ticket, error: "DOUBLE_ENTER" });
      } else {
        inRoom = true;
        lastEntryAt = ticket.created_at;
        cleaned.push({ ticket });
      }
      continue;
    }

    // isExitTicket
    if (!inRoom) {
      const errorType: TicketErrorType =
        lastActionWasExit ? "DOUBLE_EXIT" : "EXIT_BEFORE_ENTER";
      errored.push({ ticket, error: errorType, pairedEntryAt: lastEntryAt ?? undefined });
      lastActionWasExit = true;
    } else {
      const sameDay = getEasternDayKey(lastEntryAt!) === getEasternDayKey(ticket.created_at);
      if (!sameDay) {
        moveLastEntryToErrored(tickets, lastEntryAt!, config, cleaned, errored);
        errored.push({ ticket, error: "EXIT_WITHOUT_ENTER", pairedEntryAt: lastEntryAt ?? undefined });
      } else {
        cleaned.push({ ticket, pairedEntryAt: lastEntryAt ?? undefined });
      }
      lastActionWasExit = true;
      inRoom = false;
      lastEntryAt = null;
    }
  }

  if (treatUnclosedEntryAsError && inRoom && lastEntryAt) {
    moveLastEntryToErrored(tickets, lastEntryAt, config, cleaned, errored);
  }

  return { cleaned, errored };
}

export function getCleanedAndErroredTickets(
  rows: SessionLogRow[],
  config: SessionLogConfig = DEFAULT_SESSION_CONFIG,
  options: CleanedAndErroredOptions = {}
): CleanedAndErroredResult {
  const { treatUnclosedEntryAsError = false, sessionType } = options;
  const filtered = filterBySessionType(rows, sessionType);
  const byScholarUid = new Map<
    string,
    { cleaned: ProcessedTicket[]; errored: ProcessedTicket[]; scholarName: string | null }
  >();
  const allCleaned: ProcessedTicket[] = [];
  const allErrored: ProcessedTicket[] = [];

  const byUid = new Map<string, SessionLogRow[]>();
  for (const row of filtered) {
    const uid = row.scholar_uid ?? "";
    if (!uid) continue;
    if (!byUid.has(uid)) byUid.set(uid, []);
    byUid.get(uid)!.push(row);
  }

  for (const [uid, tickets] of byUid) {
    const sorted = [...tickets].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const scholarName = sorted[0]?.scholar_name ?? null;
    const { cleaned, errored } = processScholarTickets(sorted, config, treatUnclosedEntryAsError);
    byScholarUid.set(uid, { cleaned, errored, scholarName });
    allCleaned.push(...cleaned);
    allErrored.push(...errored);
  }

  return { byScholarUid, allCleaned, allErrored };
}

// ---------------------------------------------------------------------------
// Scholars in room
// ---------------------------------------------------------------------------

export interface ScholarsInRoomOptions {
  sessionType?: SessionType | string;
  asOf?: Date;
}

export function getScholarsCurrentlyInRoom(
  rows: SessionLogRow[],
  config: SessionLogConfig = DEFAULT_SESSION_CONFIG,
  options: ScholarsInRoomOptions = {}
): ScholarInRoom[] {
  const { sessionType, asOf = new Date() } = options;
  const startOfTodayEastern = getStartOfDayEastern(asOf).getTime();
  const rowsFromToday = rows.filter(
    (r) => new Date(r.created_at).getTime() >= startOfTodayEastern
  );
  const { byScholarUid } = getCleanedAndErroredTickets(rowsFromToday, config, { sessionType });
  const result: ScholarInRoom[] = [];

  for (const [uid, { cleaned, scholarName }] of byScholarUid) {
    const entryTickets = cleaned.filter(
      (p) => (p.ticket.action_type ?? "").trim() === config.entryAction
    );
    const exitTickets = cleaned.filter(
      (p) => (p.ticket.action_type ?? "").trim() === config.exitAction
    );
    if (entryTickets.length === 0) continue;

    const entries = [...entryTickets].sort(
      (a, b) => new Date(a.ticket.created_at).getTime() - new Date(b.ticket.created_at).getTime()
    );
    const exits = [...exitTickets].sort(
      (a, b) => new Date(a.ticket.created_at).getTime() - new Date(b.ticket.created_at).getTime()
    );

    let exitIdx = 0;
    let lastUnmatchedEntry: ProcessedTicket | null = null;

    for (const entry of entries) {
      const entryTime = new Date(entry.ticket.created_at).getTime();
      while (exitIdx < exits.length && new Date(exits[exitIdx]!.ticket.created_at).getTime() <= entryTime) {
        exitIdx++;
      }
      if (exitIdx < exits.length) {
        exitIdx++;
        lastUnmatchedEntry = null;
      } else {
        lastUnmatchedEntry = entry;
      }
    }

    if (lastUnmatchedEntry) {
      const entryAt = lastUnmatchedEntry.ticket.created_at;
      const timeInRoomMs = asOf.getTime() - new Date(entryAt).getTime();
      result.push({
        scholarId: uid,
        scholarName,
        entryTicket: lastUnmatchedEntry.ticket,
        entryAt,
        timeInRoomMs: Math.max(0, timeInRoomMs),
        sessionType: lastUnmatchedEntry.ticket.session_type ?? undefined,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Valid entry-exit pairs
// ---------------------------------------------------------------------------

export function getScholarsWithValidEntryExit(
  rows: SessionLogRow[],
  config: SessionLogConfig = DEFAULT_SESSION_CONFIG,
  options: { sessionType?: SessionType | string } = {}
): ScholarWithCompletedSession[] {
  const { sessionType } = options;
  const { byScholarUid } = getCleanedAndErroredTickets(rows, config, { sessionType });
  const result: ScholarWithCompletedSession[] = [];

  for (const [uid, { cleaned, scholarName }] of byScholarUid) {
    const entryTickets = cleaned
      .filter((p) => (p.ticket.action_type ?? "").trim() === config.entryAction)
      .sort((a, b) => new Date(a.ticket.created_at).getTime() - new Date(b.ticket.created_at).getTime());
    const exitTickets = cleaned
      .filter((p) => (p.ticket.action_type ?? "").trim() === config.exitAction)
      .sort((a, b) => new Date(a.ticket.created_at).getTime() - new Date(b.ticket.created_at).getTime());

    for (const exit of exitTickets) {
      const pairedEntryAt = exit.pairedEntryAt;
      if (!pairedEntryAt) continue;
      const entry = entryTickets.find((e) => e.ticket.created_at === pairedEntryAt);
      if (!entry) continue;
      const entryTime = new Date(pairedEntryAt).getTime();
      const exitTime = new Date(exit.ticket.created_at).getTime();
      result.push({
        scholarId: uid,
        scholarName,
        entryTicket: entry.ticket,
        exitTicket: exit.ticket,
        entryAt: pairedEntryAt,
        exitAt: exit.ticket.created_at,
        durationMs: exitTime - entryTime,
        sessionType: entry.ticket.session_type ?? undefined,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Shift compliance
// ---------------------------------------------------------------------------

const MS_PER_MINUTE = 60 * 1000;

function easternDateKey(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function emptyShiftCompliance(): ShiftComplianceByKind {
  return { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] };
}

function emptyScholarShiftCompliance(): ScholarShiftCompliance {
  return {
    fdCompliance: emptyShiftCompliance(),
    ssCompliance: emptyShiftCompliance(),
  };
}

function complianceForKind(
  compliance: ScholarShiftCompliance,
  kind: ShiftSessionKind
): ShiftComplianceByKind {
  return kind === "front_desk" ? compliance.fdCompliance : compliance.ssCompliance;
}

function normalizeComplianceRange(range: ShiftComplianceDateRange): ShiftComplianceDateRange {
  const startDate = getStartOfDayEastern(range.startDate);
  const endDate = getStartOfDayEastern(range.endDate);
  if (endDate.getTime() < startDate.getTime()) {
    throw new Error("Shift compliance endDate must not precede startDate.");
  }
  return { startDate, endDate };
}

function assignmentKey(scholarId: string, kind: ShiftSessionKind, date: string): string {
  return `${scholarId}\u0000${kind}\u0000${date}`;
}

/**
 * Builds assignment-aware compliance from already-paired sessions. This keeps
 * all classification in memory after the public service performs its batched reads.
 */
export function buildShiftComplianceForScholars(
  scholarIds: string[],
  assignments: ScholarShiftAssignment[],
  frontDeskSessions: ScholarWithCompletedSession[],
  studySessionSessions: ScholarWithCompletedSession[],
  range: ShiftComplianceDateRange
): Map<string, ScholarShiftCompliance> {
  const normalizedRange = normalizeComplianceRange(range);
  const requestedIds = new Set(scholarIds);
  const result = new Map<string, ScholarShiftCompliance>();
  const schedules = new Map<string, ShiftCompliancePerDate>();

  for (const scholarId of requestedIds) result.set(scholarId, emptyScholarShiftCompliance());

  for (const assignment of assignments) {
    if (!assignment.is_active || !requestedIds.has(assignment.scholar_id)) continue;
    for (
      let date = normalizedRange.startDate;
      date.getTime() <= normalizedRange.endDate.getTime();
      date = addEasternCalendarDays(date, 1)
    ) {
      if (getEasternDayOfWeek(date) !== assignment.day_of_week) continue;
      const dateKey = easternDateKey(date);
      const scheduledStart = easternTimestamp(date, assignment.start_time).toISOString();
      const scheduledEnd = easternTimestamp(date, assignment.end_time).toISOString();
      const perDate: ShiftCompliancePerDate = {
        date: dateKey,
        scheduledStart,
        scheduledEnd,
        insideMinutes: 0,
        outsideMinutes: 0,
        noShow: true,
        unscheduled: false,
        sessions: [],
      };
      schedules.set(assignmentKey(assignment.scholar_id, assignment.session_kind, dateKey), perDate);
      complianceForKind(result.get(assignment.scholar_id)!, assignment.session_kind).dates.push(perDate);
    }
  }

  const classify = (sessions: ScholarWithCompletedSession[], kind: ShiftSessionKind) => {
    for (const session of sessions) {
      if (!requestedIds.has(session.scholarId)) continue;
      const entryAt = new Date(session.entryAt);
      const exitAt = new Date(session.exitAt);
      const durationMs = exitAt.getTime() - entryAt.getTime();
      if (durationMs <= 0) continue;

      const date = easternDateKey(entryAt);
      const key = assignmentKey(session.scholarId, kind, date);
      let perDate = schedules.get(key);
      if (!perDate) {
        perDate = {
          date,
          scheduledStart: null,
          scheduledEnd: null,
          insideMinutes: 0,
          outsideMinutes: 0,
          noShow: false,
          unscheduled: true,
          sessions: [],
        };
        complianceForKind(result.get(session.scholarId)!, kind).dates.push(perDate);
      }

      const totalMinutes = Math.round(durationMs / MS_PER_MINUTE);
      let insideMinutes = 0;
      if (perDate.scheduledStart && perDate.scheduledEnd) {
        const graceStart = new Date(perDate.scheduledStart).getTime() - SHIFT_GRACE_MINUTES * MS_PER_MINUTE;
        const graceEnd = new Date(perDate.scheduledEnd).getTime() + SHIFT_GRACE_MINUTES * MS_PER_MINUTE;
        const overlapMs = Math.max(
          0,
          Math.min(exitAt.getTime(), graceEnd) - Math.max(entryAt.getTime(), graceStart)
        );
        insideMinutes = Math.round(overlapMs / MS_PER_MINUTE);
        perDate.noShow = false;
      }
      const outsideMinutes = totalMinutes - insideMinutes;
      const sessionResult: ShiftComplianceSession = {
        entryAt: session.entryAt,
        exitAt: session.exitAt,
        insideMinutes,
        outsideMinutes,
      };
      perDate.insideMinutes += insideMinutes;
      perDate.outsideMinutes += outsideMinutes;
      perDate.sessions.push(sessionResult);
    }
  };

  classify(frontDeskSessions, "front_desk");
  classify(studySessionSessions, "study_session");

  for (const compliance of result.values()) {
    for (const kind of [compliance.fdCompliance, compliance.ssCompliance]) {
      kind.dates.sort((a, b) => a.date.localeCompare(b.date));
      kind.insideMinutes = kind.dates.reduce((total, date) => total + date.insideMinutes, 0);
      kind.outsideMinutes = kind.dates.reduce((total, date) => total + date.outsideMinutes, 0);
      kind.noShowCount = kind.dates.filter((date) => date.noShow).length;
    }
  }
  return result;
}

export async function getShiftComplianceForScholars(
  scholarIds: string[],
  range: ShiftComplianceDateRange
): Promise<Map<string, ScholarShiftCompliance>> {
  const uniqueIds = [...new Set(scholarIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const normalizedRange = normalizeComplianceRange(range);
  const endExclusive = addEasternCalendarDays(normalizedRange.endDate, 1);
  const logEndDate = new Date(endExclusive.getTime() - 1);
  const [assignments, frontDeskRows, studySessionRows] = await Promise.all([
    fetchActiveShiftAssignments(uniqueIds),
    fetchFrontDeskLogs({
      scholarUids: uniqueIds,
      startDate: normalizedRange.startDate,
      endDate: logEndDate,
    }),
    fetchStudySessionLogs({
      scholarUids: uniqueIds,
      startDate: normalizedRange.startDate,
      endDate: logEndDate,
    }),
  ]);
  return buildShiftComplianceForScholars(
    uniqueIds,
    assignments,
    getScholarsWithValidEntryExit(frontDeskRows),
    getScholarsWithValidEntryExit(studySessionRows),
    normalizedRange
  );
}

// ---------------------------------------------------------------------------
// Enrichment helpers
// ---------------------------------------------------------------------------

export function enrichCleanedAndErroredWithNames(
  result: CleanedAndErroredResult,
  nameMap: Map<string, string>
): CleanedAndErroredResult {
  const enrichedByScholarUid = new Map(result.byScholarUid);
  for (const [uid, data] of enrichedByScholarUid) {
    enrichedByScholarUid.set(uid, { ...data, scholarName: nameMap.get(uid) ?? null });
  }
  return { ...result, byScholarUid: enrichedByScholarUid };
}

export function enrichWithScholarNames<
  T extends { scholarId: string; scholarName?: string | null },
>(items: T[], nameMap: Map<string, string>): T[] {
  if (items.length === 0) return items;
  return items.map((r) => ({ ...r, scholarName: nameMap.get(r.scholarId) ?? null }));
}

// ---------------------------------------------------------------------------
// Double entry detection
// ---------------------------------------------------------------------------

function computeOverlapMs(
  start1: number, end1: number, start2: number, end2: number
): { overlapMs: number; overlapStart: number; overlapEnd: number } {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  return { overlapMs: Math.max(0, overlapEnd - overlapStart), overlapStart, overlapEnd };
}

export function getDoubleEntries(
  completedStudy: ScholarWithCompletedSession[],
  completedFrontDesk: ScholarWithCompletedSession[],
  options: { toleranceMinutes?: number } = {}
): DoubleEntry[] {
  const toleranceMs = (options.toleranceMinutes ?? 5) * MS_PER_MINUTE;

  const studyByUid = new Map<string, ScholarWithCompletedSession[]>();
  for (const s of completedStudy) {
    const list = studyByUid.get(s.scholarId) ?? [];
    list.push(s);
    studyByUid.set(s.scholarId, list);
  }

  const fdByUid = new Map<string, ScholarWithCompletedSession[]>();
  for (const f of completedFrontDesk) {
    const list = fdByUid.get(f.scholarId) ?? [];
    list.push(f);
    fdByUid.set(f.scholarId, list);
  }

  const result: DoubleEntry[] = [];
  const scholarUids = new Set([...studyByUid.keys(), ...fdByUid.keys()]);

  for (const uid of scholarUids) {
    const studySessions = studyByUid.get(uid) ?? [];
    const fdSessions = fdByUid.get(uid) ?? [];
    if (studySessions.length === 0 || fdSessions.length === 0) continue;

    const scholarName = studySessions[0]?.scholarName ?? fdSessions[0]?.scholarName ?? null;

    for (const study of studySessions) {
      const studyStart = new Date(study.entryAt).getTime();
      const studyEnd = new Date(study.exitAt).getTime();
      for (const fd of fdSessions) {
        const fdStart = new Date(fd.entryAt).getTime();
        const fdEnd = new Date(fd.exitAt).getTime();
        const { overlapMs: duration, overlapStart, overlapEnd } = computeOverlapMs(studyStart, studyEnd, fdStart, fdEnd);
        if (duration >= toleranceMs) {
          result.push({
            scholarId: uid,
            scholarName,
            studySession: study,
            frontDeskSession: fd,
            overlapMs: duration,
            overlapStart: new Date(overlapStart).toISOString(),
            overlapEnd: new Date(overlapEnd).toISOString(),
          });
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Orchestrated fetch + process (front desk)
// ---------------------------------------------------------------------------

export async function getFrontDeskCleanedAndErrored(
  options?: {
    startDate?: Date;
    endDate?: Date;
    scholarUids?: string[];
    sessionType?: SessionType | string;
  } & CleanedAndErroredOptions
) {
  const rows = await fetchFrontDeskLogs(options);
  const result = getCleanedAndErroredTickets(rows, undefined, {
    treatUnclosedEntryAsError: options?.treatUnclosedEntryAsError,
    sessionType: options?.sessionType ?? SESSION_TYPE_FRONT_DESK,
  });
  const uids = Array.from(result.byScholarUid.keys());
  const nameMap = await fetchScholarNamesByUids(uids);
  return enrichCleanedAndErroredWithNames(result, nameMap);
}

export async function getFrontDeskScholarsInRoom(
  options?: ScholarsInRoomOptions & { startDate?: Date; endDate?: Date; scholarUids?: string[] }
) {
  const rows = await fetchFrontDeskLogs(options);
  const result = getScholarsCurrentlyInRoom(rows, undefined, {
    ...options,
    sessionType: options?.sessionType ?? SESSION_TYPE_FRONT_DESK,
  });
  const nameMap = await fetchScholarNamesByUids(result.map((r) => r.scholarId));
  return enrichWithScholarNames(result, nameMap);
}

export async function getFrontDeskCompletedSessions(options?: {
  startDate?: Date;
  endDate?: Date;
  scholarUids?: string[];
  sessionType?: SessionType | string;
}) {
  const rows = await fetchFrontDeskLogs(options);
  const result = getScholarsWithValidEntryExit(rows, undefined, {
    sessionType: options?.sessionType ?? SESSION_TYPE_FRONT_DESK,
  });
  const nameMap = await fetchScholarNamesByUids(result.map((r) => r.scholarId));
  return enrichWithScholarNames(result, nameMap);
}

// ---------------------------------------------------------------------------
// Orchestrated fetch + process (study session)
// ---------------------------------------------------------------------------

export async function getStudySessionCleanedAndErrored(
  options?: {
    startDate?: Date;
    endDate?: Date;
    scholarUids?: string[];
    sessionType?: string;
  } & CleanedAndErroredOptions
) {
  const rows = await fetchStudySessionLogs(options);
  const result = getCleanedAndErroredTickets(rows, undefined, {
    treatUnclosedEntryAsError: options?.treatUnclosedEntryAsError,
    sessionType: options?.sessionType,
  });
  const uids = Array.from(result.byScholarUid.keys());
  const nameMap = await fetchScholarNamesByUids(uids);
  return enrichCleanedAndErroredWithNames(result, nameMap);
}

export async function getStudySessionScholarsInRoom(
  options?: ScholarsInRoomOptions & { startDate?: Date; endDate?: Date; scholarUids?: string[] }
) {
  const rows = await fetchStudySessionLogs(options);
  const result = getScholarsCurrentlyInRoom(rows, undefined, options ?? {});
  const nameMap = await fetchScholarNamesByUids(result.map((r) => r.scholarId));
  return enrichWithScholarNames(result, nameMap);
}

export async function getStudySessionCompletedSessions(options?: {
  startDate?: Date;
  endDate?: Date;
  scholarUids?: string[];
  sessionType?: string;
}) {
  const rows = await fetchStudySessionLogs(options);
  const result = getScholarsWithValidEntryExit(rows, undefined, options ?? {});
  const nameMap = await fetchScholarNamesByUids(result.map((r) => r.scholarId));
  return enrichWithScholarNames(result, nameMap);
}
