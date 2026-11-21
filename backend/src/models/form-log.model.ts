/**
 * @file form-log.model.ts
 * @module backend/models
 *
 * TypeScript types for form submission log data.
 * Covers all three form types: MCF (Mentee Check-in Form),
 * WAHF (Weekly Academic Health Form), and WPL (Weekly Performance Log).
 *
 * ## What belongs here
 * - Wire types are re-exported from @css-atlas/shared/contracts/form-logs
 * - Non-wire helper types (FormLogRowWithLate, TeamLeaderNameRecord)
 *
 * ## What does NOT belong here
 * - Functions, queries, or runtime logic
 */

export type {
  ActivityFormType,
  McfFormLogRow,
  RecentFormSubmission,
  TeamLeaderFormStatsRow,
  WahfFormLogRow,
  WplFormLogRow,
} from "@css-atlas/shared/contracts/form-logs";

export type FormLogRowWithLate<T> = T & { isLate: boolean };

export type TeamLeaderNameRecord = {
  uid: string;
  first_name: string | null;
  last_name: string | null;
};
