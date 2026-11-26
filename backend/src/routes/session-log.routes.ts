/**
 * @file session-log.routes.ts
 * @module backend/routes
 *
 * /api/session-logs. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/session-logs; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { sessionLogEndpoints } from "../controllers/session-log.controller.js";

export default toRouter(sessionLogEndpoints);
