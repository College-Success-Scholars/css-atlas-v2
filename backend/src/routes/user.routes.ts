/**
 * @file user.routes.ts
 * @module backend/routes
 *
 * /api/users. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/users; this file only mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { userEndpoints } from "../controllers/user.controller.js";

export default toRouter(userEndpoints);
