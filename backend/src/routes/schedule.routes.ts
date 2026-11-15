/**
 * @file schedule.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/schedules/* (team leader or above).
 *
 * Routes:
 *   GET /api/schedules?week=YYYY-MM-DD       → getBoard
 *   GET /api/schedules/:uid?week=YYYY-MM-DD  → getScholar
 *   PUT /api/schedules/:uid                  → putScholar
 *
 * PUT is rejected while a developer acts as a test profile (reject-writes-when-acting).
 *
 * ## What does NOT belong here
 * - Business logic (controllers/schedule.controller.ts)
 */
import { Router } from "express";
import { requireTeamLeaderOrAbove } from "../middleware/auth.middleware.js";
import * as scheduleController from "../controllers/schedule.controller.js";

const router = Router();

router.use(requireTeamLeaderOrAbove);

router.get("/", scheduleController.getBoard);
router.get("/:uid", scheduleController.getScholar);
router.put("/:uid", scheduleController.putScholar);

export default router;
