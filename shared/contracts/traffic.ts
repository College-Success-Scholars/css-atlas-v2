/**
 * @file contracts/traffic.ts
 * @module shared/contracts
 *
 * Contract for /api/traffic — front-desk check-in/out entries counted per
 * campus week, used to gauge program activity.
 */
import { campusWeekNumber, endpoint, Schema } from "../contract.js";

/** One check-in paired with its check-out (or an assumed one-hour exit). */
export const trafficSession = Schema.Struct({
  uid: Schema.String,
  entryAt: Schema.String,
  exitAt: Schema.String,
  durationMs: Schema.Number,
  assumedExit: Schema.optional(Schema.Boolean),
});
export type TrafficSession = typeof trafficSession.Type;

export const weekEntryCount = Schema.Struct({
  weekNumber: Schema.Number,
  entryCount: Schema.Number,
});
export type WeekEntryCount = typeof weekEntryCount.Type;

/** Every check-in/out session in a campus week. */
export const getSessionsForWeek = endpoint({
  method: "GET",
  path: "/api/traffic/sessions/:week_num",
  access: "authenticated",
  params: Schema.Struct({ week_num: campusWeekNumber }),
  output: Schema.Array(trafficSession),
});

/** How many entries were logged in a campus week. */
export const getEntryCountForWeek = endpoint({
  method: "GET",
  path: "/api/traffic/entry-count/:week_num",
  access: "authenticated",
  params: Schema.Struct({ week_num: campusWeekNumber }),
  output: Schema.Number,
});

/** Entry counts for several campus weeks, in the order asked. */
export const getEntryCountsForWeeks = endpoint({
  method: "POST",
  path: "/api/traffic/entry-counts",
  access: "authenticated",
  body: Schema.Struct({
    weekNumbers: Schema.Array(Schema.Number),
  }),
  output: Schema.Array(weekEntryCount),
});
