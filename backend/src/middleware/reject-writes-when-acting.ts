/**
 * @file reject-writes-when-acting.ts
 * @module backend/middleware
 *
 * Blocks true mutations when a developer is acting as a test profile.
 * POST is not treated as write-by-default — many read endpoints use POST with a body.
 */
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware.js";

/** POST paths that mutate data (denylist). All other POSTs are reads and allowed when acting. */
const ACTING_BLOCKED_POST_PATHS = new Set([
  "/api/auth/profile",
  "/api/memo/sync",
  "/api/memo/refresh-stats",
]);

function requestPath(req: AuthenticatedRequest): string {
  const raw = req.originalUrl ?? req.url ?? "";
  return raw.split("?")[0] ?? "";
}

/**
 * Returns true when the request should be blocked while acting as a test profile.
 * Exported for unit tests.
 */
export function isActingWriteRequest(req: AuthenticatedRequest): boolean {
  const path = requestPath(req);

  if (req.method === "PATCH" || req.method === "PUT" || req.method === "DELETE") {
    return true;
  }

  if (path.startsWith("/api/dev")) {
    return false;
  }

  if (req.method === "POST") {
    return ACTING_BLOCKED_POST_PATHS.has(path);
  }

  return false;
}

export function rejectWritesWhenActing(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isActingAsTestProfile) {
    next();
    return;
  }

  if (!isActingWriteRequest(req)) {
    next();
    return;
  }

  res.status(403).json({
    error: "Read-only while acting as test profile. Switch to My profile to make changes.",
  });
}
