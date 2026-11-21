/**
 * @file auth.routes.ts
 * @module backend/routes
 *
 * /api/auth. Paths, methods and minimum roles are declared in
 * @css-atlas/shared/contracts/auth and contracts/mentees; this file only
 * mounts them.
 */
import { toRouter } from "../http/endpoint.js";
import { authEndpoints } from "../controllers/auth.controller.js";
import { menteeEndpoints } from "../controllers/mentees.controller.js";
import { semesterEndpoints } from "../controllers/semester.controller.js";

export default toRouter([...authEndpoints, ...menteeEndpoints, ...semesterEndpoints]);
