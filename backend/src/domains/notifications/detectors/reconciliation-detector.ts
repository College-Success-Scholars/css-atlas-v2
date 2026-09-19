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
  const today = getStartOfDayEastern(now);
  const earliest = launchDate();
  for (let offset = 1; offset <= RECONCILIATION_DAYS; offset += 1) {
    const day = addEasternCalendarDays(today, -offset);
    if (day.getTime() < earliest.getTime()) continue;
    const assignments = await fetchAssignmentsForDate(day);
    const { start, end } = dayRange(day);
    const logs = await fetchLogsForRange(start, end, assignments.map((assignment) => assignment.scholar_id));
    for (const assignment of assignments) {
      const match = findShiftOccurrenceMatch(assignment, day, kindLogs(assignment, logs.get(assignment.scholar_id) ?? []));
      if (match.entry && match.exit) continue;
      const occurrenceRef = `${assignment.id ?? assignment.scholar_id}:${easternDateKey(day)}`;
      if (match.entry && await missingNotificationExists(occurrenceRef)) continue;
      const type = match.entry
        ? assignment.session_kind === "front_desk" ? NotificationEventType.INCOMPLETE_FRONT_DESK : NotificationEventType.INCOMPLETE_STUDY_SESSION
        : assignment.session_kind === "front_desk" ? NotificationEventType.MISSED_FRONT_DESK : NotificationEventType.MISSED_STUDY_SESSION;
      await emitNotificationEvent({
        type,
        occurrenceRef,
        scholarId: assignment.scholar_id,
        sessionKind: assignment.session_kind,
        occurrenceDate: easternDateKey(day),
        scheduledStart: match.scheduledStart.toISOString(),
        scheduledEnd: match.scheduledEnd.toISOString(),
      });
    }
  }
}

if (process.argv[1]?.endsWith("reconciliation-detector.js")) {
  runReconciliationDetector().catch((error) => { console.error(error); process.exitCode = 1; });
}
