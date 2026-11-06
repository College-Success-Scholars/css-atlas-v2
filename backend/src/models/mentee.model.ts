import type { ShiftComplianceByKind } from "./session-log.model.js";

/**
 * @file mentee.model.ts
 * @module backend/models
 *
 * TypeScript types for mentee relationship data.
 * MenteeRow is the shape mapped from `mentor_mentee` + `user_roster` joins
 * in mentee.service (not the obsolete `get_my_mentees` RPC).
 *
 * ## What belongs here
 * - MenteeRow type (table-query shape from mentor_mentee / user_roster)
 * - MenteeTeamLeaderRow type (mentee_uid → team-leader display name)
 *
 * ## What does NOT belong here
 * - Functions, queries, or runtime logic
 */
export interface MenteeRow {
  scholar_uid: string | null;
  first_name: string | null;
  last_name: string | null;
  /** Roster contact for follow-up drafts; null disables launch. */
  email: string | null;
  /** Entering cohort year for class-year-specific tier thresholds. */
  cohort?: number | null;
  fd_required: number | null;
  ss_required: number | null;
}

/** One mentee → team-leader name pair from mentor_mentee + mentor profile. */
export type MenteeTeamLeaderRow = {
  mentee_uid: string | null;
  team_leader_name: string | null;
};

/**
 * Mentee roster row enriched only by the compliance read operation. Contact
 * and cohort fields are excluded to keep the compliance response unchanged.
 */
export interface MenteeWithCompliance extends Omit<MenteeRow, "email" | "cohort"> {
  fdCompliance: ShiftComplianceByKind | null;
  ssCompliance: ShiftComplianceByKind | null;
}
