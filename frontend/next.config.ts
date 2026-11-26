/**
 * @file next.config.ts
 * @module frontend
 *
 * Next.js configuration for the CSS Atlas frontend.
 * Enables access to files above the Next.js project root (externalDir)
 * so both webpack and Turbopack can resolve the symlinked @css-atlas/shared package.
 *
 * ## What belongs here
 * - Next.js build and runtime configuration
 * - Turbopack/webpack root settings for shared library resolution
 *
 * ## What does NOT belong here
 * - Environment variable defaults (use .env.local)
 * - Route configuration (that's in app/ directory structure)
 */
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
/** Repo root — @css-atlas/shared is a symlink to ../shared, so Turbopack needs the repo root. */
const repoRoot = path.resolve(frontendDir, "..");

const nextConfig: NextConfig = {
  // Deployment envs only set the server-only BACKEND_URL (read by lib/server/api-client.ts).
  // Browser code can only ever see NEXT_PUBLIC_-prefixed vars inlined at build time, so alias
  // it here — this is a name bridge for one existing var, not a hardcoded default/fallback value.
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL,
  },
  output: "standalone",
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
