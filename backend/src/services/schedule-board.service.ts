/**
 * @file schedule-board.service.ts
 * @module backend/services
 *
 * Team-leader schedule management: read every roster scholar's recurring FD/SS shifts for a
 * week, and replace one scholar's schedule from an Eastern Monday onward.
 *
 * ## Responsibilities
 * - Read a consistent board snapshot (rows + revisions) through get_schedule_snapshot
 * - Write only through replace_scholar_schedule_from_week (the sole writer)
 * - Map database error codes to ScheduleError statuses
 *
 * ## What does NOT belong here
 * - Direct inserts, updates, or deletes on scholar_shift_assignments
 * - Row validity rules (shift-assignment.service owns those for readers)
 */
import { scholarYearLabel } from "../../../shared/dist/time.js";
import type {
  ScheduleShiftDto, ScheduleSemesterDto, ScheduleBoardScholarDto,
  ScheduleBoardResponse, StandingShiftInput, ScholarScheduleResponse,
} from "../../../shared/dist/schedules.js";
export type {
  ScheduleShiftDto, ScheduleSemesterDto, ScheduleBoardScholarDto,
  ScheduleBoardResponse, StandingShiftInput, ScholarScheduleResponse,
} from "../../../shared/dist/schedules.js";
import type { MemoUserRow } from "../models/user.model.js";
import { getSupabaseClient } from "../supabase/client.js";
import { easternDateKey } from "./shift-assignment.service.js";
import { mondayOfWeekEastern } from "./time.service.js";
import { fetchAllUsersForMemo, isEligibleScholar } from "./user.service.js";

export type ReplaceScheduleInput = {
  scholarUid: string;
  semesterId: number;
  effectiveWeekStart: string;
  expectedRevision: number;
  shifts: StandingShiftInput[];
};

type SnapshotScholar = { uid: string; revision: number; shifts: ScheduleShiftDto[] };
type Snapshot = {
  semester: ScheduleSemesterDto | null;
  currentWeekStart: string;
  weekStart: string;
  scholars: SnapshotScholar[];
};

export class ScheduleError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly currentRevision?: number,
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function currentEasternMonday(now: Date = new Date()): string {
  return easternDateKey(mondayOfWeekEastern(now));
}

type RpcError = { code?: string; message?: string; details?: string | null };

function toScheduleError(error: unknown): ScheduleError {
  const e = (error ?? {}) as RpcError;
  const message = e.message?.trim() || "Schedule request failed";
  switch (e.code) {
    case "42501":
      return new ScheduleError(403, "Forbidden: Team leader or above required", e.code);
    case "CS409": {
      const current = Number(e.details);
      return new ScheduleError(
        409,
        "This schedule changed since you loaded it. Reload to see the latest, then reapply your edit.",
        e.code,
        Number.isFinite(current) ? current : undefined,
      );
    }
    case "CS404":
      return new ScheduleError(404, message, e.code);
    case "CS422":
      return new ScheduleError(422, message, e.code);
    case "22023":
      return new ScheduleError(400, message, e.code);
    default:
      return new ScheduleError(500, message, e.code);
  }
}

async function callSnapshot(weekStart: string, scholarUid?: string): Promise<Snapshot> {
  const { data, error } = await getSupabaseClient().rpc("get_schedule_snapshot", {
    p_week_start: weekStart,
    ...(scholarUid ? { p_scholar_id: scholarUid } : {}),
  });
  if (error) throw toScheduleError(error);
  return data as unknown as Snapshot;
}

function displayName(user: MemoUserRow): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.uid;
}

function toBoardScholar(user: MemoUserRow, snap: SnapshotScholar | undefined): ScheduleBoardScholarDto {
  return {
    uid: user.uid,
    name: displayName(user),
    cohort: user.cohort,
    classYearLabel: scholarYearLabel(user.cohort),
    programRole: user.program_role,
    status: user.status,
    fd_required: user.fd_required != null ? Number(user.fd_required) : 0,
    ss_required: user.ss_required != null ? Number(user.ss_required) : 0,
    revision: snap?.revision ?? 0,
    shifts: snap?.shifts ?? [],
  };
}

function sortScholars(rows: ScheduleBoardScholarDto[]): ScheduleBoardScholarDto[] {
  return rows.sort((a, b) => {
    const cohortA = a.cohort ?? 0;
    const cohortB = b.cohort ?? 0;
    if (cohortA !== cohortB) return cohortB - cohortA;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/**
 * Every roster scholar with their shifts in effect during `weekStart`'s week.
 * `eligibleOnly` narrows to hour-eligible scholars (the dev board); the team-leader board
 * has no cohort, enrollment, mentor, or hours prerequisite.
 */
export async function getScheduleBoard(
  options: { weekStart?: string; eligibleOnly?: boolean } = {},
): Promise<ScheduleBoardResponse> {
  const weekStart = options.weekStart ?? currentEasternMonday();
  const [snapshot, users] = await Promise.all([callSnapshot(weekStart), fetchAllUsersForMemo()]);
  const byUid = new Map(snapshot.scholars.map((row) => [row.uid, row]));
  const scholars = users.filter((user) => user.program_role?.trim().toLowerCase() === "scholar");
  const roster = options.eligibleOnly ? scholars.filter(isEligibleScholar) : scholars;
  return {
    semester: snapshot.semester,
    currentWeekStart: snapshot.currentWeekStart,
    weekStart: snapshot.weekStart,
    scholars: sortScholars(roster.map((user) => toBoardScholar(user, byUid.get(user.uid)))),
  };
}

const UNKNOWN_USER = (uid: string): MemoUserRow => ({
  uid,
  first_name: null,
  last_name: null,
  cohort: null,
  program_role: null,
  app_role: null,
  fd_required: null,
  ss_required: null,
  status: null,
});

async function toScholarResponse(snapshot: Snapshot, scholarUid: string): Promise<ScholarScheduleResponse> {
  const { scholars, ...rest } = snapshot;
  const row = scholars.find((candidate) => candidate.uid === scholarUid);
  if (!row) throw new ScheduleError(404, "Scholar is not on the roster", "CS404");
  const users = await fetchAllUsersForMemo();
  const user = users.find((candidate) => candidate.uid === scholarUid) ?? UNKNOWN_USER(scholarUid);
  return { ...rest, scholar: toBoardScholar(user, row) };
}

export async function getScholarSchedule(
  scholarUid: string,
  weekStart: string = currentEasternMonday(),
): Promise<ScholarScheduleResponse> {
  return toScholarResponse(await callSnapshot(weekStart, scholarUid), scholarUid);
}

/**
 * Replaces the scholar's whole planned schedule from `effectiveWeekStart` through the end of
 * the semester. Earlier weeks keep their history. `expectedRevision` must match the value
 * returned by the last read, otherwise the database rejects the write as stale.
 */
export async function replaceScholarScheduleFromWeek(
  input: ReplaceScheduleInput,
): Promise<ScholarScheduleResponse> {
  const { data, error } = await getSupabaseClient().rpc("replace_scholar_schedule_from_week", {
    p_scholar_id: input.scholarUid,
    p_semester_id: input.semesterId,
    p_effective_week_start: input.effectiveWeekStart,
    p_expected_revision: input.expectedRevision,
    p_shifts: input.shifts,
  });
  if (error) throw toScheduleError(error);
  return toScholarResponse(data as unknown as Snapshot, input.scholarUid);
}
