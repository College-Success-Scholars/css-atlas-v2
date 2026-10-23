/**
 * @file am-pm.service.ts
 * @module backend/services
 *
 * Front Desk AM/PM checklist reads and enrichment.
 *
 * Reads `am_pm_form_logs` (Google Forms intake — never written here) and
 * enriches each row with shift validity, a reminder flag, the scholar's name,
 * and the form's free-text leader name resolved against the roster.
 *
 * ## Responsibilities
 * - Week-scoped and by-uid reads of am_pm_form_logs
 * - Map raw rows to the camelCase DTO the frontend consumes
 *
 * ## What belongs here
 * - Supabase queries on am_pm_form_logs and the pure row builder
 *
 * ## What does NOT belong here
 * - The shift timing rule (shared/front-desk-ampm-config.ts, so the frontend
 *   applies exactly the same one)
 * - HTTP request/response logic (controllers/form-log.controller.ts)
 * - Any write path — intake stays Google Forms
 */
import { getSupabaseClient } from "../supabase/client.js";
import {
  computeReminderOwed,
  isCreatedAtWithinShift,
} from "../../../shared/dist/front-desk-ampm-config.js";
import { campusWeekToDateRange, getWeekFetchEnd } from "./time.service.js";
import { findTeamLeaderUidByFuzzyName } from "./form-log.service.js";
import { fetchScholarNamesByUids, fetchTeamLeaders } from "./user.service.js";
import type {
  AmPmChecklistDto,
  AmPmFormLogRow,
  AmPmLeaderMatch,
} from "../models/am-pm.model.js";
import type { TeamLeaderNameRecord } from "../models/form-log.model.js";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Summarise the untyped `task_completion` JSON as a completed/total pair.
 *
 * The Google Form's shape is not guaranteed, so this tolerates an object of
 * booleans, an array, or anything else (reported as 0/0 rather than throwing).
 */
export function summarizeTaskCompletion(value: unknown): {
  completed: number;
  total: number;
} {
  if (Array.isArray(value)) {
    return { completed: value.filter(Boolean).length, total: value.length };
  }
  if (value !== null && typeof value === "object") {
    const values = Object.values(value as Record<string, unknown>);
    return { completed: values.filter(Boolean).length, total: values.length };
  }
  return { completed: 0, total: 0 };
}

function resolveLeader(
  leaderName: string | null,
  teamLeaders: TeamLeaderNameRecord[]
): AmPmLeaderMatch | null {
  if (!leaderName?.trim()) return null;
  const uid = findTeamLeaderUidByFuzzyName(leaderName, teamLeaders);
  if (!uid) return null;
  const match = teamLeaders.find((tl) => tl.uid === uid);
  const displayName = [match?.first_name, match?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return { uid, displayName: displayName || leaderName.trim() };
}

/**
 * Map raw rows to enriched DTOs. Pure, so the enrichment is unit-testable
 * without Supabase.
 */
export function buildAmPmChecklistRows(
  rows: AmPmFormLogRow[],
  teamLeaders: TeamLeaderNameRecord[],
  scholarNames: Map<string, string>
): AmPmChecklistDto[] {
  return rows.map((row) => {
    const shiftValid = isCreatedAtWithinShift(row.created_at, row.shift);
    const tasks = summarizeTaskCompletion(row.task_completion);
    return {
      id: row.id,
      scholarUid: row.uid ?? null,
      scholarName: row.uid ? scholarNames.get(row.uid) ?? null : null,
      shift: row.shift ?? null,
      submittedAt: row.created_at ?? null,
      leaderName: row.leader_name ?? null,
      leaderMatch: resolveLeader(row.leader_name ?? null, teamLeaders),
      tasksCompleted: tasks.completed,
      tasksTotal: tasks.total,
      shiftValid,
      reminderOwed: computeReminderOwed(shiftValid),
    };
  });
}

// ---------------------------------------------------------------------------
// Supabase fetch + enrich
// ---------------------------------------------------------------------------

async function enrich(rows: AmPmFormLogRow[]): Promise<AmPmChecklistDto[]> {
  if (rows.length === 0) return [];
  const uids = rows.map((r) => r.uid).filter((u): u is string => Boolean(u));
  const [teamLeaders, scholarNames] = await Promise.all([
    fetchTeamLeaders(),
    fetchScholarNamesByUids(uids),
  ]);
  return buildAmPmChecklistRows(rows, teamLeaders, scholarNames);
}

/** Every checklist submission in a campus week, enriched. */
export async function getAmPmChecklistForWeek(
  weekNum: number
): Promise<AmPmChecklistDto[]> {
  const range = campusWeekToDateRange(weekNum);
  if (!range) return [];
  const supabase = getSupabaseClient();
  const endDate = getWeekFetchEnd(range);
  const { data, error } = await supabase
    .from("am_pm_form_logs")
    .select("*")
    .gte("created_at", range.startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return enrich((data ?? []) as AmPmFormLogRow[]);
}

/**
 * Checklist submissions for specific scholars, enriched.
 *
 * Used by the mentee view, which batches by its mentees' uids the same way the
 * WAHF and tutor-report by-uids endpoints do. Optionally week-scoped.
 */
export async function getAmPmChecklistByUids(
  uids: string[],
  weekNum?: number
): Promise<AmPmChecklistDto[]> {
  const unique = [...new Set(uids.filter(Boolean))];
  if (unique.length === 0) return [];

  const supabase = getSupabaseClient();
  let query = supabase.from("am_pm_form_logs").select("*").in("uid", unique);

  if (weekNum != null) {
    const range = campusWeekToDateRange(weekNum);
    if (!range) return [];
    query = query
      .gte("created_at", range.startDate.toISOString())
      .lte("created_at", getWeekFetchEnd(range).toISOString());
  }

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return enrich((data ?? []) as AmPmFormLogRow[]);
}
