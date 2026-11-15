/**
 * @file session-no-shows.logic.ts
 * @module backend/services
 *
 * Pure no-show detection for scheduled study / front-desk shifts.
 * Callers supply assignments and today's logs; only rows effective on `now`'s Eastern date count.
 *
 * ## What belongs here
 * - Threshold / window checks against findShiftOccurrenceMatch
 *
 * ## What does NOT belong here
 * - Supabase queries or HTTP handling
 */
import type { ScholarShiftAssignment, SessionLogRow, ShiftSessionKind } from "../models/session-log.model.js";
import { findShiftOccurrenceMatch } from "./shift-occurrence.service.js";
import { assignmentsOccurringOn } from "./shift-assignment.service.js";

/** One missed shift occurrence for a scholar (before roster enrichment). */
export interface MissedShiftOccurrence {
  scholarId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

function findMissedShifts(
  kind: ShiftSessionKind,
  assignments: ScholarShiftAssignment[],
  logs: SessionLogRow[],
  now: Date,
  lateThresholdMinutes: number,
): MissedShiftOccurrence[] {
  const relevantLogs = logs.filter((row) => {
    const matchesKind =
      kind === "study_session"
        ? row.session_type === "Study Session"
        : row.session_type == null || row.session_type === "Front Desk";
    return matchesKind && new Date(row.created_at) <= now;
  });

  const missed: MissedShiftOccurrence[] = [];
  const seen = new Set<string>();

  for (const assignment of assignmentsOccurringOn(assignments, now)) {
    if (assignment.session_kind !== kind) continue;

    const match = findShiftOccurrenceMatch(assignment, now, relevantLogs);
    const lateAt = match.scheduledStart.getTime() + lateThresholdMinutes * 60_000;
    if (now.getTime() < lateAt || now >= match.scheduledEnd) continue;
    if (match.entry) continue;

    const key = `${assignment.scholar_id}|${match.scheduledStart.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    missed.push({
      scholarId: assignment.scholar_id,
      scheduledStart: match.scheduledStart,
      scheduledEnd: match.scheduledEnd,
    });
  }

  return missed.sort(
    (a, b) =>
      a.scheduledStart.getTime() - b.scheduledStart.getTime() ||
      a.scholarId.localeCompare(b.scholarId),
  );
}

export function findStudyNoShows(
  assignments: ScholarShiftAssignment[],
  logs: SessionLogRow[],
  now: Date,
  lateThresholdMinutes = 15,
): MissedShiftOccurrence[] {
  return findMissedShifts("study_session", assignments, logs, now, lateThresholdMinutes);
}

export function findFrontDeskNoShows(
  assignments: ScholarShiftAssignment[],
  logs: SessionLogRow[],
  now: Date,
  lateThresholdMinutes = 15,
): MissedShiftOccurrence[] {
  return findMissedShifts("front_desk", assignments, logs, now, lateThresholdMinutes);
}
