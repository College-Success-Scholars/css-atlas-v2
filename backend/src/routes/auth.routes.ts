/**
 * @file auth.routes.ts
 * @module backend/routes
 *
 * Express Router for /api/auth/* endpoints.
 * All routes require a valid JWT (requireAuth).
 *
 * Routes:
 *   GET /api/auth/me            → getMe (auth.controller.ts)
 *   GET /api/auth/profile       → getProfile (auth.controller.ts)
 *   POST /api/auth/profile      → createProfile (auth.controller.ts)
 *   GET /api/auth/mentees       → getMentees (mentees.controller.ts)
 *   GET /api/auth/mentees/compliance → getMenteesWithCompliance (mentees.controller.ts)
 *   GET /api/auth/mentees/:uid/review → getMenteeReview (mentees.controller.ts)
 *   PUT /api/auth/mentees/:uid/meeting-preference → updateMenteeMeetingPreference (mentees.controller.ts)
 *   GET /api/auth/mentees/:uid/mcf-prefill → getMenteeMcfPrefill (mentees.controller.ts; private/no-store)
 *   GET /api/auth/semester      → getActiveSemester (semester.controller.ts; use sparingly, prefer shared campus calendar)
 *   GET /api/auth/active-semester → getActiveSemester (alias of /semester)
 *
 * ## What belongs here
 * - Route declarations for auth endpoints
 * - Auth middleware attachment
 *
 * ## What does NOT belong here
 * - Business logic (that's controllers/auth.controller.ts, mentees.controller.ts, semester.controller.ts)
 * - JWT verification or role gates (middleware/auth.middleware.ts)
 */
import { Router } from "express";
import { authed, getMe, getProfile, createProfile } from "../controllers/auth.controller.js";
import {
  getMenteeMcfPrefill,
  getMenteeReview,
  getMentees,
  getMenteesWithCompliance,
  updateMenteeMeetingPreference,
} from "../controllers/mentees.controller.js";
import { getActiveSemester } from "../controllers/semester.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/me", authed(getMe));
router.get("/profile", getProfile);
router.post("/profile", createProfile);
// Static /mentees/compliance MUST precede the parameterized /mentees/:uid routes.
router.get("/mentees", getMentees);
router.get("/mentees/compliance", getMenteesWithCompliance);
router.get("/mentees/:uid/review", getMenteeReview);
router.put("/mentees/:uid/meeting-preference", updateMenteeMeetingPreference);
router.get("/mentees/:uid/mcf-prefill", getMenteeMcfPrefill);
router.get("/semester", getActiveSemester);
router.get("/active-semester", getActiveSemester);

export default router;
