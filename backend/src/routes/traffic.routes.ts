/**
 * @file traffic.routes.ts
 * @module backend/routes
 *
 * /api/traffic. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/traffic; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { trafficEndpoints } from "../controllers/traffic.controller.js";

export default toRouter(trafficEndpoints);
