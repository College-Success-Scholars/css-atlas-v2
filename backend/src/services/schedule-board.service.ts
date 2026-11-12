/**
 * @file schedule-board.service.ts
 * @module backend/services
 *
 * Schedule board for /dev/schedule-views: eligible scholars + standing shifts,
 * plus developer replace of one scholar's active FD/SS assignments.
 */
import { scholarYearLabel } from "../../../shared/dist/time.js";
import type { ShiftSessionKind, ScholarShiftAssignment } from "../models/session-log.model.js";
import { getSupabaseClient } from "../supabase/client.js";
import { getActiveSemesterRow } from "./semester.service.js";
import { fetchAllUsersForMemo, isEligibleScholar } from "./user.service.js";

export type ScheduleBoardShiftDto = {
  id: string;
  kind: ShiftSessionKind;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type ScheduleBoardScholarDto = {
  uid: string;
  name: string;
  cohort: number | null;
  classYearLabel: "Freshman" | "Sophomore" | null;
  fd_required: number;
  ss_required: number;
  shifts: ScheduleBoardShiftDto[];
};

export type ScheduleBoardResponse = {
  scholars: ScheduleBoardScholarDto[];
};

function shortTime(value: string): string {
  return value.trim().slice(0, 5);
}

async function fetchActiveAssignmentsForScholars(
  scholarIds: string[],
): Promise<ScholarShiftAssignment[]> {
  if (scholarIds.length === 0) return [];
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
    .select("id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active")
    .in("scholar_id", scholarIds)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as ScholarShiftAssignment[];
}

function toShiftDto(row: ScholarShiftAssignment): ScheduleBoardShiftDto | null {
  if (row.session_kind !== "front_desk" && row.session_kind !== "study_session") {
    return null;
  }
  const id =
    row.id != null
      ? String(row.id)
      : `${row.scholar_id}:${row.session_kind}:${row.day_of_week}:${row.start_time}`;
  return {
    id,
    kind: row.session_kind,
    dayOfWeek: Number(row.day_of_week),
    startTime: shortTime(String(row.start_time ?? "")),
    endTime: shortTime(String(row.end_time ?? "")),
  };
}

/** Hour-eligible scholars with standing FD/SS assignments for the schedule board. */
export async function getScheduleBoard(): Promise<ScheduleBoardResponse> {
  const users = await fetchAllUsersForMemo();
  const eligible = users.filter(isEligibleScholar);
  const uids = eligible.map((u) => u.uid);
  const assignments = await fetchActiveAssignmentsForScholars(uids);

  const shiftsByUid = new Map<string, ScheduleBoardShiftDto[]>();
  for (const row of assignments) {
    if (!row.is_active) continue;
    const dto = toShiftDto(row);
    if (!dto) continue;
    const list = shiftsByUid.get(row.scholar_id) ?? [];
    list.push(dto);
    shiftsByUid.set(row.scholar_id, list);
  }

  const scholars: ScheduleBoardScholarDto[] = eligible.map((u) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    const shifts = (shiftsByUid.get(u.uid) ?? []).sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.startTime.localeCompare(b.startTime);
    });
    return {
      uid: u.uid,
      name: name || u.uid,
      cohort: u.cohort,
      classYearLabel: scholarYearLabel(u.cohort),
      fd_required: u.fd_required != null ? Number(u.fd_required) : 0,
      ss_required: u.ss_required != null ? Number(u.ss_required) : 0,
      shifts,
    };
  });

  scholars.sort((a, b) => {
    const cohortA = a.cohort ?? 0;
    const cohortB = b.cohort ?? 0;
    if (cohortA !== cohortB) return cohortB - cohortA; // fresher cohort first
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return { scholars };
}

export type StandingShiftInput = {
  kind: ShiftSessionKind;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type ReplaceScholarShiftsResult = {
  uid: string;
  shifts: ScheduleBoardShiftDto[];
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function normalizeClock(value: string, label: string): string {
  const trimmed = value.trim();
  const match = TIME_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid ${label}: expected HH:MM`);
  }
  return `${match[1]}:${match[2]}:00`;
}

function parseMinutes(clockWithSeconds: string): number {
  const parts = clockWithSeconds.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

function validateStandingShiftInput(raw: StandingShiftInput, index: number): StandingShiftInput {
  if (raw.kind !== "front_desk" && raw.kind !== "study_session") {
    throw new Error(`shifts[${index}].kind must be front_desk or study_session`);
  }
  const dayOfWeek = Number(raw.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error(`shifts[${index}].dayOfWeek must be an integer 0–6`);
  }
  const startTime = normalizeClock(String(raw.startTime ?? ""), `shifts[${index}].startTime`);
  const endTime = normalizeClock(String(raw.endTime ?? ""), `shifts[${index}].endTime`);
  if (parseMinutes(endTime) <= parseMinutes(startTime)) {
    throw new Error(`shifts[${index}]: endTime must be after startTime`);
  }
  return {
    kind: raw.kind,
    dayOfWeek,
    startTime: shortTime(startTime),
    endTime: shortTime(endTime),
  };
}

type ShiftTableClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | number | boolean) => {
        eq: (column: string, value: string | number | boolean) => {
          eq: (
            column: string,
            value: string | number | boolean,
          ) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    update: (values: Record<string, unknown>) => {
      in: (
        column: string,
        values: string[],
      ) => {
        select: (columns: string) => Promise<{ data: unknown; error: unknown }>;
      };
    };
    insert: (rows: Record<string, unknown>[]) => {
      select: (columns: string) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

async function fetchActiveAssignmentsForScholarSemester(
  scholarId: string,
  semesterId: number,
): Promise<ScholarShiftAssignment[]> {
  const supabase = getSupabaseClient() as unknown as ShiftTableClient;
  const { data, error } = await supabase
    .from("scholar_shift_assignments")
    .select("id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active")
    .eq("scholar_id", scholarId)
    .eq("semester_id", semesterId)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as ScholarShiftAssignment[];
}

async function setAssignmentsActive(
  ids: string[],
  isActive: boolean,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabaseClient() as unknown as ShiftTableClient;
  const { data, error } = await supabase
    .from("scholar_shift_assignments")
    .update({ is_active: isActive })
    .in("id", ids)
    .select("id");
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string }>;
  return rows.map((row) => String(row.id));
}

async function insertStandingShifts(
  scholarId: string,
  semesterId: number,
  shifts: StandingShiftInput[],
): Promise<ScholarShiftAssignment[]> {
  if (shifts.length === 0) return [];
  const supabase = getSupabaseClient() as unknown as ShiftTableClient;
  const rows = shifts.map((shift) => ({
    scholar_id: scholarId,
    semester_id: semesterId,
    session_kind: shift.kind,
    day_of_week: shift.dayOfWeek,
    start_time: normalizeClock(shift.startTime, "startTime"),
    end_time: normalizeClock(shift.endTime, "endTime"),
    is_active: true,
  }));
  const { data, error } = await supabase
    .from("scholar_shift_assignments")
    .insert(rows)
    .select("id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active");
  if (error) throw error;
  return (data ?? []) as ScholarShiftAssignment[];
}

/**
 * Soft-deactivate every active FD/SS standing row for the scholar in the
 * active semester, then insert the replacement set (same pattern as
 * scripts/update-scholar-schedule.py). Empty `shifts` clears the schedule.
 */
export async function replaceScholarStandingShifts(
  uid: string,
  shiftsInput: StandingShiftInput[],
): Promise<ReplaceScholarShiftsResult> {
  if (!uid.trim()) throw new Error("Missing uid");
  if (!Array.isArray(shiftsInput)) throw new Error("shifts must be an array");

  const shifts = shiftsInput.map((raw, index) =>
    validateStandingShiftInput(raw, index),
  );

  const semester = await getActiveSemesterRow();
  if (!semester) throw new Error("No active semester");

  const existing = await fetchActiveAssignmentsForScholarSemester(
    uid,
    semester.id,
  );
  const existingIds = existing
    .map((row) => (row.id != null ? String(row.id) : null))
    .filter((id): id is string => Boolean(id));

  let deactivatedIds: string[] = [];
  try {
    deactivatedIds = await setAssignmentsActive(existingIds, false);
    if (
      existingIds.length > 0 &&
      new Set(deactivatedIds).size !== new Set(existingIds).size
    ) {
      throw new Error("Could not deactivate every current shift");
    }
    const inserted = await insertStandingShifts(uid, semester.id, shifts);
    const dtos = inserted
      .map(toShiftDto)
      .filter((dto): dto is ScheduleBoardShiftDto => dto != null)
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });
    return { uid, shifts: dtos };
  } catch (error) {
    if (deactivatedIds.length > 0) {
      try {
        await setAssignmentsActive(deactivatedIds, true);
      } catch {
        throw new Error(
          `${caughtMessage(error)}; rollback failed — previous shifts may still be inactive`,
        );
      }
      throw new Error(
        `${caughtMessage(error)}; previous shifts were restored`,
      );
    }
    throw error;
  }
}

function caughtMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to replace scholar shifts";
}
