/**
 * @file memo.controller.ts
 * @module backend/controllers
 *
 * Request handlers for weekly memo endpoints (/api/memo/*).
 * The memo is the central weekly report aggregating all scholar activity,
 * form submissions, traffic counts, and performance metrics.
 *
 * ## Responsibilities
 * - Handle memo sync (light/heavy modes), weekly memo fetch, stats refresh
 * - Delegate to memo.service.ts, memo-page.service.ts, and traffic.service.ts
 * - Return { data } or { error } JSON
 *
 * ## What belongs here
 * - Handler functions for /api/memo/* routes
 *
 * ## What does NOT belong here
 * - Memo assembly/aggregation logic (that's in memo.service.ts and memo-page.service.ts)
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { syncMemo, getWeeklyMemo, triggerRefreshStats } from "../services/memo.service.js";
import { getTrafficEntryCountForWeek } from "../services/traffic.service.js";
import { getMemoPageData } from "../services/memo-page.service.js";
import { resolveMemoDefaultWeek } from "../services/memo-default-week.js";
import { getWeeklyMemoReport, weeklyMemoPdfFilename } from "../services/weekly-memo-report.service.js";
import { renderWeeklyMemoPdf } from "../services/weekly-memo-pdf.service.js";

function parseWeekNumberFromBody(body: { weekNumber?: number; weekNum?: number }): number | null {
  const weekNumber = body.weekNumber ?? body.weekNum;
  if (typeof weekNumber !== "number" || weekNumber < 1) return null;
  return weekNumber;
}

// POST /api/memo/sync
export async function sync(req: AuthenticatedRequest, res: Response) {
  const { mode } = req.body as { weekNumber?: number; weekNum?: number; mode?: string };
  const weekNumber = parseWeekNumberFromBody(req.body as { weekNumber?: number; weekNum?: number });
  if (weekNumber == null) {
    res.status(400).json({ error: "weekNumber must be a number >= 1" });
    return;
  }
  if (mode !== "light" && mode !== "heavy") {
    res.status(400).json({ error: "mode must be 'light' or 'heavy'" });
    return;
  }
  try {
    const data = await syncMemo(weekNumber, mode);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Sync failed" });
  }
}

// GET /api/memo/weekly?semesterId=X&weekNumber=Y
export async function weeklyMemo(req: AuthenticatedRequest, res: Response) {
  const semesterId = parseInt(req.query.semesterId as string, 10);
  const weekParam = (req.query.weekNumber ?? req.query.weekNum) as string;
  const weekNumber = parseInt(weekParam, 10);
  if (Number.isNaN(semesterId) || Number.isNaN(weekNumber) || weekNumber < 1) {
    res.status(400).json({ error: "semesterId and weekNumber are required" });
    return;
  }
  try {
    const data = await getWeeklyMemo(semesterId, weekNumber);
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch weekly memo" });
  }
}

// POST /api/memo/refresh-stats
export async function refreshStats(req: AuthenticatedRequest, res: Response) {
  const body = req.body as {
    weekNumber?: number;
    weekNum?: number;
    week_num?: number;
    semesterId?: number;
    semester_id?: number;
  };
  const weekNumber = body.weekNumber ?? body.weekNum ?? body.week_num;
  const semesterId = body.semesterId ?? body.semester_id;
  if (!weekNumber || !semesterId) {
    res.status(400).json({ error: "weekNumber and semesterId are required" });
    return;
  }
  try {
    triggerRefreshStats(weekNumber, semesterId);
    res.json({ data: { ok: true } });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to trigger refresh" });
  }
}

// GET /api/memo/page-data?weekNumber=X  (weekNumber optional — defaults to current campus week)
export async function pageData(req: AuthenticatedRequest, res: Response) {
  const weekParam = (req.query.weekNumber ?? req.query.weekNum) as string | undefined;
  let weekNumber: number;
  if (weekParam != null && weekParam !== "") {
    weekNumber = parseInt(weekParam, 10);
    if (Number.isNaN(weekNumber) || weekNumber < 1) {
      res.status(400).json({ error: "weekNumber must be a number >= 1" });
      return;
    }
  } else {
    const { dateToCampusWeek } = await import("../services/time.service.js");
    const resolved = resolveMemoDefaultWeek(dateToCampusWeek(new Date()));
    if (resolved.status === "year_not_started") {
      res.json({ data: { yearNotStarted: true as const, currentCampusWeek: null } });
      return;
    }
    weekNumber = resolved.weekNumber;
  }
  try {
    const data = await getMemoPageData(weekNumber);
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to build memo page data" });
  }
}

// GET /api/memo/pdf?weekNumber=X
export async function pdf(req: AuthenticatedRequest, res: Response) {
  const weekParam = (req.query.weekNumber ?? req.query.weekNum) as string | undefined;
  let weekNumber: number;
  if (weekParam != null && weekParam !== "") {
    weekNumber = parseInt(weekParam, 10);
    if (Number.isNaN(weekNumber) || weekNumber < 1) {
      res.status(400).json({ error: "weekNumber must be a number >= 1" });
      return;
    }
  } else {
    const { dateToCampusWeek } = await import("../services/time.service.js");
    const resolved = resolveMemoDefaultWeek(dateToCampusWeek(new Date()));
    if (resolved.status === "year_not_started") {
      res.status(409).json({ error: "The academic year has not started." });
      return;
    }
    weekNumber = resolved.weekNumber;
  }

  try {
    const report = await getWeeklyMemoReport(weekNumber);
    const document = await renderWeeklyMemoPdf(report);
    const filename = weeklyMemoPdfFilename(weekNumber, report.printedAtSlug);
    res.set({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Content-Length": String(document.length),
    });
    res.send(document);
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: "PDF generation failed. Please try again." });
  }
}

// GET /api/memo/traffic-count?weekNumber=X
export async function trafficCount(req: AuthenticatedRequest, res: Response) {
  const weekParam = (req.query.weekNumber ?? req.query.weekNum) as string | undefined;
  const weekNumber = weekParam != null ? parseInt(weekParam, 10) : NaN;
  if (Number.isNaN(weekNumber) || weekNumber < 1) {
    res.status(400).json({ error: "weekNumber must be a number >= 1" });
    return;
  }
  const entryCount = await getTrafficEntryCountForWeek(weekNumber);
  res.set("Cache-Control", "no-store, max-age=0");
  res.json({ data: { weekNumber, entryCount } });
}
