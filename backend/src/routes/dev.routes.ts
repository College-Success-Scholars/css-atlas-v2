/**
 * @file dev.routes.ts
 * @module backend/routes
 *
 * Mounts the developer endpoints from controllers/dev.controller.ts. Path,
 * method and the developer-only gate come from shared/contracts/dev.ts.
 */
import { toRouter } from "../http/endpoint.js";
import { devEndpoints } from "../controllers/dev.controller.js";

export default toRouter(devEndpoints);
