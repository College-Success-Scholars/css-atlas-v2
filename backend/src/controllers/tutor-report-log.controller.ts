/**
 * @file tutor-report-log.controller.ts
 * @module backend/controllers
 *
 * Request handlers for tutoring report log endpoints (/api/tutor-reports/*).
 * Tutor reports track whether scholars attended tutoring sessions each week.
 *
 * ## Responsibilities
 * - Parse weekNum and uid from route params
 * - Delegate to tutor-report-log.service.ts
 * - Return { data } or { error } JSON
 *
 * ## What belongs here
 * - Handler functions for /api/tutor-reports/* routes
 *
 * ## What does NOT belong here
 * - Tutor report query logic (that's in tutor-report-log.service.ts)
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getTutorReportLogsForWeek,
  getTutorReportLogsByUid,
  getTutorReportLogsByUidAndWeek,
  didScholarAttendTutoring,
} from "../services/tutor-report-log.service.js";

function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] ?? "" : val ?? "";
}

// GET /api/tutor-reports/week/:weekNum
export async function forWeek(req: AuthenticatedRequest, res: Response) {
  try {
    const weekNum = parseInt(paramStr(req.params.weekNum), 10);
    if (Number.isNaN(weekNum) || weekNum < 1) {
      res.status(400).json({ error: "weekNum must be a number >= 1" }); return;
    }
    const data = await getTutorReportLogsForWeek(weekNum);
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch tutor reports" });
  }
}

// GET /api/tutor-reports/uid/:uid
export async function byUid(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = paramStr(req.params.uid);
    if (!uid) { res.status(400).json({ error: "Missing uid parameter" }); return; }
    const data = await getTutorReportLogsByUid(uid);
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch tutor reports" });
  }
}

// GET /api/tutor-reports/uid/:uid/week/:weekNum
export async function byUidAndWeek(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = paramStr(req.params.uid);
    const weekNum = parseInt(paramStr(req.params.weekNum), 10);
    if (!uid) { res.status(400).json({ error: "Missing uid parameter" }); return; }
    if (Number.isNaN(weekNum) || weekNum < 1) {
      res.status(400).json({ error: "weekNum must be a number >= 1" }); return;
    }
    const data = await getTutorReportLogsByUidAndWeek(uid, weekNum);
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch tutor reports" });
  }
}

// GET /api/tutor-reports/attended/:uid/week/:weekNum
export async function attended(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = paramStr(req.params.uid);
    const weekNum = parseInt(paramStr(req.params.weekNum), 10);
    if (!uid) { res.status(400).json({ error: "Missing uid parameter" }); return; }
    if (Number.isNaN(weekNum) || weekNum < 1) {
      res.status(400).json({ error: "weekNum must be a number >= 1" }); return;
    }
    const result = await didScholarAttendTutoring(uid, weekNum);
    res.json({ data: { attended: result } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to check tutoring attendance" });
  }
}
