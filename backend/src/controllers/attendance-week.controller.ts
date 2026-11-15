/**
 * @file attendance-week.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/attendance, bound to the contract in
 * @css-atlas/shared/contracts/attendance. Paths, validation, roles and the
 * response envelope come from the contract and http/endpoint.ts.
 *
 * This file is the reference shape for a controller: each handler takes
 * validated input and returns data.
 */
import * as contract from "@css-atlas/shared/contracts/attendance";
import { implement } from "../http/endpoint.js";
import { getWeekAttendanceForUids, getWeekBoard, upsertExcuse } from "../services/attendance-week.service.js";

export const attendanceEndpoints = [
  implement(contract.getWeekBoard, ({ params, query }) => getWeekBoard(params.week_num, query.kind)),

  implement(contract.getWeekAttendanceForUids, ({ params, body }) =>
    getWeekAttendanceForUids(params.week_num, body.uids),
  ),

  implement(contract.upsertExcuse, ({ body }, caller) =>
    upsertExcuse(
      {
        ...body,
        updated_by: caller.profile?.student_id != null ? String(caller.profile.student_id) : caller.userId || null,
      },
      caller.asOf,
    ),
  ),
];
