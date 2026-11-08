import { getSupabaseClient } from "../supabase/client.js";
import type { ScholarShiftAssignment, SessionLogRow, ScholarNoShow, ShiftSessionKind } from "../models/session-log.model.js";
import { findStudyNoShowIds, findFrontDeskNoShowIds } from "./study-no-shows.logic.js";
import { getEasternDateParts, getEasternDayOfWeek, getStartOfDayEastern } from "./time.service.js";

// Generated database types do not yet describe shift assignments.
interface ReadQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  select(columns: string): ReadQuery;
  eq(column: string, value: string | number | boolean): ReadQuery;
  lte(column: string, value: string): ReadQuery;
  gte(column: string, value: string): ReadQuery;
  in(column: string, values: string[]): ReadQuery;
  order(column: string, options: { ascending: boolean }): ReadQuery;
  limit(count: number): ReadQuery;
}

/** Request-scoped permissions only; never invokes notification delivery. */
async function getSessionNoShows(kind: ShiftSessionKind, now: Date): Promise<ScholarNoShow[]> {
  const client = getSupabaseClient() as unknown as { from(table: string): ReadQuery };
  const { year, month, day } = getEasternDateParts(now);
  const dateKey = [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  const semesterResult = await client.from("semesters").select("id, start_date, end_date")
    .eq("is_active", true).order("start_date", { ascending: false }).limit(1);
  if (semesterResult.error) throw semesterResult.error;
  const semester = (semesterResult.data as Array<{ id: number; start_date: string; end_date: string }> | null)?.[0];
  if (!semester || dateKey < semester.start_date || dateKey > semester.end_date) return [];
  const breakResult = await client.from("semester_breaks").select("id").eq("semester_id", semester.id)
    .lte("start_date", dateKey).gte("end_date", dateKey).limit(1);
  if (breakResult.error) throw breakResult.error;
  if ((breakResult.data as unknown[] | null)?.length) return [];
  const assignmentResult = await client.from("scholar_shift_assignments")
    .select("scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active")
    .eq("is_active", true).eq("semester_id", semester.id)
    .eq("session_kind", kind).eq("day_of_week", getEasternDayOfWeek(now));
  if (assignmentResult.error) throw assignmentResult.error;
  const assignments = (assignmentResult.data ?? []) as ScholarShiftAssignment[];
  const ids = [...new Set(assignments.map((row) => row.scholar_id))];
  if (!ids.length) return [];
  const isStudy = kind === "study_session";
  let logQuery = client.from(isStudy ? "study_session_logs" : "front_desk_logs")
    .select(isStudy ? "id, created_at, scholar_uid, action_type, session_type" : "id, created_at, scholar_uid, action_type")
    .in("scholar_uid", ids);
  if (isStudy) logQuery = logQuery.eq("session_type", "Study Session");
  const logResult = await logQuery.gte("created_at", getStartOfDayEastern(now).toISOString()).lte("created_at", now.toISOString());
  if (logResult.error) throw logResult.error;
  const configuredThreshold = Number.parseInt(process.env.SIGNIN_NOTIFICATION_LATE_THRESHOLD_MINUTES ?? "", 10);
  const threshold = Number.isFinite(configuredThreshold) && configuredThreshold >= 0 ? configuredThreshold : 15;
  const rows = ((logResult.data ?? []) as SessionLogRow[]).map((row) => isStudy ? row : { ...row, session_type: "Front Desk" });
  const missingIds = (isStudy ? findStudyNoShowIds : findFrontDeskNoShowIds)(assignments, rows, now, threshold);
  if (!missingIds.length) return [];
  const rosterResult = await client.from("user_roster").select("uid, first_name, last_name, phone_number").in("uid", missingIds);
  if (rosterResult.error) throw rosterResult.error;
  const roster = (rosterResult.data ?? []) as Array<{ uid: string; first_name: string | null; last_name: string | null; phone_number: string | null }>;
  // Return only contacts visible under the viewer's existing permissions.
  return roster.map((row) => ({
    scholarId: row.uid,
    scholarName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.uid,
    phoneNumber: row.phone_number?.trim() || null,
  })).sort((a, b) => a.scholarName.localeCompare(b.scholarName));
}

export function getStudySessionNoShows(now = new Date()): Promise<ScholarNoShow[]> {
  return getSessionNoShows("study_session", now);
}

export function getFrontDeskNoShows(now = new Date()): Promise<ScholarNoShow[]> {
  return getSessionNoShows("front_desk", now);
}
