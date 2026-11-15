/**
 * @file contracts/attendance.ts
 * @module shared/contracts
 *
 * Contract for /api/attendance — Front desk and Study session completion for
 * a Campus Week (minutes computed on read, plus excuses; see ADR 001).
 */
import { z } from "zod";
import { campusWeekNumber, endpoint, scholarId } from "../contract.js";

export const attendanceKind = z.enum(["front_desk", "study_session"]);
export type AttendanceKind = z.infer<typeof attendanceKind>;

export const attendanceWeekBoardRow = z.object({
  scholar_uid: z.string(),
  scholar_name: z.string().nullable(),
  week_num: z.number(),
  kind: attendanceKind,
  mon_min: z.number(),
  tues_min: z.number(),
  wed_min: z.number(),
  thurs_min: z.number(),
  fri_min: z.number(),
  logged_min: z.number(),
  excuse_min: z.number(),
  description: z.string().nullable(),
  required_min: z.number().nullable(),
  /** logged_min + excuse_min */
  effective_min: z.number(),
  completion_pct: z.number().nullable(),
});
export type AttendanceWeekBoardRow = z.infer<typeof attendanceWeekBoardRow>;

export const attendanceWeekBoard = z.object({
  week_num: z.number(),
  week_start: z.string(),
  kind: attendanceKind,
  rows: z.array(attendanceWeekBoardRow),
  summary: z.object({
    scholar_count: z.number(),
    at_or_above_90: z.number(),
    below_75: z.number(),
  }),
});
export type AttendanceWeekBoard = z.infer<typeof attendanceWeekBoard>;
export type AttendanceWeekBoardSummary = AttendanceWeekBoard["summary"];

export const attendanceForUids = z.object({
  week_num: z.number(),
  week_start: z.string(),
  rows: z.array(attendanceWeekBoardRow),
});
export type AttendanceForUids = z.infer<typeof attendanceForUids>;

export const scholarWeekExcuse = z.object({
  scholar_uid: z.string(),
  week_start: z.string(),
  week_num: z.number(),
  kind: attendanceKind,
  excuse_min: z.number().nullable(),
  description: z.string().nullable(),
  updated_by: z.string().nullable(),
  updated_at: z.string(),
});
export type ScholarWeekExcuse = z.infer<typeof scholarWeekExcuse>;

const excuseInput = z
  .object({
    scholar_uid: scholarId,
    week_num: campusWeekNumber,
    kind: attendanceKind,
    excuse_min: z.number().int().min(0).nullable(),
    description: z
      .string()
      .max(2000)
      .nullable()
      .transform((text) => (text?.trim() ? text.trim() : null)),
  })
  .refine((excuse) => !excuse.excuse_min || excuse.description !== null, {
    path: ["description"],
    message: "is required when excuse_min is greater than 0",
  });
export type ExcuseInput = z.output<typeof excuseInput>;

/** GET the week board for one kind: every eligible scholar's minutes, excuse and completion. */
export const getWeekBoard = endpoint({
  method: "GET",
  path: "/api/attendance/week/:week_num",
  access: "team_leader",
  params: z.object({ week_num: campusWeekNumber }),
  query: z.object({ kind: attendanceKind }),
  output: attendanceWeekBoard,
});

/** Front desk and study session rows for a specific set of scholars. */
export const getWeekAttendanceForUids = endpoint({
  method: "POST",
  path: "/api/attendance/week/:week_num/by-uids",
  access: "team_leader",
  params: z.object({ week_num: campusWeekNumber }),
  body: z.object({
    uids: z.array(z.string()).transform((uids) => uids.map((uid) => uid.trim()).filter(Boolean)),
  }),
  output: attendanceForUids,
});

/** Create or replace one scholar's excuse for a campus week and kind. */
export const upsertExcuse = endpoint({
  method: "PATCH",
  path: "/api/attendance/excuse",
  access: "team_leader",
  body: excuseInput,
  output: scholarWeekExcuse,
});
