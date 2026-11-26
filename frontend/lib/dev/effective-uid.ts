/**
 * @file effective-uid.ts
 * @module frontend/lib/dev
 *
 * Resolves the effective scholar/roster uid from a profile (real or test overlay).
 */
import { getEffectiveScholarId } from "@css-atlas/shared/auth";

export { getEffectiveScholarId };

/** Alias matching plan naming. */
export const effectiveScholarId = getEffectiveScholarId;
