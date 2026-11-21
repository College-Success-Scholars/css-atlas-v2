/**
 * @file session-log.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/session-logs, bound to @css-atlas/shared/contracts/session-logs.
 * Each handler turns the validated body into service options and returns the
 * service result. The cleaned endpoints answer `byScholarUid` as a record.
 */
import * as contract from "@css-atlas/shared/contracts/session-logs";
import { implement } from "../http/endpoint.js";
import {
  fetchFrontDeskLogs,
  fetchStudySessionLogs,
  getFrontDeskCleanedAndErrored,
  getFrontDeskCompletedSessions,
  getFrontDeskScholarsInRoom,
  getStudySessionCleanedAndErrored,
  getStudySessionCompletedSessions,
  getStudySessionScholarsInRoom,
} from "../services/session-log.service.js";
import { getFrontDeskNoShows, getStudySessionNoShows } from "../services/session-no-shows.service.js";
import type { CleanedAndErroredResult } from "../models/session-log.model.js";

/** Blank or unparseable dates mean "no limit", as they always have. */
function parseDateOrUndefined(value: string | null | undefined): Date | undefined {
  if (value == null || value === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function range(body: typeof contract.logRangeInput.Type) {
  return {
    startDate: parseDateOrUndefined(body.startDate),
    endDate: parseDateOrUndefined(body.endDate),
    scholarUids: body.scholarUids,
    sessionType: body.sessionType,
  };
}

function inRoom(body: typeof contract.inRoomInput.Type) {
  return { ...range(body), asOf: parseDateOrUndefined(body.asOf) };
}

function cleanedBody(result: CleanedAndErroredResult) {
  return {
    byScholarUid: Object.fromEntries(result.byScholarUid),
    allCleaned: result.allCleaned,
    allErrored: result.allErrored,
  };
}

export const sessionLogEndpoints = [
  // Front desk
  implement(contract.getFrontDeskNoShows, () => getFrontDeskNoShows()),
  implement(contract.getFrontDeskLogs, ({ body }) => fetchFrontDeskLogs(range(body))),
  implement(contract.getFrontDeskCleaned, async ({ body }) =>
    cleanedBody(
      await getFrontDeskCleanedAndErrored({
        ...range(body),
        treatUnclosedEntryAsError: body.treatUnclosedEntryAsError,
      }),
    ),
  ),
  implement(contract.getFrontDeskInRoom, ({ body }) => getFrontDeskScholarsInRoom(inRoom(body))),
  implement(contract.getFrontDeskCompleted, ({ body }) => getFrontDeskCompletedSessions(range(body))),

  // Study session
  implement(contract.getStudyNoShows, () => getStudySessionNoShows()),
  implement(contract.getStudyLogs, ({ body }) => fetchStudySessionLogs(range(body))),
  implement(contract.getStudyCleaned, async ({ body }) =>
    cleanedBody(
      await getStudySessionCleanedAndErrored({
        ...range(body),
        treatUnclosedEntryAsError: body.treatUnclosedEntryAsError,
      }),
    ),
  ),
  implement(contract.getStudyInRoom, ({ body }) => getStudySessionScholarsInRoom(inRoom(body))),
  implement(contract.getStudyCompleted, ({ body }) => getStudySessionCompletedSessions(range(body))),
];
