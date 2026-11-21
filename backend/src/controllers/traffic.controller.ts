/**
 * @file traffic.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/traffic, bound to the contract in
 * @css-atlas/shared/contracts/traffic. "Traffic" is the number of front-desk
 * check-in/out entries per campus week, used to gauge program activity.
 */
import * as contract from "@css-atlas/shared/contracts/traffic";
import { implement } from "../http/endpoint.js";
import {
  getTrafficEntryCountForWeek,
  getTrafficEntryCountsForWeeks,
  getTrafficSessionsForWeek,
} from "../services/traffic.service.js";

export const trafficEndpoints = [
  implement(contract.getSessionsForWeek, ({ params }) => getTrafficSessionsForWeek(params.week_num)),

  implement(contract.getEntryCountForWeek, ({ params }) => getTrafficEntryCountForWeek(params.week_num)),

  implement(contract.getEntryCountsForWeeks, ({ body }) => getTrafficEntryCountsForWeeks(body.weekNumbers)),
];
