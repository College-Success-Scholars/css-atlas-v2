/**
 * @file form-log.routes.ts
 * @module backend/routes
 *
 * /api/form-logs. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/form-logs; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { formLogEndpoints } from "../controllers/form-log.controller.js";

export default toRouter(formLogEndpoints);
