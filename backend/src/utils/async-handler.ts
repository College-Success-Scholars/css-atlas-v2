/**
 * @file async-handler.ts
 * @module backend/utils
 *
 * Wraps an async Express handler so a rejected promise reaches next(err)
 * instead of crashing the process. Pair with the global error handler in
 * app.ts, which decides status/formatting once for every route.
 */
import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

export function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response) => Promise<void>,
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
