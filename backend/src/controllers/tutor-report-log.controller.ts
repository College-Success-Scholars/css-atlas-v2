/**
 * @file tutor-report-log.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/tutor-reports, bound to @css-atlas/shared/contracts/tutor-reports.
 */
import * as contract from "@css-atlas/shared/contracts/tutor-reports";
import { implement } from "../http/endpoint.js";
import { deleteTutorReportLog, getTutorReportWeekRows } from "../services/tutor-report-log.service.js";
import { NotFoundError } from "../utils/domain-error.js";

export const tutorReportEndpoints = [
  implement(contract.getWeek, ({ params }) => getTutorReportWeekRows(params.week_num)),

  implement(contract.remove, async ({ params }) => {
    if (!(await deleteTutorReportLog(params.id))) throw new NotFoundError({ resource: "Tutor report" });
    return { id: params.id };
  }),
];
