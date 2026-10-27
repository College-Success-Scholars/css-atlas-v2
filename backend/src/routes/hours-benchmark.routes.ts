/**
 * @file hours-benchmark.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/hours-benchmark/* endpoints.
 * Requires developer access (app_role === "developer").
 */
import { Router } from "express";
import { requireDeveloper } from "../middleware/auth.middleware.js";
import * as hoursBenchmarkController from "../controllers/hours-benchmark.controller.js";

const router = Router();

router.get("/", requireDeveloper, hoursBenchmarkController.report);
router.get("/pdf", requireDeveloper, hoursBenchmarkController.pdf);

export default router;
