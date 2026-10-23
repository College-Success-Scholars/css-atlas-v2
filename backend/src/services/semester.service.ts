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
 * - HTTP handlers (semester.controller)
 */
import { getSupabaseClient } from "../supabase/client.js";

export interface ActiveSemesterRow {
  id: number;
  iso_week_offset: number | null;
  start_date: string;
  end_date: string;
}

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
