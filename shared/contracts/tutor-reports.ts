/**
 * @file contracts/tutor-reports.ts
 * @module shared/contracts
 *
 * Contract for /api/tutor-reports — recorded tutoring sessions from the
 * tutor report form. Week assignment uses the session date, not created_at.
 */
import { campusWeekNumber, endpoint, rowId, Schema } from "../contract.js";

export const tutorReportLogRow = Schema.Struct({
  id: Schema.Number,
  created_at: Schema.NullOr(Schema.String),
  date: Schema.NullOr(Schema.String),
  tutor_name: Schema.String,
  scholar_uid: Schema.NullOr(Schema.String),
  end_time: Schema.String,
  start_time: Schema.String,
  courses: Schema.Array(Schema.String),
});
export type TutorReportLogRow = typeof tutorReportLogRow.Type;

/** A week row: `scholar_name` is "EMPTY SESSION" for the empty-session uids `n/a` and `111111111`. */
export const tutorReportWeekRow = Schema.Struct({
  ...tutorReportLogRow.fields,
  scholar_name: Schema.String,
  day_of_week: Schema.String,
});
export type TutorReportWeekRow = typeof tutorReportWeekRow.Type;

/** Every recorded tutoring session in a campus week, with scholar names resolved. */
export const getWeek = endpoint({
  method: "GET",
  path: "/api/tutor-reports/week/:week_num",
  access: "team_leader",
  params: Schema.Struct({ week_num: campusWeekNumber }),
  output: Schema.Array(tutorReportWeekRow),
});

/** Remove one tutor report. Blocked while a developer is acting as a test profile. */
export const remove = endpoint({
  method: "DELETE",
  path: "/api/tutor-reports/:id",
  access: "team_leader",
  params: Schema.Struct({ id: rowId }),
  output: Schema.Struct({ id: Schema.Number }),
});
