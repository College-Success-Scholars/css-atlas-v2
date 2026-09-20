/**
 * @file traffic.controller.ts
 * @module backend/controllers
 *
 * Request handlers for traffic entry counting endpoints (/api/traffic/*).
 * "Traffic" refers to the number of check-in/out entries at the front desk
 * per campus week, used to gauge program activity levels.
 *
 * ## Responsibilities
 * - Parse weekNum from params/query/body
 * - Delegate to traffic.service.ts
 * - Return { data } or { error } JSON
 *
 * ## What belongs here
 * - Handler functions for /api/traffic/* routes
 *
 * ## What does NOT belong here
 * - Traffic counting logic (that's in traffic.service.ts)
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getTrafficSessionsForWeek,
  getTrafficEntryCountForWeek,
  getTrafficEntryCountsForWeeks,
} from "../services/traffic.service.js";

function parseWeekNum(val: string | string[] | undefined): number | null {
  const s = Array.isArray(val) ? val[0] : val;
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) || n < 1 ? null : n;
}

// GET /api/traffic/sessions/:weekNum
export async function sessionsForWeek(req: AuthenticatedRequest, res: Response) {
  try {
    const weekNum = parseWeekNum(req.params.weekNum);
    if (!weekNum) { res.status(400).json({ error: "Invalid weekNum parameter" }); return; }
    const data = await getTrafficSessionsForWeek(weekNum);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch traffic sessions" });
  }
}

// GET /api/traffic/entry-count/:weekNum
export async function entryCount(req: AuthenticatedRequest, res: Response) {
  try {
    const weekNum = parseWeekNum(req.params.weekNum);
    if (!weekNum) { res.status(400).json({ error: "Invalid weekNum parameter" }); return; }
    const data = await getTrafficEntryCountForWeek(weekNum);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch entry count" });
  }
}

// POST /api/traffic/entry-counts
export async function entryCounts(req: AuthenticatedRequest, res: Response) {
  try {
    const { weekNumbers } = req.body as { weekNumbers?: number[] };
    if (!Array.isArray(weekNumbers)) { res.status(400).json({ error: "weekNumbers must be an array" }); return; }
    const data = await getTrafficEntryCountsForWeeks(weekNumbers);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch entry counts" });
  }
}
