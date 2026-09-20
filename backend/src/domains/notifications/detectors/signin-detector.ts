import "dotenv/config";
import { getStartOfDayEastern } from "../../../services/time.service.js";
import { findShiftOccurrenceMatch } from "../../../services/shift-occurrence.service.js";
import { emitNotificationEvent, NotificationEventType } from "../index.js";
import { dayRange, easternDateKey, fetchAssignmentsForDate, fetchLogsForRange, kindLogs } from "./detector-data.js";

const LATE_THRESHOLD_MINUTES = Number(process.env.SIGNIN_NOTIFICATION_LATE_THRESHOLD_MINUTES ?? 25);

export async function runSigninDetector(now = new Date()): Promise<void> {
  const day = getStartOfDayEastern(now);
  const assignments = await fetchAssignmentsForDate(day);
  const { start, end } = dayRange(day);
  const logs = await fetchLogsForRange(start, end, assignments.map((assignment) => assignment.scholar_id));
  for (const assignment of assignments) {
    const match = findShiftOccurrenceMatch(assignment, day, kindLogs(assignment, logs.get(assignment.scholar_id) ?? []));
    if (now.getTime() < match.scheduledStart.getTime() + LATE_THRESHOLD_MINUTES * 60_000 || match.entry) continue;
    const type = assignment.session_kind === "front_desk"
      ? NotificationEventType.MISSED_FRONT_DESK
      : NotificationEventType.MISSED_STUDY_SESSION;
    await emitNotificationEvent({
      type,
      occurrenceRef: `${assignment.id ?? assignment.scholar_id}:${easternDateKey(day)}`,
      scholarId: assignment.scholar_id,
      sessionKind: assignment.session_kind,
      occurrenceDate: easternDateKey(day),
      scheduledStart: match.scheduledStart.toISOString(),
      scheduledEnd: match.scheduledEnd.toISOString(),
    });
  }
}

if (process.argv[1]?.endsWith("signin-detector.js")) {
  runSigninDetector().catch((error) => { console.error(error); process.exitCode = 1; });
}
