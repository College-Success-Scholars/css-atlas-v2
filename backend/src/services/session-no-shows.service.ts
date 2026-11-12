/**
 * @file session-no-shows.service.ts
 * @module backend/services
 *
 * Request-scoped no-show lists for Room Monitoring (study + front desk).
 * Uses the viewer JWT via getSupabaseClient() so RLS applies; never sends notifications.
 *
 * ## What belongs here
 * - Semester / break gating, today's assignments + logs, roster contact mapping
 *
 * ## What does NOT belong here
 * - Pure threshold math (session-no-shows.logic.ts)
 * - HTTP request/response handling
 */
import { getSupabaseClient } from "../supabase/client.js";
import type {
  ScholarNoShow,
  ScholarShiftAssignment,
  SessionLogRow,
  ShiftSessionKind,
} from "../models/session-log.model.js";
import { findFrontDeskNoShows, findStudyNoShows } from "./session-no-shows.logic.js";
import { getEasternDateParts, getEasternDayOfWeek, getStartOfDayEastern } from "./time.service.js";

function easternDateKey(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lateThresholdMinutes(): number {
  const configured = Number.parseInt(process.env.SIGNIN_NOTIFICATION_LATE_THRESHOLD_MINUTES ?? "", 10);
  return Number.isFinite(configured) && configured >= 0 ? configured : 15;
}

async function getSessionNoShows(kind: ShiftSessionKind, now: Date): Promise<ScholarNoShow[]> {
  const supabase = getSupabaseClient();
  const dateKey = easternDateKey(now);

  const { data: semesterRows, error: semesterError } = await supabase
    .from("semesters")
    .select("id, start_date, end_date")
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1);
  if (semesterError) throw semesterError;

  const semester = semesterRows?.[0] ?? null;
  if (!semester || dateKey < semester.start_date || dateKey > semester.end_date) return [];

  const { data: breaks, error: breakError } = await supabase
    .from("semester_breaks")
    .select("id")
    .eq("semester_id", semester.id)
    .lte("start_date", dateKey)
    .gte("end_date", dateKey)
    .limit(1);
  if (breakError) throw breakError;
  if ((breaks?.length ?? 0) > 0) return [];

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("scholar_shift_assignments")
    .select("scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active")
    .eq("is_active", true)
    .eq("semester_id", semester.id)
    .eq("session_kind", kind)
    .eq("day_of_week", getEasternDayOfWeek(now));
  if (assignmentError) throw assignmentError;

  const assignments = (assignmentRows ?? []) as ScholarShiftAssignment[];
  const ids = [...new Set(assignments.map((row) => row.scholar_id))];
  if (!ids.length) return [];

  const isStudy = kind === "study_session";
  const dayStart = getStartOfDayEastern(now).toISOString();
  const dayEnd = now.toISOString();

  let logResult;
  if (isStudy) {
    logResult = await supabase
      .from("study_session_logs")
      .select("id, created_at, scholar_uid, action_type, session_type")
      .in("scholar_uid", ids)
      .eq("session_type", "Study Session")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd);
  } else {
    logResult = await supabase
      .from("front_desk_logs")
      .select("id, created_at, scholar_uid, action_type")
      .in("scholar_uid", ids)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd);
  }
  if (logResult.error) throw logResult.error;

  const rows = ((logResult.data ?? []) as SessionLogRow[]).map((row) =>
    isStudy ? row : { ...row, session_type: "Front Desk" },
  );
  const missed = (isStudy ? findStudyNoShows : findFrontDeskNoShows)(
    assignments,
    rows,
    now,
    lateThresholdMinutes(),
  );
  if (!missed.length) return [];

  const missingIds = [...new Set(missed.map((row) => row.scholarId))];
  const { data: rosterRows, error: rosterError } = await supabase
    .from("user_roster")
    .select("uid, first_name, last_name, phone_number")
    .in("uid", missingIds);
  if (rosterError) throw rosterError;

  const rosterByUid = new Map<string, { scholarName: string; phoneNumber: string | null }>();
  for (const row of rosterRows ?? []) {
    if (!row.uid) continue;
    rosterByUid.set(row.uid, {
      scholarName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.uid,
      phoneNumber: row.phone_number?.trim() || null,
    });
  }

  return missed
    .map((row) => {
      const roster = rosterByUid.get(row.scholarId);
      return {
        scholarId: row.scholarId,
        scholarName: roster?.scholarName ?? row.scholarId,
        phoneNumber: roster?.phoneNumber ?? null,
        scheduledStart: row.scheduledStart.toISOString(),
        scheduledEnd: row.scheduledEnd.toISOString(),
      } satisfies ScholarNoShow;
    })
    .sort(
      (a, b) =>
        a.scholarName.localeCompare(b.scholarName) ||
        a.scheduledStart.localeCompare(b.scheduledStart),
    );
}

export function getStudySessionNoShows(now = new Date()): Promise<ScholarNoShow[]> {
  return getSessionNoShows("study_session", now);
}

export function getFrontDeskNoShows(now = new Date()): Promise<ScholarNoShow[]> {
  return getSessionNoShows("front_desk", now);
}
