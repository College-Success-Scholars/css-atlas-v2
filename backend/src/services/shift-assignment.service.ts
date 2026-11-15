/**
 * @file shift-assignment.service.ts
 * @module backend/services
 *
 * The one place that decides when a recurring scholar shift applies. Assignment rows
 * carry [effective_from, effective_until) Eastern calendar dates; every reader asks
 * this module instead of testing the columns itself.
 *
 * ## Responsibilities
 * - isAssignmentEffectiveOn / assignmentOverlapsWindow: the range interpretation
 * - fetchEffectiveAssignments: bounded, paged reads of rows effective in a date window
 * - findSemesterForDate: the semester that contains a calendar date
 * - expandAssignmentOccurrences: dated occurrences with stable `assignment:date` refs
 *
 * ## What does NOT belong here
 * - Writes (only public.replace_scholar_schedule_from_week writes; see schedule-board.service)
 */
import type { ScholarShiftAssignment, ShiftSessionKind } from "../models/session-log.model.js";
import type { ServiceSupabaseClient } from "../supabase/client.js";
import {
  addEasternCalendarDays,
  getEasternDateParts,
  getEasternDayOfWeek,
  getStartOfDayEastern,
} from "./time.service.js";

export const ASSIGNMENT_COLUMNS =
  "id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, effective_from, effective_until";

const PAGE_SIZE = 1000;

export function easternDateKey(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type EffectiveRange = Pick<ScholarShiftAssignment, "effective_from" | "effective_until">;

/** True when the weekly shift applies on the Eastern calendar date `dateKey` (YYYY-MM-DD). */
export function isAssignmentEffectiveOn(assignment: EffectiveRange, dateKey: string): boolean {
  return assignment.effective_from <= dateKey && dateKey < assignment.effective_until;
}

/** True when the row applies on at least one date in [startKey, endKey] (inclusive). */
export function assignmentOverlapsWindow(
  assignment: EffectiveRange,
  startKey: string,
  endKey: string,
): boolean {
  return assignment.effective_from <= endKey && assignment.effective_until > startKey;
}

export interface AssignmentWindow {
  startKey: string;
  endKey: string;
  scholarIds?: string[];
  semesterId?: number | string | null;
  kind?: ShiftSessionKind;
  dayOfWeek?: number;
}

/** Rows effective on any date in the window. An empty `scholarIds` list reads nothing. */
export async function fetchEffectiveAssignments(
  client: ServiceSupabaseClient,
  window: AssignmentWindow,
): Promise<ScholarShiftAssignment[]> {
  if (window.scholarIds && window.scholarIds.length === 0) return [];
  const rows: ScholarShiftAssignment[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client
      .from("scholar_shift_assignments")
      .select(ASSIGNMENT_COLUMNS)
      .lte("effective_from", window.endKey)
      .gt("effective_until", window.startKey);
    if (window.scholarIds) query = query.in("scholar_id", window.scholarIds);
    if (window.semesterId != null) {
      const numericId = Number(window.semesterId);
      query = query.eq("semester_id", Number.isFinite(numericId) ? numericId : window.semesterId);
    }
    if (window.kind) query = query.eq("session_kind", window.kind);
    if (window.dayOfWeek != null) query = query.eq("day_of_week", window.dayOfWeek);
    const { data, error } = await query.order("id").range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as ScholarShiftAssignment[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.filter((row) => assignmentOverlapsWindow(row, window.startKey, window.endKey));
}

export interface SemesterForDate {
  id: number;
  start_date: string;
  end_date: string;
}

/** The semester whose [start_date, end_date] contains the date, active or not. */
export async function findSemesterForDate(
  client: ServiceSupabaseClient,
  dateKey: string,
): Promise<SemesterForDate | null> {
  const { data, error } = await client
    .from("semesters")
    .select("id, start_date, end_date")
    .lte("start_date", dateKey)
    .gte("end_date", dateKey)
    .order("start_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as SemesterForDate | undefined) ?? null;
}

export interface AssignmentOccurrence {
  assignment: ScholarShiftAssignment;
  dateKey: string;
  date: Date;
  /** Unchanged rows keep their id, so the ref survives later schedule edits. */
  occurrenceRef: string;
}

export function assignmentOccurrenceRef(assignment: ScholarShiftAssignment, dateKey: string): string {
  const base =
    assignment.id ??
    `${assignment.scholar_id}:${assignment.session_kind}:${assignment.day_of_week}`;
  return `${base}:${dateKey}`;
}

/** Dated occurrences for Eastern days from `startDate` through `endDate`, both inclusive. */
export function expandAssignmentOccurrences(
  assignments: ScholarShiftAssignment[],
  startDate: Date,
  endDate: Date,
): AssignmentOccurrence[] {
  const start = getStartOfDayEastern(startDate);
  const endMs = getStartOfDayEastern(endDate).getTime();
  const occurrences: AssignmentOccurrence[] = [];
  for (let date = start; date.getTime() <= endMs; date = addEasternCalendarDays(date, 1)) {
    const dayOfWeek = getEasternDayOfWeek(date);
    const dateKey = easternDateKey(date);
    for (const assignment of assignments) {
      if (assignment.day_of_week !== dayOfWeek) continue;
      if (!isAssignmentEffectiveOn(assignment, dateKey)) continue;
      occurrences.push({
        assignment,
        dateKey,
        date,
        occurrenceRef: assignmentOccurrenceRef(assignment, dateKey),
      });
    }
  }
  return occurrences;
}

/** Assignments that apply on the Eastern calendar day containing `date`. */
export function assignmentsOccurringOn(
  assignments: ScholarShiftAssignment[],
  date: Date,
): ScholarShiftAssignment[] {
  return expandAssignmentOccurrences(assignments, date, date).map((o) => o.assignment);
}
