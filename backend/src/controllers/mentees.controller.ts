/**
 * @file mentees.controller.ts
 * @module backend/controllers
 *
 * Mentee-roster endpoint handlers for the authenticated mentor. Mounted
 * under /api/auth/mentees* by routes/auth.routes.ts — requireAuth (and
 * req.profile / req.isActingAsTestProfile population) already ran upstream.
 *
 * ## Responsibilities
 * - getMentees, getMenteesWithCompliance
 *
 * ## What does NOT belong here
 * - JWT verification or profile resolution (middleware/auth.middleware.ts)
 */
import { getMenteesByMentorKey, getMenteesWithComplianceByMentorKey } from "../services/mentee.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { resolveMentorKey } from "../utils/mentor-key.js";
import { MAX_DATE_RANGE_DAYS, parseDateRangeQuery } from "../utils/request-validation.js";

// GET /api/auth/mentees
export const getMentees = asyncHandler(async (req, res) => {
  const data = await getMenteesByMentorKey(resolveMentorKey(req));
  res.json({ data });
});

// GET /api/auth/mentees/compliance?startDate=<ISO>&endDate=<ISO>
export const getMenteesWithCompliance = asyncHandler(async (req, res) => {
  const range = parseDateRangeQuery(req.query);
  if (!range) {
    res.status(400).json({
      error: `startDate and endDate must be valid ISO date strings, with startDate <= endDate and a range of at most ${MAX_DATE_RANGE_DAYS} days`,
    });
    return;
  }

  const data = await getMenteesWithComplianceByMentorKey(resolveMentorKey(req), range);
  res.json({ data });
});
