/**
 * @file dev.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/dev/* endpoints.
 * All routes require requireDeveloper (app_role === "developer").
 * Exposes diagnostic and operational endpoints not available to other roles.
 *
 * ## What belongs here
 * - Route declarations for developer-only endpoints
 *
 * ## What does NOT belong here
 * - Business logic (that's controllers/dev.controller.ts)
 * - Routes accessible to non-developer roles
 */
import { Router } from "express";
import { requireDeveloper } from "../middleware/auth.middleware.js";
import * as devController from "../controllers/dev.controller.js";

const router = Router();

// All dev routes require developer access
router.use(requireDeveloper);

router.get("/test", devController.test);
router.get("/me", devController.me);
router.get("/test-profiles", devController.getTestProfiles);
router.get("/test-profiles/:id", devController.getTestProfile);
router.post("/active-profile", devController.setActiveProfile);

// Form logs
router.get("/form-logs/:formType/:formId", devController.getFormLog);

router.get("/roster/:uid", devController.getRoster);
router.patch("/roster/:uid", devController.patchRoster);

export default router;
