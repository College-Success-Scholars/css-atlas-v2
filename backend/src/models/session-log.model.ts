/**
 * @file session-log.model.ts
 * @module backend/models
 *
 * TypeScript types for raw session check-in/out log data.
 * Mirrors the shape of the study_session_logs and front_desk_logs Supabase tables.
 *
 * ## What belongs here
 * - Row types for front_desk_logs and study_session_logs tables
 * - Session type constants (SESSION_TYPE_STUDY, SESSION_TYPE_FRONT_DESK, etc.)
 * - Computed/cleaned session pair types (CleanedSession, ErroredSession)
 *
 * ## What does NOT belong here
 * - Functions, queries, or runtime logic
 */

import type {
  ProcessedTicket,
  ScholarWithCompletedSession,
} from "@css-atlas/shared/contracts/session-logs";

export type {
  ProcessedTicket,
  ScholarInRoom,
  ScholarNoShow,
  ScholarWithCompletedSession,
  SessionLogRow,
  TicketErrorType,
} from "@css-atlas/shared/contracts/session-logs";

export const SESSION_TYPE_STUDY = "Study Session";
export const SESSION_TYPE_FRONT_DESK = "Front Desk";

export type SessionType = typeof SESSION_TYPE_STUDY | typeof SESSION_TYPE_FRONT_DESK;

export const SESSION_TYPES: SessionType[] = [
  SESSION_TYPE_STUDY,
  SESSION_TYPE_FRONT_DESK,
];

export interface SessionLogConfig {
  entryAction: string;
  exitAction: string;
}

export const DEFAULT_SESSION_CONFIG: SessionLogConfig = {
  entryAction: "Entry",
  exitAction: "Exit",
};

export interface CleanedAndErroredResult {
  byScholarUid: Map<
    string,
    {
      cleaned: ProcessedTicket[];
      errored: ProcessedTicket[];
      scholarName: string | null;
    }
  >;
  allCleaned: ProcessedTicket[];
  allErrored: ProcessedTicket[];
}

export interface FrontDeskLogRow {
  id: string;
  created_at: string;
  rep_name: string | null;
  scholar_uid: string | null;
  action_type: string | null;
  session_type: string | null;
  submitted_by_email: string | null;
}

export interface StudySessionLogRow {
  id: string;
  created_at: string;
  rep_name: string | null;
  scholar_uid: string | null;
  action_type: string | null;
  session_type: string | null;
  submitted_by_email: string | null;
}

export interface DoubleEntry {
  scholarId: string;
  scholarName: string | null;
  studySession: ScholarWithCompletedSession;
  frontDeskSession: ScholarWithCompletedSession;
  overlapMs: number;
  overlapStart: string;
  overlapEnd: string;
}

export const SHIFT_GRACE_MINUTES = 15;

export type ShiftSessionKind = "front_desk" | "study_session";

export interface ScholarShiftAssignment {
  id?: string;
  scholar_id: string;
  /** DB column is integer; JSON may arrive as number or string. */
  semester_id: string | number;
  session_kind: ShiftSessionKind;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface ShiftComplianceDateRange {
  startDate: Date;
  endDate: Date;
}

export interface ShiftComplianceSession {
  entryAt: string;
  exitAt: string;
  insideMinutes: number;
  outsideMinutes: number;
}

export interface ShiftCompliancePerDate {
  date: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  insideMinutes: number;
  outsideMinutes: number;
  noShow: boolean;
  unscheduled: boolean;
  sessions: ShiftComplianceSession[];
}

export interface ShiftComplianceByKind {
  insideMinutes: number;
  outsideMinutes: number;
  noShowCount: number;
  dates: ShiftCompliancePerDate[];
}

export interface ScholarShiftCompliance {
  fdCompliance: ShiftComplianceByKind;
  ssCompliance: ShiftComplianceByKind;
}
