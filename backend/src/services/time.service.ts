/**
 * @file time.service.ts
 * @module backend/services
 *
 * Re-exports all time utilities from the shared library.
 * This file acts as a stable internal import alias for the shared package,
 * so backend code imports from "./time.service.js" rather than referencing
 * the shared dist path directly. Keeps all time utilities accessible via
 * a consistent backend-local path.
 *
 * ## What belongs here
 * - Re-exports from @css-atlas/shared/time only
 *
 * ## What does NOT belong here
 * - Any time logic that is not in the shared library (add it to shared/src/ instead)
 * - Any Supabase or HTTP logic
 */
export * from "@css-atlas/shared/time";
