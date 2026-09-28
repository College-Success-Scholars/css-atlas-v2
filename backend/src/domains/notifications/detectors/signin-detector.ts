import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getStartOfDayEastern } from "../../../services/time.service.js";
import { findShiftOccurrenceMatch } from "../../../services/shift-occurrence.service.js";
import { emitNotificationEvent, NotificationEventType } from "../index.js";
import type { NotificationPhase } from "../index.js";
import { dayRange, easternDateKey, fetchAssignmentsForDate, fetchLogsForRange, firstEntryAt, kindLogs, parseNonNegativeInt } from "./detector-data.js";

const TAG = "[signin-detector]";
const LATE_THRESHOLD_MINUTES = parseNonNegativeInt(process.env.SIGNIN_NOTIFICATION_LATE_THRESHOLD_MINUTES, 15);
const ENDED_STALE_MINUTES = parseNonNegativeInt(process.env.SIGNIN_NOTIFICATION_ENDED_STALE_MINUTES, 60);
const MAX_ISSUE_SAMPLES = 10;

const toMinutes = (ms: number) => Math.round(ms / 60_000);

export type SigninDecision =
  | { action: "skip"; reason: "before_late_threshold" | "stale_after_end" }
  | { action: "emit"; phase: NotificationPhase };

// Pure function: intentionally no logging here so it stays trivially testable.
// The caller logs the decision along with the timing values that produced it.
export function decideSigninAction(nowMs: number, lateAtMs: number, endsAtMs: number, staleMinutes: number): SigninDecision {
  if (nowMs < lateAtMs) return { action: "skip", reason: "before_late_threshold" };
  if (nowMs >= endsAtMs) {
    return nowMs > endsAtMs + staleMinutes * 60_000
      ? { action: "skip", reason: "stale_after_end" }
      : { action: "emit", phase: "ended" };
  }
  return { action: "emit", phase: "late" };
}

export async function runSigninDetector(now = new Date()): Promise<void> {
  const runId = randomUUID().slice(0, 8);
  const log = `${TAG}[${runId}]`;
  const startedAt = Date.now();

  const day = getStartOfDayEastern(now);
  const occurrenceDate = easternDateKey(day);
  const outcomes = { sent: 0, skipped: 0, failed: 0, noRecipient: 0 };
  const skips = { beforeLateThreshold: 0, staleAfterEnd: 0, alreadySignedIn: 0 };
  const issueSamples: Array<{ occurrenceRef: string; eventType: NotificationEventType; outcome: string; error: string | null }> = [];
  let emitAttempts = 0;

  console.info(`${log} ▶ run started`, {
    now: now.toISOString(),
    startOfDayEastern: day.toISOString(),
    occurrenceDate,
    config: {
      lateThresholdMinutes: LATE_THRESHOLD_MINUTES,
      endedStaleMinutes: ENDED_STALE_MINUTES,
      lateThresholdEnv: process.env.SIGNIN_NOTIFICATION_LATE_THRESHOLD_MINUTES ?? "(unset, using default)",
      endedStaleEnv: process.env.SIGNIN_NOTIFICATION_ENDED_STALE_MINUTES ?? "(unset, using default)",
    },
  });

  const assignments = await fetchAssignmentsForDate(day);

  const range = dayRange(day);
  const scholarIds = assignments.map((assignment) => assignment.scholar_id);
  const logs = await fetchLogsForRange(range.start, range.end, scholarIds);
  let totalLogRows = 0;
  for (const rows of logs.values()) totalLogRows += rows.length;

  for (const assignment of assignments) {
    const occurrenceRef = `${assignment.id ?? assignment.scholar_id}:${occurrenceDate}`;

    const rows = logs.get(assignment.scholar_id) ?? [];
    const relevantRows = kindLogs(assignment, rows);
    const match = findShiftOccurrenceMatch(assignment, day, relevantRows);

    const lateAtMs = match.scheduledStart.getTime() + LATE_THRESHOLD_MINUTES * 60_000;
    const endsAtMs = match.scheduledEnd.getTime();
    const nowMs = now.getTime();

    const decision = decideSigninAction(nowMs, lateAtMs, endsAtMs, ENDED_STALE_MINUTES);

    // Skip: decision says not to notify
    if (decision.action === "skip") {
      if (decision.reason === "before_late_threshold") {
        skips.beforeLateThreshold += 1;
      } else {
        skips.staleAfterEnd += 1;
      }
      continue;
    }

    // Skip: scholar did sign in
    if (match.entry) {
      skips.alreadySignedIn += 1;
      continue;
    }

    // Emit: scholar is late / missed and has no matching entry
    const type = assignment.session_kind === "front_desk"
      ? NotificationEventType.MISSED_FRONT_DESK
      : NotificationEventType.MISSED_STUDY_SESSION;
    const minutesLate = Math.max(0, toMinutes(nowMs - match.scheduledStart.getTime()));
    const unmatchedEntryAt = firstEntryAt(assignment, rows);

    const payload = {
      type,
      occurrenceRef,
      scholarId: assignment.scholar_id,
      sessionKind: assignment.session_kind,
      occurrenceDate,
      scheduledStart: match.scheduledStart.toISOString(),
      scheduledEnd: match.scheduledEnd.toISOString(),
      phase: decision.phase,
      minutesLate,
      unmatchedEntryAt,
    };

    emitAttempts += 1;
    let outcome: Awaited<ReturnType<typeof emitNotificationEvent>>;
    try {
      outcome = await emitNotificationEvent(payload);
    } catch (error) {
      console.error(`${log} notification emission threw`, { occurrenceRef, type, error });
      throw error;
    }

    if (!outcome) {
      outcomes.noRecipient += 1;
    } else if (outcome.status === "sent") {
      outcomes.sent += 1;
    } else if (outcome.status === "failed") {
      outcomes.failed += 1;
      if (issueSamples.length < MAX_ISSUE_SAMPLES) {
        issueSamples.push({ occurrenceRef, eventType: type, outcome: outcome.status, error: outcome.error });
      }
    } else {
      outcomes.skipped += 1;
    }
  }

  const durationMs = Date.now() - startedAt;
  console.info(`${log} ■ run completed`, {
    occurrenceDate,
    assignments: assignments.length,
    evaluationSkips: skips,
    input: { scholarsWithLogs: logs.size, totalLogRows },
    emitAttempts,
    outcomes,
    issueSamples,
    durationMs,
  });
}

if (/signin-detector\.(js|ts)$/.test(process.argv[1] ?? "")) {
  console.info(`${TAG} invoked directly via CLI (${process.argv[1]})`);
  runSigninDetector().catch((error) => {
    console.error(`${TAG} ✖ run failed`, { error });
    process.exitCode = 1;
  });
}
