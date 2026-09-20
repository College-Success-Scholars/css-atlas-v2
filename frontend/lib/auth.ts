/**
 * @file auth.ts
 * @module frontend/lib
 *
 * Frontend role type definitions used to drive role-based UI rendering.
 * Maps to `profiles.app_role` and `profiles.program_role`; consumed by
 * app-sidebar.tsx and dashboard pages for conditional nav and content.
 *
 * ## Responsibilities
 * - Define the `UserRole` union type used across sidebar and dashboard components
 * - resolveUserRole(): map profile fields to sidebar/dashboard UserRole
 *
 * ## What belongs here
 * - Role type definitions for frontend UI branching
 *
 * ## What does NOT belong here
 * - Auth helpers that read from Supabase (use lib/supabase/server.ts)
 * - Role enforcement / access guards (use requireTeamLeaderOrAbove,
 *   requireCoordinatorOrAbove, requireDeveloper)
 */

import { hasRoleAtLeast, isDeveloperProfile } from "../../shared/dist/auth.js";

export { isDeveloperProfile };

export type UserRole = "scholar" | "team-leader" | "coordinator" | "developer" | "default";

type ProfileRoleFields = {
  app_role?: string | null;
  program_role?: string | null;
};

type MenteeProfileFields = {
  mentee_count?: number | null;
  mentee_uids?: string[] | null;
  user_roster?: {
    mentee_count?: number | null;
    mentee_uids?: string[] | null;
  } | null;
};

/** True when the profile has at least one assigned mentee (count or roster uids). */
export function hasAssignedMentees(profile: MenteeProfileFields | null | undefined): boolean {
  if (!profile) return false;

  const count = profile.mentee_count ?? profile.user_roster?.mentee_count ?? 0;
  if (count > 0) return true;

  const uids = profile.mentee_uids ?? profile.user_roster?.mentee_uids ?? [];
  return uids.length > 0;
}

/** Mentee monitoring is for team_leader+ users with at least one assigned mentee. */
export function canAccessMenteeMonitoring(
  profile: (ProfileRoleFields & MenteeProfileFields) | null | undefined,
): boolean {
  if (!hasRoleAtLeast(profile?.app_role ?? null, "team_leader")) return false;
  return hasAssignedMentees(profile);
}

/**
 * Weekly memo and other team-leader dashboards require team_leader or higher
 * (coordinator and developer included). Public `/traffic` kiosk check-in is
 * ungated (anyone may use it without signing in).
 */
export function canAccessWeeklyMemo(profile: ProfileRoleFields | null | undefined): boolean {
  return hasRoleAtLeast(profile?.app_role ?? null, "team_leader");
}

/**
 * Coordinator View and freshman grades require coordinator or developer.
 * Ordinary team leaders do not pass.
 */
export function canAccessCoordinatorView(profile: ProfileRoleFields | null | undefined): boolean {
  return hasRoleAtLeast(profile?.app_role ?? null, "coordinator");
}

/**
 * Maps merged profile fields to the UI role used for nav and dashboard variants.
 * Scholars have app_role null and program_role "scholar".
 * Check developer, then coordinator, then team_leader so higher rungs do not
 * collapse into the team-leader home.
 */
export function resolveUserRole(profile: ProfileRoleFields | null | undefined): UserRole {
  if (!profile) return "default";

  const appRole = profile.app_role ?? null;
  if (appRole === "developer") return "developer";
  if (hasRoleAtLeast(appRole, "coordinator")) return "coordinator";
  if (hasRoleAtLeast(appRole, "team_leader")) return "team-leader";

  const programRole = (profile.program_role ?? "").toLowerCase();
  if (programRole === "scholar") return "scholar";

  return "default";
}

/** Human-readable label for dashboard chrome (breadcrumb, sidebar subtitle). */
export function formatUserRoleLabel(role: UserRole): string {
  switch (role) {
    case "scholar":
      return "Scholar";
    case "team-leader":
      return "Team Leader";
    case "coordinator":
      return "Coordinator";
    case "developer":
      return "Developer";
    default:
      return "Dashboard";
  }
}
