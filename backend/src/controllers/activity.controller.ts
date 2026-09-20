/**
 * @file activity.controller.ts
 * @module backend/controllers
 *
 * Request handler for daily scholar activity endpoints (/api/daily-activity/*).
 * Daily activity tracks the total minutes a scholar was active on a given day,
 * derived from session logs and aggregated per mentee per week.
 *
 * ## Responsibilities
 * - Parse menteeUid, weekNum, logSource from query params
 * - Delegate to daily-scholar-activity.service.ts
 * - Return { data } or { error } JSON
 *
 * ## What belongs here
 * - Handler functions for /api/daily-activity/* routes
 *
 * ## What does NOT belong here
 * - Activity aggregation logic (that's in daily-scholar-activity.service.ts)
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { getTotalMinutesForMenteeWeek } from "../services/daily-scholar-activity.service.js";

// GET /api/daily-activity/minutes?menteeUid=X&weekNum=Y&logSource=Z
export async function minutes(req: AuthenticatedRequest, res: Response) {
  try {
    const menteeUid = req.query.menteeUid as string | undefined;
    const weekNumStr = req.query.weekNum as string | undefined;
    const logSource = req.query.logSource as string | undefined;
    if (!menteeUid || !weekNumStr || !logSource) {
      res.status(400).json({ error: "Missing required query parameters: menteeUid, weekNum, logSource" });
      return;
    }
    const weekNum = parseInt(weekNumStr, 10);
    if (Number.isNaN(weekNum) || weekNum < 1) {
      res.status(400).json({ error: "Invalid weekNum" }); return;
    }
    const data = await getTotalMinutesForMenteeWeek({ menteeUid, weekNum, logSource });
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch activity minutes" });
  }
}
