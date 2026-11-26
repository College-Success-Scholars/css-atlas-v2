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
// Wire shape is defined once, in the API contract.
export type { MenteeRow } from "@css-atlas/shared/contracts/mentees";

/** One mentee → team-leader name pair from mentor_mentee + mentor profile. */
export type MenteeTeamLeaderRow = {
  mentee_uid: string | null;
  team_leader_name: string | null;
};
