/**
 * @file next.config.ts
 * @module frontend
 *
 * Next.js configuration for the CSS Atlas frontend.
 * Enables access to files above the Next.js project root (externalDir)
 * so both webpack and Turbopack can resolve shared/dist/ imports.
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
/** Repo root — Turbopack must see `shared/dist` via relative imports. */
const repoRoot = path.resolve(frontendDir, "..");

const nextConfig: NextConfig = {
  // Allow webpack builds to access files above the Next.js project root.
  experimental: {
    externalDir: true,
  },

  // Absolute monorepo root so Turbopack can resolve ../../../shared/dist/*.
  // `next` itself is installed under frontend/node_modules — scripts/dev.sh
  // symlinks it to <repo>/node_modules/next so HMR does not panic with
  // "Next.js package not found".
  turbopack: {
    root: repoRoot,
  },

  // Deployment envs only set the server-only BACKEND_URL (read by lib/server/api-client.ts).
  // Browser code can only ever see NEXT_PUBLIC_-prefixed vars inlined at build time, so alias
  // it here — this is a name bridge for one existing var, not a hardcoded default/fallback value.
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL,
  },
};

export default nextConfig;
