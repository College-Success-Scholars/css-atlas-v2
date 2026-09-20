/**
 * @file semester.controller.ts
 * @module backend/controllers
 *
 * Active-semester lookup. Mounted at /api/auth/semester and
 * /api/auth/active-semester by routes/auth.routes.ts.
 *
 * ## Responsibilities
 * - getActiveSemester
 *
 * ## What does NOT belong here
 * - JWT verification or profile resolution (middleware/auth.middleware.ts)
 */
import { getSupabaseClient } from "../supabase/client.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/auth/semester and GET /api/auth/active-semester.
 *
 * Use sparingly — prefer the server-owned time frame (shared campus week calendar
 * in shared/time-config + campus-calendar) for week bounds and queries. Use this
 * when the server-owned time frame does not make sense (e.g. historical data, or
 * the collection year has not started yet), or when you need the Supabase
 * `semesters` row (semester_id / legacy ISO-week needs).
 */
export const getActiveSemester = asyncHandler(async (_req, res) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("semesters")
    .select("id, iso_week_offset, start_date, end_date")
    .eq("is_active", true)
    .single();
  if (error) throw error;
  res.json({ data });
});
