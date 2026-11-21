/**
 * @file activity.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/daily-activity, bound to the contract in
 * @css-atlas/shared/contracts/daily-activity. Daily activity is the minutes a
 * scholar was active per day, derived from session logs.
 */
import * as contract from "@css-atlas/shared/contracts/daily-activity";
import { implement } from "../http/endpoint.js";
import { getTotalMinutesForMenteeWeek } from "../services/daily-scholar-activity.service.js";

export const activityEndpoints = [
  implement(contract.getMinutes, ({ query }) => getTotalMinutesForMenteeWeek(query)),
];
