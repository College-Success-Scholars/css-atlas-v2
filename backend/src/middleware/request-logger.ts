/**
 * @file request-logger.ts
 * @module backend/middleware
 *
 * Express middleware that logs every incoming HTTP request.
 * Attaches a "finish" listener to the response so it can capture
 * the final status code and total duration after the handler completes.
 *
 * ## Responsibilities
 * - Log HTTP method, full URL, response status code, and duration (ms)
 *
 * ## What belongs here
 * - Application-wide request/response logging
 *
 * ## What does NOT belong here
 * - Authentication logic (see middleware/auth.middleware.ts)
 * - Route-specific middleware
 */
import type { Request, Response, NextFunction } from "express";

function getRequestUrl(req: Request): string {
  const host = req.get("host") ?? "localhost";
  const protocol = req.protocol || "http";
  return `${protocol}://${host}${req.originalUrl}`;
}

/**
 * Logs each incoming API request with method, full URL, status, and duration.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const method = req.method;
  const url = getRequestUrl(req);

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    console.log(`[API] ${method} ${url} — ${res.statusCode} (${durationMs}ms)`);
  });

  next();
}
