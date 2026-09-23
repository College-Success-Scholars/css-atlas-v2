import "dotenv/config";
import { getStartOfDayEastern } from "../../../services/time.service.js";
import { findShiftOccurrenceMatch } from "../../../services/shift-occurrence.service.js";
import { emitNotificationEvent, NotificationEventType } from "../index.js";
import { dayRange, easternDateKey, fetchAssignmentsForDate, fetchLogsForRange, kindLogs } from "./detector-data.js";

const LATE_THRESHOLD_MINUTES = Number(process.env.SIGNIN_NOTIFICATION_LATE_THRESHOLD_MINUTES ?? 25);

export async function runSigninDetector(now = new Date()): Promise<void> {
  const startedAt = Date.now();
  const day = getStartOfDayEastern(now);
  const occurrenceDate = easternDateKey(day);
  const outcomes = { sent: 0, skipped: 0, failed: 0, noRecipient: 0 };

  console.info("[signin-detector] started", {
    now: now.toISOString(),
    occurrenceDate,
    lateThresholdMinutes: LATE_THRESHOLD_MINUTES,
  });

  const assignments = await fetchAssignmentsForDate(day);
  const { start, end } = dayRange(day);
  const logs = await fetchLogsForRange(start, end, assignments.map((assignment) => assignment.scholar_id));

  console.info("[signin-detector] loaded data", {
    occurrenceDate,
    assignments: assignments.length,
    scholarsWithLogs: logs.size,
  });

  for (const assignment of assignments) {
    const match = findShiftOccurrenceMatch(assignment, day, kindLogs(assignment, logs.get(assignment.scholar_id) ?? []));
    const occurrenceRef = `${assignment.id ?? assignment.scholar_id}:${occurrenceDate}`;
    const lateAt = new Date(match.scheduledStart.getTime() + LATE_THRESHOLD_MINUTES * 60_000);

    console.info("[signin-detector] evaluated occurrence", {
      occurrenceRef,
      scholarId: assignment.scholar_id,
      sessionKind: assignment.session_kind,
      scheduledStart: match.scheduledStart.toISOString(),
      scheduledEnd: match.scheduledEnd.toISOString(),
      lateAt: lateAt.toISOString(),
      entryFound: Boolean(match.entry),
    });

    if (now.getTime() < lateAt.getTime()) {
      console.info("[signin-detector] skipped occurrence", { occurrenceRef, reason: "before_late_threshold" });
      continue;
    }
    if (match.entry) {
      console.info("[signin-detector] skipped occurrence", { occurrenceRef, reason: "entry_found" });
      continue;
    }

    const type = assignment.session_kind === "front_desk"
      ? NotificationEventType.MISSED_FRONT_DESK
      : NotificationEventType.MISSED_STUDY_SESSION;
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

    console.info("[signin-detector] notification result", {
      occurrenceRef,
      eventType: type,
      outcome: outcome?.status ?? "skipped_no_unique_recipient",
      attemptCount: outcome?.attemptCount ?? 0,
      error: outcome?.error ?? null,
    });
  }

  console.info("[signin-detector] completed", {
    occurrenceDate,
    assignments: assignments.length,
    outcomes,
    durationMs: Date.now() - startedAt,
  });
}

if (/signin-detector\.(js|ts)$/.test(process.argv[1] ?? "")) {
  runSigninDetector().catch((error) => {
    console.error("[signin-detector] failed", { error });
    process.exitCode = 1;
  });
}
