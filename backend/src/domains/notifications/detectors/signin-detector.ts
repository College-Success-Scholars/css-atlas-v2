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

  // ---- Step 1: load assignments ------------------------------------------
  console.debug(`${log} [1/3] fetching assignments for ${occurrenceDate}...`);
  const assignments = await fetchAssignmentsForDate(day);
  console.info(`${log} [1/3] fetched ${assignments.length} assignment(s)`, {
    byKind: assignments.reduce<Record<string, number>>((acc, a) => {
      acc[a.session_kind] = (acc[a.session_kind] ?? 0) + 1;
      return acc;
    }, {}),
  });

  if (assignments.length === 0) {
    console.warn(`${log} no assignments found for ${occurrenceDate}; nothing to check (is this a day with no shifts?)`);
  }

  // ---- Step 2: load sign-in logs -----------------------------------------
  const range = dayRange(day);
  const scholarIds = assignments.map((assignment) => assignment.scholar_id);
  console.debug(`${log} [2/3] fetching sign-in logs`, {
    rangeStart: range.start,
    rangeEnd: range.end,
    scholarCount: scholarIds.length,
  });
  const logs = await fetchLogsForRange(range.start, range.end, scholarIds);
  let totalLogRows = 0;
  for (const rows of logs.values()) totalLogRows += rows.length;
  console.info(`${log} [2/3] fetched logs`, {
    scholarsWithLogs: logs.size,
    scholarsRequested: scholarIds.length,
    totalLogRows,
  });

  // ---- Step 3: evaluate each assignment ----------------------------------
  console.debug(`${log} [3/3] evaluating ${assignments.length} assignment(s)...`);
  let index = 0;

  for (const assignment of assignments) {
    index += 1;
    const occurrenceRef = `${assignment.id ?? assignment.scholar_id}:${occurrenceDate}`;
    const alog = `${log}[${index}/${assignments.length}][${occurrenceRef}]`;

    const rows = logs.get(assignment.scholar_id) ?? [];
    const relevantRows = kindLogs(assignment, rows);
    const match = findShiftOccurrenceMatch(assignment, day, relevantRows);

    const lateAtMs = match.scheduledStart.getTime() + LATE_THRESHOLD_MINUTES * 60_000;
    const endsAtMs = match.scheduledEnd.getTime();
    const nowMs = now.getTime();

    console.debug(`${alog} evaluating`, {
      scholarId: assignment.scholar_id,
      sessionKind: assignment.session_kind,
      logRowsForScholar: rows.length,
      logRowsForThisKind: relevantRows.length,
      scheduledStart: match.scheduledStart.toISOString(),
      scheduledEnd: match.scheduledEnd.toISOString(),
      lateAt: new Date(lateAtMs).toISOString(),
      matchedEntry: match.entry ?? null,
    });

    const decision = decideSigninAction(nowMs, lateAtMs, endsAtMs, ENDED_STALE_MINUTES);

    // Skip: decision says not to notify
    if (decision.action === "skip") {
      if (decision.reason === "before_late_threshold") {
        skips.beforeLateThreshold += 1;
        console.debug(`${alog} ⏭ SKIP (${decision.reason}): late threshold not reached yet`, {
          minutesUntilLate: toMinutes(lateAtMs - nowMs),
          signedIn: Boolean(match.entry),
        });
      } else {
        skips.staleAfterEnd += 1;
        console.debug(`${alog} ⏭ SKIP (${decision.reason}): shift ended too long ago to notify`, {
          minutesSinceEnd: toMinutes(nowMs - endsAtMs),
          staleCutoffMinutes: ENDED_STALE_MINUTES,
          signedIn: Boolean(match.entry),
        });
      }
      continue;
    }

    // Skip: scholar did sign in
    if (match.entry) {
      skips.alreadySignedIn += 1;
      console.debug(`${alog} ⏭ SKIP (already_signed_in): decision was "${decision.phase}" but a matching entry exists`, {
        matchedEntry: match.entry,
      });
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
    console.info(`${alog} 📣 EMIT (${decision.phase}): no matching sign-in, ${minutesLate} min late`, {
      ...payload,
      hasUnmatchedEntry: Boolean(unmatchedEntryAt),
    });

    let outcome: Awaited<ReturnType<typeof emitNotificationEvent>>;
    try {
      outcome = await emitNotificationEvent(payload);
    } catch (error) {
      // Log with context, then rethrow so behavior is unchanged (run still aborts).
      console.error(`${alog} 💥 emitNotificationEvent threw`, { payload, error });
      throw error;
    }

    if (!outcome) {
      outcomes.noRecipient += 1;
      console.warn(`${alog} ⚠ no recipient resolved; nothing was sent`, { type, scholarId: assignment.scholar_id });
    } else if (outcome.status === "sent") {
      outcomes.sent += 1;
      console.info(`${alog} ✅ sent`, { outcome });
    } else if (outcome.status === "failed") {
      outcomes.failed += 1;
      console.error(`${alog} ❌ failed to send`, { outcome });
    } else {
      outcomes.skipped += 1;
      console.info(`${alog} ⏭ notification service skipped it (status="${outcome.status}")`, { outcome });
    }
  }

  const durationMs = Date.now() - startedAt;
  console.info(`${log} ■ run completed`, {
    occurrenceDate,
    assignments: assignments.length,
    evaluationSkips: skips,
    emitAttempts,
    outcomes,
    durationMs,
  });

  if (outcomes.failed > 0) {
    console.warn(`${log} ${outcomes.failed} notification(s) failed this run; check the ❌ lines above`);
  }
}

if (/signin-detector\.(js|ts)$/.test(process.argv[1] ?? "")) {
  console.info(`${TAG} invoked directly via CLI (${process.argv[1]})`);
  runSigninDetector().catch((error) => {
    console.error(`${TAG} ✖ run failed`, { error });
    process.exitCode = 1;
  });
}