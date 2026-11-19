/**
 * @file attendance-week.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/attendance, bound to the contract in
 * @css-atlas/shared/contracts/attendance. Paths, validation, roles and the
 * response envelope come from the contract and http/endpoint.ts.
 *
 * This file is the reference shape for a controller: each handler maps
 * validated input to one service call. upsertExcuse is an Effect service
 * (the target shape); the two reads are Promise services awaiting migration.
 */
import * as contract from "@css-atlas/shared/contracts/attendance";
import { implement } from "../http/endpoint.js";
import { getWeekAttendanceForUids, getWeekBoard, upsertExcuse } from "../services/attendance-week.service.js";

export const attendanceEndpoints = [
  implement(contract.getWeekBoard, ({ params, query }) => getWeekBoard(params.week_num, query.kind)),

  implement(contract.getWeekAttendanceForUids, ({ params, body }) =>
    getWeekAttendanceForUids(params.week_num, body.uids),
  ),

  implement(contract.upsertExcuse, ({ body }) => upsertExcuse(body)),
];
