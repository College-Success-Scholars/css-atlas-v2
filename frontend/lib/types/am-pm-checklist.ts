/**
 * @file am-pm-checklist.ts
 * @module frontend/lib/types
 *
 * Row shape for the Front Desk AM/PM checklist board.
 * Mirrors the DTO the Stage 3 API will return (camelCase, not raw Postgres),
 * so wiring the live fetch in Stage 4 does not change the table's props.
 */

/** A `leader_name` from the form resolved to a real roster person. */
export type AmPmLeaderMatch = {
  uid: string;
  displayName: string;
};

/**
 * One AM/PM checklist submission, enriched.
 *
 * Nullable fields mirror `am_pm_form_logs`, where every column is nullable.
 * `shiftValid` is the only timing verdict — see shared/front-desk-ampm-config.ts.
 */
export type AmPmChecklistRow = {
  id: number;
  scholarUid: string | null;
  scholarName: string | null;
  /** Raw form value; one of the configured shift labels, or something unexpected. */
  shift: string | null;
  /** ISO timestamp of submission (`created_at`). */
  submittedAt: string | null;
  /** Free-text leader name as typed into the form. */
  leaderName: string | null;
  /** Fuzzy match against the roster, or null when no confident match. */
  leaderMatch: AmPmLeaderMatch | null;
  tasksCompleted: number;
  tasksTotal: number;
  /** Submitted during the claimed shift (plus grace)? */
  shiftValid: boolean;
  /** Currently `!shiftValid`; drives the deferred reminder mailer. */
  reminderOwed: boolean;
};
