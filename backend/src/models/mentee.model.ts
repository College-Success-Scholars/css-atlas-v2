import type { ShiftComplianceByKind } from "./session-log.model.js";

/**
 * @file mentee.model.ts
 * @module backend/models
 *
 * TypeScript types for mentee relationship data.
 * MenteeRow represents the shape returned by the get_my_mentees Supabase RPC,
 * which returns scholars assigned to the calling team leader.
 *
 * ## What belongs here
 * - MenteeRow type (shape from get_my_mentees RPC)
 * - MenteeTeamLeaderRow type (mentee_uid → team-leader display name)
 *
 * ## What does NOT belong here
 * - Functions, queries, or runtime logic
 */
export interface MenteeRow {
  scholar_uid: string | null;
  first_name: string | null;
  last_name: string | null;
  fd_required: number | null;
  ss_required: number | null;
}

/** One mentee → team-leader name pair from mentor_mentee + mentor profile. */
export type MenteeTeamLeaderRow = {
  mentee_uid: string | null;
  team_leader_name: string | null;
};

/** Mentee roster row enriched only by the compliance read operation. */
export interface MenteeWithCompliance extends MenteeRow {
  fdCompliance: ShiftComplianceByKind | null;
  ssCompliance: ShiftComplianceByKind | null;
}
