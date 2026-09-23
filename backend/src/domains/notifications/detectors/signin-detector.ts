import "dotenv/config";
import { getStartOfDayEastern } from "../../../services/time.service.js";
import { findShiftOccurrenceMatch } from "../../../services/shift-occurrence.service.js";
import { emitNotificationEvent, NotificationEventType } from "../index.js";
import type { NotificationPhase } from "../index.js";
import { dayRange, easternDateKey, fetchAssignmentsForDate, fetchLogsForRange, firstEntryAt, kindLogs, parseNonNegativeInt } from "./detector-data.js";

const LATE_THRESHOLD_MINUTES = parseNonNegativeInt(process.env.SIGNIN_NOTIFICATION_LATE_THRESHOLD_MINUTES, 15);
const ENDED_STALE_MINUTES = parseNonNegativeInt(process.env.SIGNIN_NOTIFICATION_ENDED_STALE_MINUTES, 60);
export type SigninDecision = { action: "skip"; reason: "before_late_threshold" | "stale_after_end" } | { action: "emit"; phase: NotificationPhase };
export function decideSigninAction(nowMs: number, lateAtMs: number, endsAtMs: number, staleMinutes: number): SigninDecision {
  if (nowMs < lateAtMs) return { action: "skip", reason: "before_late_threshold" };
  if (nowMs >= endsAtMs) return nowMs > endsAtMs + staleMinutes * 60_000 ? { action: "skip", reason: "stale_after_end" } : { action: "emit", phase: "ended" };
  return { action: "emit", phase: "late" };
}
export async function runSigninDetector(now = new Date()): Promise<void> {
  const startedAt = Date.now(), day = getStartOfDayEastern(now), occurrenceDate = easternDateKey(day);
  const outcomes = { sent: 0, skipped: 0, failed: 0, noRecipient: 0 };
  const assignments = await fetchAssignmentsForDate(day), range = dayRange(day);
  const logs = await fetchLogsForRange(range.start, range.end, assignments.map((assignment) => assignment.scholar_id));
  for (const assignment of assignments) {
    const rows = logs.get(assignment.scholar_id) ?? [], match = findShiftOccurrenceMatch(assignment, day, kindLogs(assignment, rows));
    const occurrenceRef = `${assignment.id ?? assignment.scholar_id}:${occurrenceDate}`;
    const decision = decideSigninAction(now.getTime(), match.scheduledStart.getTime() + LATE_THRESHOLD_MINUTES * 60_000, match.scheduledEnd.getTime(), ENDED_STALE_MINUTES);
    if (decision.action === "skip" || match.entry) continue;
    const type = assignment.session_kind === "front_desk" ? NotificationEventType.MISSED_FRONT_DESK : NotificationEventType.MISSED_STUDY_SESSION;
    const outcome = await emitNotificationEvent({ type, occurrenceRef, scholarId: assignment.scholar_id, sessionKind: assignment.session_kind, occurrenceDate, scheduledStart: match.scheduledStart.toISOString(), scheduledEnd: match.scheduledEnd.toISOString(), phase: decision.phase, minutesLate: Math.max(0, Math.round((now.getTime() - match.scheduledStart.getTime()) / 60_000)), unmatchedEntryAt: firstEntryAt(assignment, rows) });
    if (!outcome) outcomes.noRecipient += 1;
    else if (outcome.status === "sent") outcomes.sent += 1;
    else if (outcome.status === "failed") outcomes.failed += 1;
    else outcomes.skipped += 1;
  }
  console.info("[signin-detector] completed", { occurrenceDate, assignments: assignments.length, outcomes, durationMs: Date.now() - startedAt });
}
if (/signin-detector\.(js|ts)$/.test(process.argv[1] ?? "")) runSigninDetector().catch((error) => { console.error("[signin-detector] failed", { error }); process.exitCode = 1; });
