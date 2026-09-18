import type { ShiftSessionKind } from "../../models/session-log.model.js";

export const NotificationEventType = {
  MISSED_STUDY_SESSION: "missed_study_session",
  MISSED_FRONT_DESK: "missed_front_desk",
  INCOMPLETE_STUDY_SESSION: "incomplete_study_session",
  INCOMPLETE_FRONT_DESK: "incomplete_front_desk",
} as const;

export type NotificationEventType = typeof NotificationEventType[keyof typeof NotificationEventType];
export type NotificationStatus = "sent" | "skipped_missing_slack_id" | "failed";

export interface NotificationEvent {
  type: NotificationEventType;
  occurrenceRef: string;
  scholarId: string;
  sessionKind: ShiftSessionKind;
  occurrenceDate: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface NotificationRecipient {
  id: string;
  slackUserId: string | null;
  name: string | null;
}

export interface RenderedNotification {
  text: string;
}

export interface NotificationOutcome {
  status: NotificationStatus;
  error: string | null;
  attemptCount: number;
}
