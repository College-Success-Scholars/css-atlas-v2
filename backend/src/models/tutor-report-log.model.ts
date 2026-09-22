/**
 * @file tutor-report-log.model.ts
 * @module backend/models
 *
 * TypeScript types for tutor session report log data.
 * Mirrors the shape of the tutor_report_logs Supabase table, which tracks
 * whether scholars attended required tutoring sessions each campus week.
 *
 * ## What belongs here
 * - TutorReportLogRow type for the tutor_report_logs table
 *
 * ## What does NOT belong here
 * - Functions, queries, or runtime logic
 *
 * Prefer `date` (session calendar day) when present. Memo and mentee week
 * filters use `date`, then a parseable `start_time`; not form `created_at`.
 */
export interface TutorReportLogRow {
  id: number;
  created_at: string | null;
  date: string | null;
  tutor_name: string;
  scholar_uid: string | null;
  end_time: string;
  start_time: string;
  courses: string[];
}
