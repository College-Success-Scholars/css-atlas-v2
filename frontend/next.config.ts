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

const nextConfig: NextConfig = {
  // Allow webpack builds to access files above the Next.js project root.
  experimental: {
    externalDir: true,
  },

  // Turbopack workspace root (Next.js 15.3+).
  // Sets the root one level above frontend/ so Turbopack can resolve
  // ../../../shared/dist/ imports from lib/format/time.ts and lib/types/time.ts.
  turbopack: {
    root: "..",
  },

  // Deployment envs only set the server-only BACKEND_URL (read by lib/server/api-client.ts).
  // Browser code can only ever see NEXT_PUBLIC_-prefixed vars inlined at build time, so alias
  // it here — this is a name bridge for one existing var, not a hardcoded default/fallback value.
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL,
  },
};

export default nextConfig;
