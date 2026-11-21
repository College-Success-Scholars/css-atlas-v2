/**
 * @file semester.service.ts
 * @module backend/services
 *
 * Active-semester reads for the mentee review. Uses maybeSingle so an absent
 * active semester is a valid state rather than an error.
 *
 * ## Responsibilities
 * - Read the active `semesters` row
 *
 * ## What does NOT belong here
 * - Campus-week numbering (shared campus calendar)
 * - Handlers (semester.controller)
 */
import type { ActiveSemesterRow } from "@css-atlas/shared/contracts/auth";
import { getSupabaseClient } from "../supabase/client.js";

// Wire shape is defined once, in the API contract.
export type { ActiveSemesterRow } from "@css-atlas/shared/contracts/auth";

export async function getActiveSemesterRow(): Promise<ActiveSemesterRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("semesters")
    .select("id, iso_week_offset, start_date, end_date")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as ActiveSemesterRow | null) ?? null;
}
