/**
 * @file attendance.routes.ts
 * @module backend/routes
 *
 * /api/attendance. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/attendance; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { attendanceEndpoints } from "../controllers/attendance-week.controller.js";

export default toRouter(attendanceEndpoints);
