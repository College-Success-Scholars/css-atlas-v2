/**
 * @file traffic.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/traffic/* endpoints.
 * All routes require requireAuth. Covers traffic session listing,
 * single-week entry counts, and batch entry counts.
 *
 * ## What belongs here
 * - Route declarations for traffic endpoints
 *
 * ## What does NOT belong here
 * - Business logic (that's controllers/traffic.controller.ts)
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import * as trafficController from "../controllers/traffic.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/sessions/:weekNum", trafficController.sessionsForWeek);
router.get("/entry-count/:weekNum", trafficController.entryCount);
router.post("/entry-counts", trafficController.entryCounts);

export default router;
