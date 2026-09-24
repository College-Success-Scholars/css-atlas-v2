import type { ShiftSessionKind } from "../../models/session-log.model.js";

export const NotificationEventType = {
  MISSED_STUDY_SESSION: "missed_study_session",
  MISSED_FRONT_DESK: "missed_front_desk",
  INCOMPLETE_STUDY_SESSION: "incomplete_study_session",
  INCOMPLETE_FRONT_DESK: "incomplete_front_desk",
} as const;

export type NotificationEventType = typeof NotificationEventType[keyof typeof NotificationEventType];
export type NotificationStatus = "sent" | "skipped_missing_slack_id" | "skipped_duplicate" | "failed";
export type NotificationPhase = "late" | "ended";
export type RecipientReason = "mentor" | "fallback_no_mentor" | "fallback_multiple_mentors" | "fallback_no_slack_id";

export interface NotificationEvent {
  type: NotificationEventType;
  occurrenceRef: string;
  scholarId: string;
  sessionKind: ShiftSessionKind;
  occurrenceDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  phase?: NotificationPhase;
  minutesLate?: number;
  entryAt?: string;
  unmatchedEntryAt?: string;
}

export interface NotificationRecipient {
  id: string;
  slackUserId: string | null;
  name: string | null;
  reason?: RecipientReason;
}

export interface RenderedNotification {
  text: string;
  blocks?: unknown[];
}

export interface NotificationOutcome {
  status: NotificationStatus;
  error: string | null;
  attemptCount: number;
}
