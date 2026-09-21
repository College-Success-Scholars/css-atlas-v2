import "dotenv/config";
import { addEasternCalendarDays, getStartOfDayEastern } from "../../../services/time.service.js";
import { findShiftOccurrenceMatch } from "../../../services/shift-occurrence.service.js";
import { getSupabaseServiceRoleClient } from "../../../supabase/client.js";
import { emitNotificationEvent, NotificationEventType } from "../index.js";
import { dayRange, easternDateKey, fetchAssignmentsForDate, fetchLogsForRange, kindLogs } from "./detector-data.js";

const RECONCILIATION_DAYS = Number(process.env.SIGNIN_NOTIFICATION_RECONCILIATION_DAYS ?? 7);

function launchDate(): Date {
  const value = process.env.NOTIFICATIONS_LAUNCH_DATE;
  if (!value) throw new Error("NOTIFICATIONS_LAUNCH_DATE is required for reconciliation");
  return getStartOfDayEastern(new Date(`${value}T12:00:00Z`));
}

async function missingNotificationExists(occurrenceRef: string): Promise<boolean> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("notification_log")
    .select("id")
    .eq("event_ref_id", occurrenceRef)
    .in("event_type", [NotificationEventType.MISSED_FRONT_DESK, NotificationEventType.MISSED_STUDY_SESSION])
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
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

    console.info("[reconciliation-detector] loaded data", {
      occurrenceDate,
      assignments: assignments.length,
      scholarsWithLogs: logs.size,
    });

    for (const assignment of assignments) {
      const match = findShiftOccurrenceMatch(assignment, day, kindLogs(assignment, logs.get(assignment.scholar_id) ?? []));
      const occurrenceRef = `${assignment.id ?? assignment.scholar_id}:${occurrenceDate}`;
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
      if (match.entry && await missingNotificationExists(occurrenceRef)) {
        console.info("[reconciliation-detector] skipped occurrence", { occurrenceRef, reason: "missing_notification_exists" });
        continue;
      }

      const type = match.entry
        ? assignment.session_kind === "front_desk" ? NotificationEventType.INCOMPLETE_FRONT_DESK : NotificationEventType.INCOMPLETE_STUDY_SESSION
        : assignment.session_kind === "front_desk" ? NotificationEventType.MISSED_FRONT_DESK : NotificationEventType.MISSED_STUDY_SESSION;
      const outcome = await emitNotificationEvent({
        type,
        occurrenceRef,
        scholarId: assignment.scholar_id,
        sessionKind: assignment.session_kind,
        occurrenceDate,
        scheduledStart: match.scheduledStart.toISOString(),
        scheduledEnd: match.scheduledEnd.toISOString(),
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
