/**
 * @file hours-benchmark.routes.ts
 * @module backend/routes
 *
 * /api/hours-benchmark. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/hours-benchmark; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { hoursBenchmarkEndpoints } from "../controllers/hours-benchmark.controller.js";

export default toRouter(hoursBenchmarkEndpoints);
