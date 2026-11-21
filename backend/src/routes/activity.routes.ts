/**
 * @file activity.routes.ts
 * @module backend/routes
 *
 * /api/daily-activity. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/daily-activity; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { activityEndpoints } from "../controllers/activity.controller.js";

export default toRouter(activityEndpoints);
