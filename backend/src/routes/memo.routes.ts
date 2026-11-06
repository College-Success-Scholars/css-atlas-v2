/**
 * @file memo.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/memo/* endpoints.
 * Most routes require requireTeamLeaderOrAbove. Covers page-data, PDF,
 * sync operations (light/heavy no-op), and traffic counts.
 *
 * ## What belongs here
 * - Route declarations for memo endpoints
 *
 * ## What does NOT belong here
 * - Business logic (that's controllers/memo.controller.ts)
 */
import { Router } from "express";
import { requireTeamLeaderOrAbove } from "../middleware/auth.middleware.js";
import * as memoController from "../controllers/memo.controller.js";

const router = Router();

// Full memo page data (all the processing in one call)
router.get("/page-data", requireTeamLeaderOrAbove, memoController.pageData);
router.get("/pdf", requireTeamLeaderOrAbove, memoController.pdf);

// These require team leader or above
router.post("/sync", requireTeamLeaderOrAbove, memoController.sync);
router.get("/traffic-count", requireTeamLeaderOrAbove, memoController.trafficCount);

export default router;
