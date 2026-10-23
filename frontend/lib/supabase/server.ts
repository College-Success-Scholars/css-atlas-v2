/**
 * @file server.ts
 * @module frontend/lib/supabase
 *
 * Server-side Supabase client factory and authentication helper functions.
 * This is the primary module for auth in Server Components, layouts, and pages.
 * Uses PKCE flow and reads/writes cookies via next/headers.
 *
 * ## Responsibilities
 * - createClient(): create a server-side Supabase client (call inside each function)
 * - getCurrentUser(): get current user or null (soft auth check)
 * - getCurrentUserWithProfile(): get user + merged profiles/user_roster row
 * - requireUser(): get user or throw (hard auth gate)
 * - requireUserWithProfile(): get user + profile or throw
 * - requireTeamLeaderOrAbove(): get user or redirect to /dashboard
 *   (effective role via /api/auth/me so acting-as personas redirect correctly)
 * - requireDeveloper(): get developer user or redirect to /dashboard
 * - getDeveloperUser(): soft check for developer role
 * - getTeamLeaderOrAboveUser(): soft check for team_leader+ role (effective profile)
 *
 * ## What belongs here
 * - Server-side Supabase auth client and all auth helper functions
 * - ProfilesRow type (merged profiles + user_roster shape)
 *
 * ## What does NOT belong here
 * - Domain data queries on non-auth tables (use lib/server/api-client.ts)
 * - Client-side auth (that's lib/supabase/client.ts)
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessWeeklyMemo } from "@/lib/auth";
import { getCurrentUser as getAuthMe } from "@/lib/server/queries";
import { getSupabasePublicKey } from "./public-key";
import { mergeProfileWithRoster } from "../../../shared/dist/auth.js";

/** Merged profile API shape (profiles + optional user_roster). `student_id` is Postgres text. */
export type ProfilesRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  program_role: string | null;
  app_role?: string | null;
  teams: string[] | null;
  emails: string[] | null;
  student_id: string | null;
  [key: string]: unknown;
};

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseKey = getSupabasePublicKey();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      auth: {
        flowType: "pkce",
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Auth helpers (use these in your data functions to protect from unauthorized access)
// ---------------------------------------------------------------------------

/**
 * Returns the current user or null. Use in data functions when you need to
 * know who is logged in without requiring auth (e.g. public + personalized views).
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the current auth user plus the matching row from `public.profiles` (if any),
 * with `user_roster` merged in for legacy fields. Matches by auth `user.id`.
 * Uses maybeSingle() so a missing profile returns null without error.
 */
export async function getCurrentUserWithProfile(): Promise<{
  user: User | null;
  profile: ProfilesRow | null;
}> {
  const user = await getCurrentUser();
  if (!user?.email) return { user, profile: null };

  const supabase = await createClient();
  const { data: profile, error } = await supabase.schema("public")
    .from("profiles")
    .select("*, user_roster!profiles_student_id_fkey(*)")
    .eq("id", user.id)
    .maybeSingle();
  // A failed read must not look like "no profile" (would route to onboarding).
  if (error) throw error;

  if (!profile) {
    return { user, profile: null };
  }
  mergeProfileWithRoster(profile);
  return { user, profile: profile as ProfilesRow };
}

/**
 * Like requireUser(), but also returns the profile from public.profiles (with linked user_roster).
 * Throws if not authenticated.
 */
export async function requireUserWithProfile(): Promise<{
  user: User;
  profile: ProfilesRow | null;
}> {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) throw new Error("Unauthorized");
  return { user, profile };
}

/**
 * Returns the current user or throws. Use for data that must never be
 * returned to unauthenticated users (e.g. private dashboard data).
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Returns the current user if they have team_leader access or higher, or null.
 * Hierarchy: null < team_leader < developer. Use for routes that require team_leader or developer.
 *
 * Role is taken from GET /api/auth/me (effective profile) so developer "acting as"
 * personas are honored the same way as sidebar gating and backend middleware.
 * Falls back to the Supabase profiles row when /api/auth/me is unavailable.
 */
export async function getTeamLeaderOrAboveUser(): Promise<User | null> {
  const { user, profile: supabaseProfile } = await getCurrentUserWithProfile();
  if (!user) return null;

  const me = await getAuthMe();
  const effectiveProfile = (me?.profile ?? supabaseProfile) as {
    app_role?: string | null;
  } | null;

  return canAccessWeeklyMemo(effectiveProfile) ? user : null;
}

/**
 * Returns the current user if they have developer access, or null.
 * Developer access is determined by profile.app_role === 'developer' (merged profiles + user_roster).
 * app_role is not editable in the app; set it in SQL on public.profiles.
 * Uses the **real** Supabase profiles row (not the acting-as persona overlay).
 * That is intentional: `/dev` and developer capability must stay available while
 * acting as a scholar/TL test profile. For persona-aware role gates, use
 * `getCurrentProfile()` / `GET /api/auth/me` instead.
 */
export async function getDeveloperUser(): Promise<User | null> {
  const { user, profile } = await getCurrentUserWithProfile();

  if (!user) return null;
  return profile?.app_role === "developer" ? user : null;
}

/**
 * Returns the current user or redirects to /dashboard. Use for routes that require team_leader or higher.
 * Redirects if the user is not team_leader or developer.
 */
export async function requireTeamLeaderOrAbove(): Promise<User> {
  const user = await getTeamLeaderOrAboveUser();
  if (!user) {
    redirect("/dashboard");
  }
  return user;
}

/**
 * Returns the current user or redirects to /dashboard. Use for routes that require developer access only.
 * Redirects to dashboard if the user is not a developer.
 */
export async function requireDeveloper(): Promise<User | null> {
  const user = await getDeveloperUser();
  if (!user) {

    redirect("/dashboard");
  }
  return user;
}
