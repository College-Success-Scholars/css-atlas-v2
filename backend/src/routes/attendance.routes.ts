/**
 * @file attendance.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/attendance/* endpoints.
 * Campus-week minutes from tickets + excuses from scholar_week_excuses
 * (keyed by scholar_uid, week_start, kind).
 * Requires team leader or above.
 */
import { Router } from "express";
import { requireTeamLeaderOrAbove } from "../middleware/auth.middleware.js";
import * as attendanceController from "../controllers/attendance-week.controller.js";

const router = Router();

router.use(requireTeamLeaderOrAbove);

router.get("/week/:weekNum", attendanceController.weekBoard);
router.patch("/excuse", attendanceController.patchExcuse);

export default router;
