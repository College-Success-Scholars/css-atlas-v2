/**
 * @file attendance-week.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/attendance/* — campus-week boards and excuse upserts.
 *
 * ## What belongs here
 * - Parse weekNum / kind / excuse body; return { data } or { error }
 *
 * ## What does NOT belong here
 * - Ticket aggregation or Supabase queries
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getWeekBoard,
  parseAttendanceKind,
  upsertExcuse,
} from "../services/attendance-week.service.js";

function paramStr(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

function parseWeekNum(val: string | string[] | undefined): number | null {
  const s = paramStr(val);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) || n < 1 ? null : n;
}

// GET /api/attendance/week/:weekNum?kind=front_desk|study_session
export async function weekBoard(req: AuthenticatedRequest, res: Response) {
  try {
    const weekNum = parseWeekNum(req.params.weekNum);
    if (!weekNum) {
      res.status(400).json({ error: "Invalid weekNum parameter" });
      return;
    }
    const kindRaw =
      typeof req.query.kind === "string" ? req.query.kind : undefined;
    const kind = parseAttendanceKind(kindRaw);
    if (!kind) {
      res.status(400).json({
        error: "Query kind must be front_desk or study_session",
      });
      return;
    }
    const data = await getWeekBoard(weekNum, kind);
    res.json({ data });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : "Failed to fetch attendance week board";
    res.status(500).json({ error: message });
  }
}

// PATCH /api/attendance/excuse
export async function patchExcuse(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Missing JSON body" });
      return;
    }

    const scholarUid =
      body.uid != null
        ? String(body.uid)
        : body.scholar_uid != null
          ? String(body.scholar_uid)
          : "";
    const weekNumRaw = body.weekNum ?? body.week_num;
    const weekNum =
      typeof weekNumRaw === "number"
        ? weekNumRaw
        : typeof weekNumRaw === "string"
          ? parseInt(weekNumRaw, 10)
          : NaN;
    const kind = parseAttendanceKind(
      typeof body.kind === "string" ? body.kind : null
    );

    if (!scholarUid) {
      res.status(400).json({ error: "Missing uid / scholar_uid" });
      return;
    }
    if (!Number.isFinite(weekNum) || weekNum < 1) {
      res.status(400).json({ error: "Invalid weekNum" });
      return;
    }
    if (!kind) {
      res.status(400).json({ error: "kind must be front_desk or study_session" });
      return;
    }

    let excuseMin: number | null = null;
    if (body.excuse_min !== undefined && body.excuse_min !== null && body.excuse_min !== "") {
      const n = Number(body.excuse_min);
      if (!Number.isFinite(n) || n < 0) {
        res.status(400).json({ error: "excuse_min must be a non-negative number" });
        return;
      }
      excuseMin = Math.round(n);
    }

    const descriptionRaw =
      body.description !== undefined
        ? body.description
        : body.excuse !== undefined
          ? body.excuse
          : null;
    const description =
      descriptionRaw == null || descriptionRaw === ""
        ? null
        : String(descriptionRaw);

    const updatedBy =
      req.profile?.student_id != null
        ? String(req.profile.student_id)
        : req.authUser?.id ?? null;

    const data = await upsertExcuse({
      scholar_uid: scholarUid,
      week_num: weekNum,
      kind,
      excuse_min: excuseMin,
      description,
      updated_by: updatedBy,
    });
    res.json({ data });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : "Failed to upsert excuse";
    const status =
      message.includes("required") || message.includes("Invalid") ? 400 : 500;
    console.error("[PATCH /api/attendance/excuse]", e);
    res.status(status).json({ error: message });
  }
}
