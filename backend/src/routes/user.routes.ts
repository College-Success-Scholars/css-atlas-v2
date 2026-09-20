/**
 * @file user.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/users/* endpoints.
 * All routes require a valid JWT (requireAuth).
 *
 * Routes:
 *   POST /api/users/scholar-names     → scholarNames
 *   POST /api/users/required-hours    → requiredHours
 *   POST /api/users/eligible-scholars → eligibleScholars
 *   GET  /api/users/all-uids          → allUids
 *   GET  /api/users/memo-users        → memoUsers
 *   GET  /api/users/team-leaders      → teamLeaders
 *   GET  /api/users/scholar-uids      → scholarUids
 *   GET  /api/users/:uid              → getByUid
 *
 * ## What belongs here
 * - Route declarations for user endpoints
 *
 * ## What does NOT belong here
 * - Business logic (that's controllers/user.controller.ts)
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import * as userController from "../controllers/user.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/scholar-names", userController.scholarNames);
router.post("/required-hours", userController.requiredHours);
router.post("/eligible-scholars", userController.eligibleScholars);
router.get("/all-uids", userController.allUids);
router.get("/memo-users", userController.memoUsers);
router.get("/team-leaders", userController.teamLeaders);
router.get("/scholar-uids", userController.scholarUids);
router.get("/:uid", userController.getByUid);

export default router;
