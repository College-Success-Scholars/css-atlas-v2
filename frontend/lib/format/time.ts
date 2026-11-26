/**
 * @file time.ts
 * @module frontend/lib/format
 *
 * Re-exports all time formatting and calendar utilities from the shared library.
 * Provides frontend components and lib files with a stable local import path
 * for shared time utilities, so they don't need to reference @css-atlas/shared directly.
 *
 * ## What belongs here
 * - Re-exports from @css-atlas/shared/time only
 *
 * ## What does NOT belong here
 * - Any frontend-specific time logic (add to shared/ if it's truly shared, or keep in components if it's UI-only)
 */
export * from "@css-atlas/shared/time";
