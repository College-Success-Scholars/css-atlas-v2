/**
 * @file meeting-preference.model.ts
 * @module backend/models
 *
 * Types for the per-pair TL<->mentee meeting preference (weekday + program-local
 * time). This is the only new persistent state in the mentee review redesign.
 *
 * ## What belongs here
 * - Row/output/input types and the weekday bounds
 *
 * ## What does NOT belong here
 * - Queries or validation logic (meeting-preference service)
 */

export const WEEKDAY_MIN = 1;
export const WEEKDAY_MAX = 7;

/** Mirrors public.mentee_meeting_preferences (Postgres `time` is "HH:MM:SS"). */
export interface MeetingPreferenceRow {
  mentor_id: string;
  mentee_uid: string;
  weekday: number;
  meeting_time: string;
  created_at: string;
  updated_at: string;
}

/** Normalized preference for the API/clients. */
export interface MeetingPreferenceOutput {
  /** ISO weekday 1-7. */
  weekday: number;
  /** Program-local 24-hour "HH:MM". */
  meetingTime: string;
}

export interface MeetingPreferenceInput {
  weekday: number;
  meetingTime: string;
}
