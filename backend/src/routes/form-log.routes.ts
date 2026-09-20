/**
 * @file form-log.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/form-logs/* endpoints.
 * Covers MCF, WHAF, and WPL form log queries (30+ endpoints).
 *
 * Auth (after requireAuth):
 * - Week-wide, batch-by-uids, team-leader stats, generic id lookup → requireTeamLeaderRole
 * - uid-scoped GETs → requireSelfOrTeamLeader
 * - recent-submissions → requireSelfScholarIdOrTeamLeader
 *
 * ## What belongs here
 * - Route declarations for form log endpoints
 *
 * ## What does NOT belong here
 * - Business logic (that's controllers/form-log.controller.ts)
 */
import { Router } from "express";
import {
  requireAuth,
  requireSelfOrTeamLeader,
  requireSelfScholarIdOrTeamLeader,
  requireTeamLeaderRole,
} from "../middleware/auth.middleware.js";
import * as formLogController from "../controllers/form-log.controller.js";

const router = Router();

router.use(requireAuth);

// MCF
router.get("/mcf/week/:weekNum", requireTeamLeaderRole, formLogController.mcfForWeek);
router.get("/mcf/uid/:uid", requireSelfOrTeamLeader, formLogController.mcfByUid);
router.get("/mcf/uid/:uid/week/:weekNum", requireSelfOrTeamLeader, formLogController.mcfByUidAndWeek);
router.get("/mcf/week/:weekNum/with-late", requireTeamLeaderRole, formLogController.mcfForWeekWithLate);
router.get("/mcf/uid/:uid/with-late", requireSelfOrTeamLeader, formLogController.mcfByUidWithLate);
router.get("/mcf/uid/:uid/week/:weekNum/with-late", requireSelfOrTeamLeader, formLogController.mcfByUidAndWeekWithLate);

// WHAF (legacy path) + WAHF (canonical)
router.get("/whaf/week/:weekNum", requireTeamLeaderRole, formLogController.whafForWeek);
router.get("/wahf/week/:weekNum", requireTeamLeaderRole, formLogController.whafForWeek);
router.get("/whaf/uid/:uid", requireSelfOrTeamLeader, formLogController.whafByUid);
router.get("/wahf/uid/:uid", requireSelfOrTeamLeader, formLogController.whafByUid);
router.get("/whaf/week/:weekNum/with-late", requireTeamLeaderRole, formLogController.whafForWeekWithLate);
router.get("/wahf/week/:weekNum/with-late", requireTeamLeaderRole, formLogController.whafForWeekWithLate);

// WPL
router.get("/wpl/week/:weekNum", requireTeamLeaderRole, formLogController.wplForWeek);
router.get("/wpl/uid/:uid", requireSelfOrTeamLeader, formLogController.wplByUid);
router.get("/wpl/uid/:uid/week/:weekNum", requireSelfOrTeamLeader, formLogController.wplByUidAndWeek);
router.get("/wpl/week/:weekNum/with-late", requireTeamLeaderRole, formLogController.wplForWeekWithLate);
router.get("/wpl/uid/:uid/with-late", requireSelfOrTeamLeader, formLogController.wplByUidWithLate);
router.get("/wpl/uid/:uid/week/:weekNum/with-late", requireSelfOrTeamLeader, formLogController.wplByUidAndWeekWithLate);

// Batch by UIDs
router.post("/whaf/by-uids", requireTeamLeaderRole, formLogController.whafByUids);
router.post("/wahf/by-uids", requireTeamLeaderRole, formLogController.whafByUids);
router.post("/mcf/by-uids", requireTeamLeaderRole, formLogController.mcfByUids);
router.post("/wpl/by-uids", requireTeamLeaderRole, formLogController.wplByUids);
router.post("/tutor-reports/by-uids", requireTeamLeaderRole, formLogController.tutorReportsByUids);
router.post("/daily-activity/by-uids", requireTeamLeaderRole, formLogController.dailyActivityByUids);

// Recent submissions & team leader stats
router.post(
  "/recent-submissions",
  requireSelfScholarIdOrTeamLeader,
  formLogController.recentSubmissions,
);
router.post("/team-leader-stats", requireTeamLeaderRole, formLogController.teamLeaderStats);

// Generic form log by type/id (must be last to avoid catching other routes)
router.get("/:formType/:formId", requireTeamLeaderRole, formLogController.getFormLog);

export default router;
