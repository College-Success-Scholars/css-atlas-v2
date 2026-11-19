/**
 * @file attendance-week.model.ts
 * @module backend/models
 *
 * Types for campus-week attendance boards and the scholar_week_excuses store.
 * Minutes come from tickets on read; excuses are stored separately from *_records.
 *
 * ## What belongs here
 * - Row / DTO types for scholar_week_excuses and week-board API responses
 * - Shared AttendanceKind and completion helpers’ input shapes
 *
 * ## What does NOT belong here
 * - Queries or HTTP handlers
 */
import type { WeeklyMinutesByDay } from "./weekly-minutes.model.js";
import type { MemoUserRow } from "./user.model.js";
import type { ScholarWithCompletedSession } from "./session-log.model.js";

// Wire shapes are defined once, in the API contract.
import type { ScholarWeekExcuse } from "@css-atlas/shared/contracts/attendance";

export type {
  AttendanceForUids,
  AttendanceKind,
  AttendanceWeekBoard,
  AttendanceWeekBoardRow,
  AttendanceWeekBoardSummary,
} from "@css-atlas/shared/contracts/attendance";

export type ScholarWeekExcuseRow = ScholarWeekExcuse;

export interface CampusWeekAttendanceTotals {
  minutes: WeeklyMinutesByDay;
  loggedMin: number;
  excuseMin: number;
  description: string | null;
}

/** Shared compute-on-read payload for teams boards and Weekly Memo. */
export interface CampusWeekAttendance {
  week_num: number;
  week_start: string;
  users: MemoUserRow[];
  fdByUid: Map<string, CampusWeekAttendanceTotals>;
  ssByUid: Map<string, CampusWeekAttendanceTotals>;
  fdSessions: ScholarWithCompletedSession[];
  ssSessions: ScholarWithCompletedSession[];
}
