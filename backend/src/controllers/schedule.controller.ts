/**
 * @file schedule.controller.ts
 * @module backend/controllers
 *
 * Request handlers for team-leader schedule management (/api/schedules/*), also reused by
 * the developer board so both surfaces share one write contract.
 *
 * ## Responsibilities
 * - Parse and validate request shape (types, date keys); semantic rules live in the database
 * - Map ScheduleError to HTTP status codes
 *
 * ## What does NOT belong here
 * - Role checks (middleware) and any direct table writes (schedule-board.service)
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  currentEasternMonday,
  getScheduleBoard,
  getScholarSchedule,
  isDateKey,
  replaceScholarScheduleFromWeek,
  ScheduleError,
  type ReplaceScheduleInput,
  type StandingShiftInput,
} from "../services/schedule-board.service.js";
import { getEasternDayOfWeek, parseEasternDate } from "../services/time.service.js";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function sendScheduleError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof ScheduleError) {
    res.status(error.status).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.currentRevision != null ? { currentRevision: error.currentRevision } : {}),
    });
    return;
  }
  res.status(500).json({ error: error instanceof Error && error.message ? error.message : fallback });
}

export function parseWeekQuery(value: unknown): string {
  if (value === undefined || value === "") return currentEasternMonday();
  if (!isDateKey(value)) throw new ScheduleError(400, "week must be a YYYY-MM-DD date");
  if (getEasternDayOfWeek(parseEasternDate(value)) !== 1) {
    throw new ScheduleError(400, "week must be a Monday");
  }
  return value;
}

function parseShift(raw: unknown, index: number): StandingShiftInput {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ScheduleError(400, `shifts[${index}] must be an object`);
  }
  const row = raw as Record<string, unknown>;
  if (row.kind !== "front_desk" && row.kind !== "study_session") {
    throw new ScheduleError(400, `shifts[${index}].kind must be front_desk or study_session`);
  }
  if (typeof row.dayOfWeek !== "number" || !Number.isInteger(row.dayOfWeek) || row.dayOfWeek < 0 || row.dayOfWeek > 6) {
    throw new ScheduleError(400, `shifts[${index}].dayOfWeek must be an integer 0-6`);
  }
  if (typeof row.startTime !== "string" || typeof row.endTime !== "string") {
    throw new ScheduleError(400, `shifts[${index}] needs startTime and endTime as HH:MM`);
  }
  return { kind: row.kind, dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime };
}

export function parseReplaceBody(uid: string | undefined, body: unknown): ReplaceScheduleInput {
  if (!uid?.trim()) throw new ScheduleError(400, "Missing uid parameter");
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new ScheduleError(400, "Body must be an object");
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.semesterId !== "number" || !Number.isInteger(raw.semesterId)) {
    throw new ScheduleError(400, "semesterId must be an integer");
  }
  if (!isDateKey(raw.effectiveWeekStart)) {
    throw new ScheduleError(400, "effectiveWeekStart must be a YYYY-MM-DD date");
  }
  if (typeof raw.expectedRevision !== "number" || !Number.isInteger(raw.expectedRevision) || raw.expectedRevision < 0) {
    throw new ScheduleError(400, "expectedRevision must be a non-negative integer");
  }
  if (!Array.isArray(raw.shifts)) throw new ScheduleError(400, "shifts must be an array");
  return {
    scholarUid: uid.trim(),
    semesterId: raw.semesterId,
    effectiveWeekStart: raw.effectiveWeekStart,
    expectedRevision: raw.expectedRevision,
    shifts: raw.shifts.map(parseShift),
  };
}

// GET /api/schedules?week=YYYY-MM-DD
export async function getBoard(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getScheduleBoard({ weekStart: parseWeekQuery(req.query.week) });
    res.json({ data });
  } catch (e) {
    sendScheduleError(res, e, "Failed to load schedules");
  }
}

// GET /api/schedules/:uid?week=YYYY-MM-DD
export async function getScholar(req: AuthenticatedRequest, res: Response) {
  const uid = firstParam(req.params.uid);
  try {
    if (!uid?.trim()) throw new ScheduleError(400, "Missing uid parameter");
    const data = await getScholarSchedule(uid.trim(), parseWeekQuery(req.query.week));
    res.json({ data });
  } catch (e) {
    sendScheduleError(res, e, "Failed to load schedule");
  }
}

// PUT /api/schedules/:uid
export async function putScholar(req: AuthenticatedRequest, res: Response) {
  try {
    const input = parseReplaceBody(firstParam(req.params.uid), req.body);
    const data = await replaceScholarScheduleFromWeek(input);
    res.json({ data });
  } catch (e) {
    sendScheduleError(res, e, "Failed to save schedule");
  }
}
