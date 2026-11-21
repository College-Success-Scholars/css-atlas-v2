/**
 * @file meeting-preference.model.ts
 * @module backend/models
 *
 * Types for the per-pair TL<->mentee meeting preference (weekday + program-local
 * time). This is the only new persistent state in the mentee review redesign.
 *
 * ## What belongs here
 * - The table row type, and the contract's input/output types
 *
 * ## What does NOT belong here
 * - Queries or validation logic (meeting-preference service)
 */

/** Mirrors public.mentee_meeting_preferences (Postgres `time` is "HH:MM:SS"). */
export interface MeetingPreferenceRow {
  mentor_id: string;
  mentee_uid: string;
  weekday: number;
  meeting_time: string;
  created_at: string;
  updated_at: string;
}

// Wire shapes are defined once, in the API contract.
export type { MeetingPreferenceInput, MeetingPreferenceOutput } from "@css-atlas/shared/contracts/mentees";
