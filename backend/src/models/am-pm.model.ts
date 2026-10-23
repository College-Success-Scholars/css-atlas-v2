/**
 * @file am-pm.model.ts
 * @module backend/models
 *
 * TypeScript types for the Front Desk AM/PM checklist (`am_pm_form_logs`).
 * Intake is a Google Form writing straight to Supabase; the app reads and
 * enriches only.
 *
 * ## What belongs here
 * - The raw row type for am_pm_form_logs
 * - The enriched DTO the frontend consumes
 *
 * ## What does NOT belong here
 * - Functions, queries, or runtime logic (see services/am-pm.service.ts)
 * - The shift timing rule (see shared/front-desk-ampm-config.ts)
 */

/** Raw `am_pm_form_logs` row. Every column is nullable in Postgres. */
export type AmPmFormLogRow = {
  id: number;
  uid: string | null;
  shift: string | null;
  created_at: string | null;
  leader_name: string | null;
  task_completion: unknown;
};

/** A free-text `leader_name` resolved to a roster person. */
export type AmPmLeaderMatch = {
  uid: string;
  displayName: string;
};

/**
 * One enriched checklist submission, camelCase for the frontend route shape.
 *
 * `shiftValid` is the only timing verdict — submitted during the claimed shift,
 * allowing the configured grace after it ends. `reminderOwed` is its inverse.
 */
export type AmPmChecklistDto = {
  id: number;
  scholarUid: string | null;
  scholarName: string | null;
  shift: string | null;
  submittedAt: string | null;
  leaderName: string | null;
  leaderMatch: AmPmLeaderMatch | null;
  tasksCompleted: number;
  tasksTotal: number;
  shiftValid: boolean;
  reminderOwed: boolean;
};
