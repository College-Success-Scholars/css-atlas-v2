/**
 * @file memo.routes.ts
 * @module backend/routes
 *
 * /api/memo. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/memo; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { memoEndpoints } from "../controllers/memo.controller.js";

export default toRouter(memoEndpoints);
