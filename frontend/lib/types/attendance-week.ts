/** Types for /api/attendance week board and excuse upsert responses. */

export type AttendanceKind = "front_desk" | "study_session";

export interface AttendanceWeekBoardRow {
  scholar_uid: string;
  scholar_name: string | null;
  week_num: number;
  kind: AttendanceKind;
  mon_min: number;
  tues_min: number;
  wed_min: number;
  thurs_min: number;
  fri_min: number;
  logged_min: number;
  excuse_min: number;
  description: string | null;
  required_min: number | null;
  effective_min: number;
  completion_pct: number | null;
}

export interface AttendanceWeekBoardSummary {
  scholar_count: number;
  at_or_above_90: number;
  below_75: number;
}

export interface AttendanceWeekBoard {
  week_num: number;
  week_start: string;
  kind: AttendanceKind;
  rows: AttendanceWeekBoardRow[];
  summary: AttendanceWeekBoardSummary;
}

export interface AttendanceForUids {
  week_num: number;
  week_start: string;
  rows: AttendanceWeekBoardRow[];
}

export interface ScholarWeekExcuse {
  scholar_uid: string;
  week_start: string;
  week_num: number;
  kind: AttendanceKind;
  excuse_min: number | null;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}
