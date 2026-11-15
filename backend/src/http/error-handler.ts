/**
 * @file error-handler.ts
 * @module backend/http
 *
 * The global Express error handler: the single place that decides which
 * status a thrown error becomes and how much of it is safe to show a client.
 *
 * - AppError → the status for its kind, with its message
 * - Postgres / PostgREST data errors → 400 with the database message
 * - anything else → 500 "Internal server error" (details are logged only)
 */
import type { NextFunction, Request, Response } from "express";
import { APP_ERROR_STATUS, AppError } from "../utils/app-error.js";
import { formatSupabaseError, supabaseErrorStatus } from "../utils/supabase-errors.js";

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof AppError) {
    res.status(APP_ERROR_STATUS[err.kind]).json({ error: err.message });
    return;
  }
  const status = supabaseErrorStatus(err);
  if (status >= 500) console.error("Unhandled error:", err);
  res.status(status).json({ error: formatSupabaseError(err, status) });
}
