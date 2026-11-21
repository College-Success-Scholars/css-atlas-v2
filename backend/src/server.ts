/**
 * @file server.ts
 * @module backend
 *
 * Process entry point for the CSS Atlas Express API.
 * Validates required environment variables at startup (fail-fast), then starts
 * the HTTP server. Handles graceful shutdown on SIGTERM so Railway can
 * drain in-flight requests cleanly.
 *
 * ## Responsibilities
 * - Load environment variables via dotenv
 * - Assert SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are present
 * - Start the HTTP server on PORT (default 3001)
 * - Register SIGTERM handler for graceful shutdown
 *
 * ## What belongs here
 * - Process lifecycle logic (startup, shutdown)
 * - Environment variable validation
 *
 * ## What does NOT belong here
 * - Express app configuration (that's app.ts)
 * - Route definitions or middleware
 * - Business logic of any kind
 */
import "dotenv/config";

// Fail fast: crash at startup if required env vars are missing so Railway
// marks the deploy unhealthy rather than serving broken responses.
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

import { app } from "./app.js";

const PORT = process.env.PORT ?? 3001;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown — lets Railway drain in-flight requests cleanly
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
