/**
 * @file user.model.ts
 * @module backend/models
 *
 * TypeScript types and constants for user and scholar data.
 * Covers the merged profile shape (profiles + user_roster), the app role
 * hierarchy constant, and derived display types for memo and team leader views.
 *
 * ## What belongs here
 * - Types derived from Supabase profiles and user_roster tables
 * - Re-exports APP_ROLE_ORDER from shared (canonical role hierarchy for access control)
 * - Computed/derived user shapes (MemoUserRow, TeamLeaderRow)
 *
 * ## What does NOT belong here
 * - Functions or runtime logic
 * - Supabase client imports
 */

/** Profile / merged API shape. `student_id` matches Postgres `text` (see database.types). */
export type ProfilesRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  program_role: string | null;
  app_role?: string | null;
  teams: string[] | null;
  emails: string[] | null;
  student_id: string | null;
  [key: string]: unknown;
};

// auth.middleware.ts reaches this file before any other backend code that uses `effect`.
// Loading domain-error first makes the type checker keep the backend's copy of `effect`
// instead of the shared package's; without it the contract re-exports below fail with TS2742.
import type {} from "../utils/domain-error.js";

export { APP_ROLE_ORDER, type AppRole } from "@css-atlas/shared/auth";

export type {
  DirectoryFacets,
  DirectoryFlatResponse,
  DirectoryGroup,
  DirectoryGroupedResponse,
  DirectoryPagination,
  DirectoryPerson,
  DirectoryResponse,
  MemoUserRow,
  TeamLeaderRow,
} from "@css-atlas/shared/contracts/users";

export type RosterRow = {
  id: number;
  uid: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  email: string | null;
  cohort: number | null;
  status: string | null;
  app_role: string | null;
  program_role: string | null;
  fd_required: number | null;
  ss_required: number | null;
  mentee_count: number | null;
  majors: string[] | null;
  minors: string[] | null;
  mentee_uids: string[] | null;
  teams: string[] | null;
  invite_accepted_at: string | null;
  invite_sent_at: string | null;
};

export type RosterPatch = {
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  cohort?: number | null;
  status?: string | null;
  program_role?: string | null;
  fd_required?: number | null;
  ss_required?: number | null;
  majors?: string[] | null;
  minors?: string[] | null;
  teams?: string[] | null;
  mentee_uids?: string[] | null;
};

export type DirectoryView = "flat" | "grouped";
export type DirectorySort = "asc" | "desc";

export type DirectoryQuery = {
  view: DirectoryView;
  search: string;
  sort: DirectorySort;
  teams: ReadonlyArray<string>;
  programRoles: ReadonlyArray<string>;
  cohorts: ReadonlyArray<number>;
  limit: number;
  cursor: string | null;
  /** A single team group to page after it has been expanded. */
  group: string | null;
};
