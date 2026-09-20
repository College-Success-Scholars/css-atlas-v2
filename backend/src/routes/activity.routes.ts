/**
 * @file activity.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/daily-activity/* endpoints.
 * All routes require requireAuth. Covers daily activity minutes
 * query by menteeUid, weekNum, and logSource.
 *
 * ## What belongs here
 * - Route declarations for daily activity endpoints
 *
 * ## What does NOT belong here
 * - Business logic (that's controllers/activity.controller.ts)
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import * as activityController from "../controllers/activity.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/minutes", activityController.minutes);

export default router;
