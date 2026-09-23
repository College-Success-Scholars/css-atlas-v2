import "dotenv/config";
import { addEasternCalendarDays, getStartOfDayEastern } from "../../../services/time.service.js";
import { findShiftOccurrenceMatch } from "../../../services/shift-occurrence.service.js";
import { getSupabaseServiceRoleClient } from "../../../supabase/client.js";
import { emitNotificationEvent, NotificationEventType } from "../index.js";
import { dayRange, easternDateKey, fetchAssignmentsForDate, fetchLogsForRange, firstEntryAt, kindLogs, parseNonNegativeInt } from "./detector-data.js";

const RECONCILIATION_DAYS = parseNonNegativeInt(process.env.SIGNIN_NOTIFICATION_RECONCILIATION_DAYS, 3);
const MISSED_TYPES = [NotificationEventType.MISSED_FRONT_DESK, NotificationEventType.MISSED_STUDY_SESSION];

function launchDate(): Date {
  const value = process.env.NOTIFICATIONS_LAUNCH_DATE;
  if (!value) throw new Error("NOTIFICATIONS_LAUNCH_DATE is required for reconciliation");
  return getStartOfDayEastern(new Date(`${value}T12:00:00Z`));
}

async function loadMissedNotifications(refs: string[]): Promise<{ any: Set<string>; sent: Set<string> }> {
  const result = { any: new Set<string>(), sent: new Set<string>() };
  if (refs.length === 0) return result;
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("notification_log")
    .select("event_ref_id, status").in("event_ref_id", refs).in("event_type", MISSED_TYPES);
  if (error) throw error;
  for (const row of data ?? []) { const ref = String(row.event_ref_id); result.any.add(ref); if (row.status === "sent") result.sent.add(ref); }
  return result;
}

export async function runReconciliationDetector(now = new Date()): Promise<void> {
  const startedAt = Date.now();
  const today = getStartOfDayEastern(now);
  const earliest = launchDate();
  const outcomes = { sent: 0, skipped: 0, failed: 0, noRecipient: 0 };
  let assignmentsEvaluated = 0;

  console.info("[reconciliation-detector] started", {
    now: now.toISOString(),
    today: easternDateKey(today),
    launchDate: easternDateKey(earliest),
    reconciliationDays: RECONCILIATION_DAYS,
  });

  for (let offset = 1; offset <= RECONCILIATION_DAYS; offset += 1) {
    const day = addEasternCalendarDays(today, -offset);
    const occurrenceDate = easternDateKey(day);
    if (day.getTime() < earliest.getTime()) {
      console.info("[reconciliation-detector] skipped date", { occurrenceDate, reason: "before_launch_date" });
      continue;
    }

    const assignments = await fetchAssignmentsForDate(day);
    const { start, end } = dayRange(day);
    const logs = await fetchLogsForRange(start, end, assignments.map((assignment) => assignment.scholar_id));
    const refFor = (assignment: (typeof assignments)[number]) => `${assignment.id ?? assignment.scholar_id}:${occurrenceDate}`;
    const missed = await loadMissedNotifications(assignments.map(refFor));

    console.info("[reconciliation-detector] loaded data", {
      occurrenceDate,
      assignments: assignments.length,
      scholarsWithLogs: logs.size,
    });

    for (const assignment of assignments) {
      const rows = logs.get(assignment.scholar_id) ?? [];
      const match = findShiftOccurrenceMatch(assignment, day, kindLogs(assignment, rows));
      const occurrenceRef = refFor(assignment);
      assignmentsEvaluated += 1;

      console.info("[reconciliation-detector] evaluated occurrence", {
        occurrenceRef,
        scholarId: assignment.scholar_id,
        sessionKind: assignment.session_kind,
        scheduledStart: match.scheduledStart.toISOString(),
        scheduledEnd: match.scheduledEnd.toISOString(),
        entryFound: Boolean(match.entry),
        exitFound: Boolean(match.exit),
      });

      if (match.entry && match.exit) {
        console.info("[reconciliation-detector] skipped occurrence", { occurrenceRef, reason: "complete_session" });
        continue;
      }
      if (match.entry && missed.any.has(occurrenceRef)) {
        console.info("[reconciliation-detector] skipped occurrence", { occurrenceRef, reason: "missing_notification_exists" });
        continue;
      }
      if (!match.entry && missed.sent.has(occurrenceRef)) {
        console.info("[reconciliation-detector] skipped occurrence", { occurrenceRef, reason: "already_notified" });
        continue;
      }

      const type = match.entry
        ? assignment.session_kind === "front_desk" ? NotificationEventType.INCOMPLETE_FRONT_DESK : NotificationEventType.INCOMPLETE_STUDY_SESSION
        : assignment.session_kind === "front_desk" ? NotificationEventType.MISSED_FRONT_DESK : NotificationEventType.MISSED_STUDY_SESSION;
      const extra = match.entry ? { entryAt: match.entry.created_at } : { phase: "ended" as const, unmatchedEntryAt: firstEntryAt(assignment, rows) };
      const outcome = await emitNotificationEvent({
        type,
        occurrenceRef,
        scholarId: assignment.scholar_id,
        sessionKind: assignment.session_kind,
        occurrenceDate,
        scheduledStart: match.scheduledStart.toISOString(),
        scheduledEnd: match.scheduledEnd.toISOString(),
        ...extra,
      });

      if (!outcome) outcomes.noRecipient += 1;
      else if (outcome.status === "sent") outcomes.sent += 1;
      else if (outcome.status === "failed") outcomes.failed += 1;
      else outcomes.skipped += 1;

      console.info("[reconciliation-detector] notification result", {
        occurrenceRef,
        eventType: type,
        outcome: outcome?.status ?? "skipped_no_unique_recipient",
        attemptCount: outcome?.attemptCount ?? 0,
        error: outcome?.error ?? null,
      });
    }
  }

  console.info("[reconciliation-detector] completed", {
    daysChecked: RECONCILIATION_DAYS,
    assignmentsEvaluated,
    outcomes,
    durationMs: Date.now() - startedAt,
  });
}

if (process.argv[1]?.endsWith("reconciliation-detector.js")) {
  runReconciliationDetector().catch((error) => {
    console.error("[reconciliation-detector] failed", { error });
    process.exitCode = 1;
  });
}
