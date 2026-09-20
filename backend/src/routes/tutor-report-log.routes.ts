/**
 * @file tutor-report-log.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/tutor-reports/* endpoints.
 * All routes require requireTeamLeaderOrAbove. Covers tutor report
 * queries by week, by uid, by uid+week, and attendance check.
 *
 * ## What belongs here
 * - Route declarations for tutor report endpoints
 *
 * ## What does NOT belong here
 * - Business logic (that's controllers/tutor-report-log.controller.ts)
 */
import { Router } from "express";
import { requireTeamLeaderOrAbove } from "../middleware/auth.middleware.js";
import * as tutorReportController from "../controllers/tutor-report-log.controller.js";

const router = Router();

router.use(requireTeamLeaderOrAbove);

router.get("/week/:weekNum", tutorReportController.forWeek);
router.get("/uid/:uid", tutorReportController.byUid);
router.get("/uid/:uid/week/:weekNum", tutorReportController.byUidAndWeek);
router.get("/attended/:uid/week/:weekNum", tutorReportController.attended);

export default router;
