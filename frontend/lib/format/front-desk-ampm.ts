/**
 * @file front-desk-ampm.ts
 * @module frontend/lib/format
 *
 * Re-exports the Front Desk AM/PM checklist config and helpers from the shared
 * library. Gives frontend components a stable local import path so they don't
 * reference shared/dist/ directly.
 *
 * ## What belongs here
 * - Re-exports from shared/dist/front-desk-ampm-config.js only
 *
 * ## What does NOT belong here
 * - Shift timing logic (it lives in shared/front-desk-ampm-config.ts so the
 *   backend applies exactly the same rule)
 */
export * from "../../../shared/dist/front-desk-ampm-config.js";
