import { addEasternCalendarDays, getEasternDayOfWeek, getEasternDateParts, getStartOfDayEastern } from "../../../services/time.service.js";
import { getSupabaseServiceRoleClient } from "../../../supabase/client.js";
import type { ScholarShiftAssignment, SessionLogRow } from "../../../models/session-log.model.js";

export function easternDateKey(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dayRange(date: Date): { start: Date; end: Date } {
  const start = getStartOfDayEastern(date);
  return { start, end: new Date(addEasternCalendarDays(start, 1).getTime() - 1) };
}

export async function fetchAssignmentsForDate(date: Date): Promise<ScholarShiftAssignment[]> {
  const supabase = getSupabaseServiceRoleClient();
  const dateKey = easternDateKey(date);
  const { data: semesterRows, error: semesterError } = await supabase
    .from("semesters").select("id, start_date, end_date").eq("is_active", true)
    .order("start_date", { ascending: false }).limit(1);
  if (semesterError) throw semesterError;
  const semester = (semesterRows?.[0] ?? null) as { id: number; start_date: string; end_date: string } | null;
  if (!semester || dateKey < semester.start_date || dateKey > semester.end_date) return [];
  const { data: breaks, error: breakError } = await supabase.from("semester_breaks").select("id")
    .eq("semester_id", semester.id).lte("start_date", dateKey).gte("end_date", dateKey).limit(1);
  if (breakError) throw breakError;
  if ((breaks?.length ?? 0) > 0) return [];
  const { data, error } = await supabase
    .from("scholar_shift_assignments")
    .select("id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active")
    .eq("is_active", true)
    .eq("semester_id", semester.id)
    .eq("day_of_week", getEasternDayOfWeek(date));
  if (error) throw error;
  return (data ?? []) as unknown as ScholarShiftAssignment[];
}

export function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function firstEntryAt(assignment: ScholarShiftAssignment, rows: SessionLogRow[]): string | undefined {
  return kindLogs(assignment, rows).filter((row) => row.action_type === "Entry")
    .map((row) => row.created_at).filter((value): value is string => Boolean(value)).sort()[0];
}

export async function fetchLogsForRange(start: Date, end: Date, scholarIds: string[]): Promise<Map<string, SessionLogRow[]>> {
  if (scholarIds.length === 0) return new Map();
  const supabase = getSupabaseServiceRoleClient();
  const [frontDesk, study] = await Promise.all([
    supabase.from("front_desk_logs").select("id, created_at, scholar_uid, action_type").in("scholar_uid", scholarIds).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
    supabase.from("study_session_logs").select("id, created_at, scholar_uid, action_type, session_type").in("scholar_uid", scholarIds).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
  ]);
  if (frontDesk.error) throw frontDesk.error;
  if (study.error) throw study.error;
  const result = new Map<string, SessionLogRow[]>();
  for (const row of [...(frontDesk.data ?? []), ...(study.data ?? [])] as SessionLogRow[]) {
    if (!row.scholar_uid) continue;
    const rows = result.get(row.scholar_uid) ?? [];
    rows.push(row);
    result.set(row.scholar_uid, rows);
  }
  return result;
}

export function kindLogs(assignment: ScholarShiftAssignment, rows: SessionLogRow[]): SessionLogRow[] {
  return assignment.session_kind === "front_desk"
    ? rows.filter((row) => row.session_type == null || row.session_type === "Front Desk")
    : rows.filter((row) => row.session_type === "Study Session");
}
