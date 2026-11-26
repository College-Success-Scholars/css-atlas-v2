/**
 * @file contracts/attendance.ts
 * @module shared/contracts
 *
 * Contract for /api/attendance — Front desk and Study session completion for
 * a Campus Week (minutes computed on read, plus excuses; see ADR 001).
 */
import { campusWeekNumber, endpoint, Schema, SchemaTransformation, scholarId } from "../contract.js";

const nonNegativeInt = Schema.Number.check(
  Schema.isInt({ message: "must be a whole number" }),
  Schema.isGreaterThanOrEqualTo(0, { message: "must be 0 or more" }),
);

export const attendanceKind = Schema.Literals(["front_desk", "study_session"]).annotate({
  message: "must be front_desk or study_session",
});
export type AttendanceKind = typeof attendanceKind.Type;

export const attendanceWeekBoardRow = Schema.Struct({
  scholar_uid: scholarId,
  scholar_name: Schema.NullOr(Schema.String),
  week_num: campusWeekNumber,
  kind: attendanceKind,
  mon_min: Schema.Number,
  tues_min: Schema.Number,
  wed_min: Schema.Number,
  thurs_min: Schema.Number,
  fri_min: Schema.Number,
  logged_min: Schema.Number,
  /** 0 on the board when the scholar has no excuse for the week. */
  excuse_min: nonNegativeInt,
  description: Schema.NullOr(Schema.String),
  required_min: Schema.NullOr(Schema.Number),
  /** logged_min + excuse_min */
  effective_min: Schema.Number,
  completion_pct: Schema.NullOr(Schema.Number),
});
export type AttendanceWeekBoardRow = typeof attendanceWeekBoardRow.Type;

export const attendanceWeekBoard = Schema.Struct({
  week_num: campusWeekNumber,
  week_start: Schema.String,
  kind: attendanceKind,
  rows: Schema.Array(attendanceWeekBoardRow),
  summary: Schema.Struct({
    scholar_count: nonNegativeInt,
    at_or_above_90: nonNegativeInt,
    below_75: nonNegativeInt,
  }),
});
export type AttendanceWeekBoard = typeof attendanceWeekBoard.Type;
export type AttendanceWeekBoardSummary = AttendanceWeekBoard["summary"];

export const attendanceForUids = Schema.Struct({
  week_num: campusWeekNumber,
  week_start: Schema.String,
  rows: Schema.Array(attendanceWeekBoardRow),
});
export type AttendanceForUids = typeof attendanceForUids.Type;

export const scholarWeekExcuse = Schema.Struct({
  scholar_uid: scholarId,
  week_start: Schema.String,
  week_num: campusWeekNumber,
  kind: attendanceKind,
  /** Null when the excuse has been cleared. */
  excuse_min: Schema.NullOr(nonNegativeInt),
  description: Schema.NullOr(Schema.String),
  updated_by: Schema.NullOr(Schema.String),
  updated_at: Schema.String,
});
export type ScholarWeekExcuse = typeof scholarWeekExcuse.Type;

/** Trimmed text, with blank text becoming null. */
const optionalText = Schema.NullOr(
  Schema.String.check(Schema.isMaxLength(2000, { message: "must be 2000 characters or fewer" })),
).pipe(
  Schema.decodeTo(
    Schema.NullOr(Schema.String),
    SchemaTransformation.transform({
      decode: (text: string | null) => (text?.trim() ? text.trim() : null),
      encode: (text: string | null) => text,
    }),
  ),
);

/**
 * Create, replace or clear one scholar's excuse for a campus week and kind.
 * `excuse_min` of null or 0 clears it; positive minutes require a description.
 * Exported so forms can run the same validation before submitting.
 */
export const excuseInput = Schema.Struct({
  scholar_uid: scholarId,
  week_num: campusWeekNumber,
  kind: attendanceKind,
  excuse_min: Schema.NullOr(nonNegativeInt),
  description: optionalText,
}).check(
  Schema.makeFilter((excuse) =>
    !excuse.excuse_min || excuse.description !== null
      ? undefined
      : { path: ["description"], issue: "is required when excuse_min is greater than 0" },
  ),
);
export type ExcuseInput = typeof excuseInput.Type;

/** A batch of Scholar IDs: trimmed, blanks removed, 1–500 entries. */
export const uidsBatchInput = Schema.Struct({
  uids: Schema.Array(Schema.String).pipe(
    Schema.decodeTo(
      Schema.Array(scholarId).check(
        Schema.isMinLength(1, { message: "must contain at least one scholar UID" }),
        Schema.isMaxLength(500, { message: "cannot contain more than 500 scholar UIDs" }),
      ),
      SchemaTransformation.transform<ReadonlyArray<string>, ReadonlyArray<string>>({
        decode: (uids) => uids.map((uid) => uid.trim()).filter(Boolean),
        encode: (uids) => uids,
      }),
    ),
  ),
});
export type UidsBatchInput = typeof uidsBatchInput.Type;

/** GET the week board for one kind: every eligible scholar's minutes, excuse and completion. */
export const getWeekBoard = endpoint({
  method: "GET",
  path: "/api/attendance/week/:week_num",
  access: "team_leader",
  params: Schema.Struct({ week_num: campusWeekNumber }),
  query: Schema.Struct({ kind: attendanceKind }),
  output: attendanceWeekBoard,
});

/** Front desk and study session rows for a specific set of scholars. */
export const getWeekAttendanceForUids = endpoint({
  method: "POST",
  path: "/api/attendance/week/:week_num/by-uids",
  access: "team_leader",
  params: Schema.Struct({ week_num: campusWeekNumber }),
  body: uidsBatchInput,
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
