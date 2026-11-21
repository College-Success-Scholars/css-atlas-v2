/**
 * @file tutor-report-log.routes.ts
 * @module backend/routes
 *
 * /api/tutor-reports. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/tutor-reports; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { tutorReportEndpoints } from "../controllers/tutor-report-log.controller.js";

export default toRouter(tutorReportEndpoints);
