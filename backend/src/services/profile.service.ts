/**
 * @file profile.service.ts
 * @module backend/services
 *
 * The signed-in user's own `profiles` row: read it, and create it during
 * self-service onboarding.
 *
 * ## What does NOT belong here
 * - Directory or roster management of other users (user.service)
 * - Authentication (middleware/auth.middleware.ts)
 */
import { getSupabaseClient } from "../supabase/client.js";
import { ConflictError } from "../utils/domain-error.js";
import { createScholarProfile, type CreateScholarProfileInput } from "./user.service.js";

/** The caller's `profiles` row, or null when onboarding has not happened yet. */
export async function getProfileById(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Create the caller's scholar profile. A duplicate key means the row exists
 * but was not visible on the caller's earlier read (e.g. an embed failure).
 */
export async function createOwnProfile(input: CreateScholarProfileInput) {
  try {
    return await createScholarProfile(input);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/duplicate key|unique constraint|profiles_pkey/i.test(message)) {
      throw new ConflictError({ message: "Profile already exists" });
    }
    throw e;
  }
}
