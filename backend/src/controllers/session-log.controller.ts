/**
 * @file session-log.controller.ts
 * @module backend/controllers
 *
 * Request handlers for raw session check-in/out log endpoints (/api/session-logs/*).
 * Handles both front-desk and study-session log variants including raw fetch,
 * cleaned/errored pairs, in-room open sessions, and completed sessions.
 *
 * ## Responsibilities
 * - Parse date and scholarUids from request bodies
 * - Delegate to session-log.service.ts functions
 * - Return structured { data } or { error } JSON responses
 *
 * ## What belongs here
 * - Handler functions for /api/session-logs/* routes
 *
 * ## What does NOT belong here
 * - Session log parsing or cleaning logic (that's in session-log.service.ts)
 * - Supabase queries
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  fetchFrontDeskLogs,
  fetchStudySessionLogs,
  getFrontDeskCleanedAndErrored,
  getFrontDeskScholarsInRoom,
  getFrontDeskCompletedSessions,
  getStudySessionCleanedAndErrored,
  getStudySessionScholarsInRoom,
  getStudySessionCompletedSessions,
} from "../services/session-log.service.js";

function parseDateOrUndefined(val: unknown): Date | undefined {
  if (val == null || val === "") return undefined;
  const d = new Date(val as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// POST /api/session-logs/front-desk
export async function fetchFrontDesk(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, scholarUids } = req.body as {
      startDate?: string;
      endDate?: string;
      scholarUids?: string[];
    };
    const data = await fetchFrontDeskLogs({
      startDate: parseDateOrUndefined(startDate),
      endDate: parseDateOrUndefined(endDate),
      scholarUids,
    });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch front desk logs" });
  }
}

// POST /api/session-logs/study
export async function fetchStudy(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, scholarUids, sessionType } = req.body as {
      startDate?: string;
      endDate?: string;
      scholarUids?: string[];
      sessionType?: string;
    };
    const data = await fetchStudySessionLogs({
      startDate: parseDateOrUndefined(startDate),
      endDate: parseDateOrUndefined(endDate),
      scholarUids,
      sessionType,
    });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch study session logs" });
  }
}

// POST /api/session-logs/front-desk/cleaned
export async function frontDeskCleaned(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, scholarUids, sessionType, treatUnclosedEntryAsError } = req.body as {
      startDate?: string;
      endDate?: string;
      scholarUids?: string[];
      sessionType?: string;
      treatUnclosedEntryAsError?: boolean;
    };
    const result = await getFrontDeskCleanedAndErrored({
      startDate: parseDateOrUndefined(startDate),
      endDate: parseDateOrUndefined(endDate),
      scholarUids,
      sessionType,
      treatUnclosedEntryAsError,
    });
    res.json({
      data: {
        byScholarUid: Object.fromEntries(result.byScholarUid),
        allCleaned: result.allCleaned,
        allErrored: result.allErrored,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch cleaned front desk logs" });
  }
}

// POST /api/session-logs/front-desk/in-room
export async function frontDeskInRoom(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, scholarUids, sessionType, asOf } = req.body as {
      startDate?: string;
      endDate?: string;
      scholarUids?: string[];
      sessionType?: string;
      asOf?: string;
    };
    const data = await getFrontDeskScholarsInRoom({
      startDate: parseDateOrUndefined(startDate),
      endDate: parseDateOrUndefined(endDate),
      scholarUids,
      sessionType,
      asOf: parseDateOrUndefined(asOf),
    });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch scholars in room" });
  }
}

// POST /api/session-logs/front-desk/completed
export async function frontDeskCompleted(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, scholarUids, sessionType } = req.body as {
      startDate?: string;
      endDate?: string;
      scholarUids?: string[];
      sessionType?: string;
    };
    const data = await getFrontDeskCompletedSessions({
      startDate: parseDateOrUndefined(startDate),
      endDate: parseDateOrUndefined(endDate),
      scholarUids,
      sessionType,
    });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch completed sessions" });
  }
}

// POST /api/session-logs/study/cleaned
export async function studyCleaned(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, scholarUids, sessionType, treatUnclosedEntryAsError } = req.body as {
      startDate?: string;
      endDate?: string;
      scholarUids?: string[];
      sessionType?: string;
      treatUnclosedEntryAsError?: boolean;
    };
    const result = await getStudySessionCleanedAndErrored({
      startDate: parseDateOrUndefined(startDate),
      endDate: parseDateOrUndefined(endDate),
      scholarUids,
      sessionType,
      treatUnclosedEntryAsError,
    });
    res.json({
      data: {
        byScholarUid: Object.fromEntries(result.byScholarUid),
        allCleaned: result.allCleaned,
        allErrored: result.allErrored,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch cleaned study logs" });
  }
}

// POST /api/session-logs/study/in-room
export async function studyInRoom(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, scholarUids, sessionType, asOf } = req.body as {
      startDate?: string;
      endDate?: string;
      scholarUids?: string[];
      sessionType?: string;
      asOf?: string;
    };
    const data = await getStudySessionScholarsInRoom({
      startDate: parseDateOrUndefined(startDate),
      endDate: parseDateOrUndefined(endDate),
      scholarUids,
      sessionType,
      asOf: parseDateOrUndefined(asOf),
    });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch scholars in room" });
  }
}

// POST /api/session-logs/study/completed
export async function studyCompleted(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, scholarUids, sessionType } = req.body as {
      startDate?: string;
      endDate?: string;
      scholarUids?: string[];
      sessionType?: string;
    };
    const data = await getStudySessionCompletedSessions({
      startDate: parseDateOrUndefined(startDate),
      endDate: parseDateOrUndefined(endDate),
      scholarUids,
      sessionType,
    });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch completed study sessions" });
  }
}
