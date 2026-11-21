/**
 * @file contracts/session-logs.ts
 * @module shared/contracts
 *
 * Contract for /api/session-logs — raw Front Desk and Study Session check-in
 * and check-out logs, their cleaned/errored pairs, who is in the room, completed
 * sessions, and today's no-shows.
 */
import { endpoint, Schema } from "../contract.js";

/** Optional ISO timestamps; text that is not a valid date is ignored by the handler. */
const optionalText = Schema.optional(Schema.NullOr(Schema.String));

/** Which logs to read: a date range and/or scholars (the service requires at least one). */
const logRange = {
  startDate: optionalText,
  endDate: optionalText,
  scholarUids: Schema.optional(Schema.Array(Schema.String)),
  sessionType: Schema.optional(Schema.String),
};

export const logRangeInput = Schema.Struct(logRange);

export const cleanedInput = Schema.Struct({
  ...logRange,
  treatUnclosedEntryAsError: Schema.optional(Schema.Boolean),
});

export const inRoomInput = Schema.Struct({ ...logRange, asOf: optionalText });

/** One check-in/out log entry. Extra columns (rep_name, submitted_by_email, ...) pass through. */
export const sessionLogRow = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    created_at: Schema.String,
    scholar_uid: Schema.NullOr(Schema.String),
    scholar_name: Schema.optional(Schema.NullOr(Schema.String)),
    action_type: Schema.NullOr(Schema.String),
    session_type: Schema.optional(Schema.NullOr(Schema.String)),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export type SessionLogRow = typeof sessionLogRow.Type;

export const ticketErrorType = Schema.Literals([
  "DOUBLE_EXIT",
  "DOUBLE_ENTER",
  "EXIT_BEFORE_ENTER",
  "EXIT_WITHOUT_ENTER",
  "ENTRY_WITHOUT_SAME_DAY_EXIT",
]);
export type TicketErrorType = typeof ticketErrorType.Type;

export const processedTicket = Schema.Struct({
  ticket: sessionLogRow,
  error: Schema.optional(ticketErrorType),
  pairedEntryAt: Schema.optional(Schema.String),
});
export type ProcessedTicket = typeof processedTicket.Type;

/** A scholar's cleaned and errored tickets. */
export const cleanedAndErroredScholar = Schema.Struct({
  cleaned: Schema.Array(processedTicket),
  errored: Schema.Array(processedTicket),
  scholarName: Schema.NullOr(Schema.String),
});
export type CleanedAndErroredScholar = typeof cleanedAndErroredScholar.Type;

/** `byScholarUid` is a record keyed by Scholar ID. */
export const cleanedAndErrored = Schema.Struct({
  byScholarUid: Schema.Record(Schema.String, cleanedAndErroredScholar),
  allCleaned: Schema.Array(processedTicket),
  allErrored: Schema.Array(processedTicket),
});
export type CleanedAndErrored = typeof cleanedAndErrored.Type;

export const scholarInRoom = Schema.Struct({
  scholarId: Schema.String,
  scholarName: Schema.NullOr(Schema.String),
  entryTicket: sessionLogRow,
  entryAt: Schema.String,
  timeInRoomMs: Schema.Number,
  sessionType: Schema.optional(Schema.NullOr(Schema.String)),
});
export type ScholarInRoom = typeof scholarInRoom.Type;

export const scholarWithCompletedSession = Schema.Struct({
  scholarId: Schema.String,
  scholarName: Schema.NullOr(Schema.String),
  entryTicket: sessionLogRow,
  exitTicket: sessionLogRow,
  entryAt: Schema.String,
  exitAt: Schema.String,
  durationMs: Schema.Number,
  sessionType: Schema.optional(Schema.NullOr(Schema.String)),
});
export type ScholarWithCompletedSession = typeof scholarWithCompletedSession.Type;

export const scholarNoShow = Schema.Struct({
  scholarId: Schema.String,
  scholarName: Schema.String,
  phoneNumber: Schema.NullOr(Schema.String),
  /** ISO start of the missed shift occurrence (Eastern wall clock). */
  scheduledStart: Schema.String,
  /** ISO end of the missed shift occurrence (Eastern wall clock). */
  scheduledEnd: Schema.String,
});
export type ScholarNoShow = typeof scholarNoShow.Type;

// Front desk

export const getFrontDeskNoShows = endpoint({
  method: "GET",
  path: "/api/session-logs/front-desk/no-shows",
  access: "team_leader",
  output: Schema.Array(scholarNoShow),
});

export const getFrontDeskLogs = endpoint({
  method: "POST",
  path: "/api/session-logs/front-desk",
  access: "authenticated",
  body: logRangeInput,
  output: Schema.Array(sessionLogRow),
});

export const getFrontDeskCleaned = endpoint({
  method: "POST",
  path: "/api/session-logs/front-desk/cleaned",
  access: "authenticated",
  body: cleanedInput,
  output: cleanedAndErrored,
});

export const getFrontDeskInRoom = endpoint({
  method: "POST",
  path: "/api/session-logs/front-desk/in-room",
  access: "authenticated",
  body: inRoomInput,
  output: Schema.Array(scholarInRoom),
});

export const getFrontDeskCompleted = endpoint({
  method: "POST",
  path: "/api/session-logs/front-desk/completed",
  access: "authenticated",
  body: logRangeInput,
  output: Schema.Array(scholarWithCompletedSession),
});

// Study session

export const getStudyNoShows = endpoint({
  method: "GET",
  path: "/api/session-logs/study/no-shows",
  access: "team_leader",
  output: Schema.Array(scholarNoShow),
});

export const getStudyLogs = endpoint({
  method: "POST",
  path: "/api/session-logs/study",
  access: "authenticated",
  body: logRangeInput,
  output: Schema.Array(sessionLogRow),
});

export const getStudyCleaned = endpoint({
  method: "POST",
  path: "/api/session-logs/study/cleaned",
  access: "authenticated",
  body: cleanedInput,
  output: cleanedAndErrored,
});

export const getStudyInRoom = endpoint({
  method: "POST",
  path: "/api/session-logs/study/in-room",
  access: "authenticated",
  body: inRoomInput,
  output: Schema.Array(scholarInRoom),
});

export const getStudyCompleted = endpoint({
  method: "POST",
  path: "/api/session-logs/study/completed",
  access: "authenticated",
  body: logRangeInput,
  output: Schema.Array(scholarWithCompletedSession),
});
