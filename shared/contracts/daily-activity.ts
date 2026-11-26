/**
 * @file contracts/daily-activity.ts
 * @module shared/contracts
 *
 * Contract for /api/daily-activity — per-day activity minutes for a scholar,
 * derived from session logs.
 */
import { campusWeekNumber, endpoint, Schema, scholarId } from "../contract.js";

/** Total minutes a mentee logged in a campus week for one log source (front_desk or study_session). */
export const getMinutes = endpoint({
  method: "GET",
  path: "/api/daily-activity/minutes",
  access: "authenticated",
  query: Schema.Struct({
    menteeUid: scholarId,
    weekNum: campusWeekNumber,
    logSource: Schema.String.check(Schema.isMinLength(1, { message: "is required" })),
  }),
  output: Schema.Number,
});
