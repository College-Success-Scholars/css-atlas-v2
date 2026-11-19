/**
 * @file error-handler.ts
 * @module backend/http
 *
 * The global Express error handler: the single place that decides which
 * status a thrown error becomes and how much of it is safe to show a client.
 *
 * - DomainError → the status for its tag, with a message built from its fields
 * - Postgres / PostgREST data errors → 400 with the database message
 * - anything else → 500 "Internal server error" (details are logged only)
 */
import type { NextFunction, Request, Response } from "express";
import { isDomainError, type DomainError } from "../utils/domain-error.js";
import { formatSupabaseError, supabaseErrorStatus } from "../utils/supabase-errors.js";

const STATUS: Record<DomainError["_tag"], number> = {
  ValidationError: 400,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
};

function describe(error: DomainError): string {
  switch (error._tag) {
    case "ValidationError":
      return error.field ? `${error.field} ${error.message}` : error.message;
    case "NotFoundError":
      return error.id ? `${error.resource} "${error.id}" not found` : `${error.resource} not found`;
    case "ForbiddenError":
      return error.reason;
    case "ConflictError":
      return error.message;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (isDomainError(err)) {
    res.status(STATUS[err._tag]).json({ error: describe(err) });
    return;
  }
  const status = supabaseErrorStatus(err);
  if (status >= 500) console.error("Unhandled error:", err);
  res.status(status).json({ error: formatSupabaseError(err, status) });
}
