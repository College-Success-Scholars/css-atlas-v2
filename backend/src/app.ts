/**
 * @file app.ts
 * @module backend
 *
 * Express application factory for the CSS Atlas API.
 * Configures middleware, mounts all route groups under /api/*, and registers
 * the global error handler. This module exports the `app` instance — it does
 * not start an HTTP server (that is server.ts).
 *
 * ## Responsibilities
 * - Configure CORS (comma-separated origins from CORS_ORIGIN env var)
 * - Register global middleware: JSON body parser, request logger
 * - Mount domain route groups under /api/<domain>
 * - Provide a health-check endpoint at GET /
 * - Catch-all error handler that returns { error } JSON
 *
 * ## What belongs here
 * - App-level middleware registration (app.use())
 * - Route group mounting (app.use("/api/...", router))
 * - Global error handler
 *
 * ## What does NOT belong here
 * - Business logic or service calls
 * - Individual route/endpoint definitions (those live in routes/)
 * - Process lifecycle (startup, shutdown — that's server.ts)
 */
import express from "express";
import cors from "cors";
import devRoutes from "./routes/dev.routes.js";
import memoRoutes from "./routes/memo.routes.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import sessionLogRoutes from "./routes/session-log.routes.js";
import trafficRoutes from "./routes/traffic.routes.js";
import formLogRoutes from "./routes/form-log.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import tutorReportRoutes from "./routes/tutor-report-log.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import { requestLogger } from "./middleware/request-logger.js";
import { formatSupabaseError, supabaseErrorStatus } from "./utils/supabase-errors.js";

// CORS: accepts comma-separated origins via CORS_ORIGIN env var
// e.g. "https://app.vercel.app,https://app.railway.app"
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000,http://localhost:3002")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();

app.set("trust proxy", 1);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(requestLogger);

app.get("/", (_req, res) => {
  res.json({ message: "CSS Atlas API" });
});

app.use("/api/dev", devRoutes);
app.use("/api/memo", memoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/session-logs", sessionLogRoutes);
app.use("/api/traffic", trafficRoutes);
app.use("/api/form-logs", formLogRoutes);
app.use("/api/daily-activity", activityRoutes);
app.use("/api/tutor-reports", tutorReportRoutes);
app.use("/api/attendance", attendanceRoutes);

// Global error handler, the single place that decides how much of a thrown
// error (Postgres or otherwise) is safe to expose to the client.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) { next(err); return; }
    const status = supabaseErrorStatus(err);
    if (status >= 500) console.error("Unhandled error:", err);
    res.status(status).json({ error: formatSupabaseError(err, status) });
  },
);

export { app };
export default app;
