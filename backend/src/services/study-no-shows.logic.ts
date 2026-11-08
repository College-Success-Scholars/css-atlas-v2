import type { ScholarShiftAssignment, SessionLogRow, ShiftSessionKind } from "../models/session-log.model.js";
import { findShiftOccurrenceMatch } from "./shift-occurrence.service.js";
import { getEasternDayOfWeek } from "./time.service.js";

/** Pure check; callers supply today's semester-valid assignments and logs. */
function findNoShowIds(kind: ShiftSessionKind, assignments: ScholarShiftAssignment[], logs: SessionLogRow[], now: Date, lateThresholdMinutes: number): string[] {
  const relevantLogs = logs.filter((row) =>
    (kind === "study_session" ? row.session_type === "Study Session" : row.session_type == null || row.session_type === "Front Desk")
    && new Date(row.created_at) <= now);
  const missing = new Set<string>();
  for (const assignment of assignments) {
    if (!assignment.is_active || assignment.session_kind !== kind || assignment.day_of_week !== getEasternDayOfWeek(now)) continue;
    const match = findShiftOccurrenceMatch(assignment, now, relevantLogs);
    if (now.getTime() < match.scheduledStart.getTime() + lateThresholdMinutes * 60_000 || now >= match.scheduledEnd) continue;
    if (!match.entry) missing.add(assignment.scholar_id);
  }
  return [...missing];
}

export function findStudyNoShowIds(assignments: ScholarShiftAssignment[], logs: SessionLogRow[], now: Date, lateThresholdMinutes = 15): string[] {
  return findNoShowIds("study_session", assignments, logs, now, lateThresholdMinutes);
}

export function findFrontDeskNoShowIds(assignments: ScholarShiftAssignment[], logs: SessionLogRow[], now: Date, lateThresholdMinutes = 15): string[] {
  return findNoShowIds("front_desk", assignments, logs, now, lateThresholdMinutes);
}
