/**
 * @file queries.ts
 * @module frontend/lib/server
 *
 * React-cached query functions for frequently-needed data that may be called
 * from multiple Server Components in the same request. Uses React's `cache()`
 * to deduplicate requests within a single render pass.
 *
 * ## Responsibilities
 * - Provide cache()-wrapped getters for shared data (e.g. active semester, current user)
 * - Ensure the same data is not fetched multiple times per request
 *
 * ## What belongs here
 * - cache()-wrapped calls to backendGet or lib/supabase/server.ts helpers
 * - Queries called from multiple layout/page components in the same request
 *
 * ## What does NOT belong here
 * - Non-cached queries (use data.ts for those)
 * - Mutations (use actions.ts)
 */
import { cache } from "react";
import { backendGet } from "./api-client";

export type CurrentUserResponse = {
  user: { id: string; email: string | null };
  profile: Record<string, unknown> | null;
  realProfile?: Record<string, unknown> | null;
  activeTestProfileId?: string | null;
  isActingAsTestProfile?: boolean;
};

/**
 * Fetches GET /api/auth/semester. Use sparingly — prefer the server-owned time
 * frame (shared campus week calendar) for week bounds and navigation. Use this
 * when that time frame does not make sense (e.g. historical data, or the
 * collection year has not started yet).
 */
export const getActiveSemester = cache(async () => {
  return backendGet<{ id: number; iso_week_offset: number; start_date: string; end_date: string }>("/api/auth/semester");
});

export const getCurrentUser = cache(async (): Promise<CurrentUserResponse | null> => {
  try {
    return await backendGet<CurrentUserResponse>("/api/auth/me");
  } catch {
    return null;
  }
});

export const getCurrentProfile = cache(async () => {
  const me = await getCurrentUser();
  return me?.profile ?? null;
});

export const getMyMentees = cache(async () => {
  return backendGet<Array<Record<string, unknown>>>("/api/auth/mentees");
});
