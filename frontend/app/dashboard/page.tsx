/**
 * @file page.tsx
 * @module frontend/app/dashboard
 *
 * Main dashboard page (/dashboard).
 * Renders the role-appropriate dashboard via resolveUserRole(): scholar,
 * team-leader/developer, or default.
 *
 * ## What belongs here
 * - Role detection and dashboard variant selection
 * - Top-level data fetching passed to dashboard components
 *
 * ## What does NOT belong here
 * - Dashboard UI components (those are in components/dashboard/)
 */
import { TeamLeaderDashboard } from "@/components/dashboard/roles/team-leader-dashboard";
import { ScholarDashboard } from "@/components/dashboard/roles/scholar-dashboard";
import { DefaultDashboard } from "@/components/dashboard/roles/default-dashboard";
import { getRecentFormSubmissions } from "@/lib/server/data";
import { getCurrentUser } from "@/lib/server/queries";
import { canAccessMenteeMonitoring, resolveUserRole } from "@/lib/auth";

export default async function Page() {
  const me = await getCurrentUser();
  const profile = me?.profile as {
    app_role?: string | null;
    program_role?: string | null;
    mentee_count?: number | null;
    mentee_uids?: string[] | null;
    first_name?: string | null;
  } | null;
  const role = resolveUserRole(profile);

  if (role === "scholar") {
    const entries = await getRecentFormSubmissions({
      profile: me?.profile as { student_id?: string | null } | null,
    });
    return <ScholarDashboard me={me} entries={entries} />;
  }

  if (role === "team-leader" || role === "developer") {
    return (
      <TeamLeaderDashboard
        firstName={profile?.first_name}
        showMentees={canAccessMenteeMonitoring(profile)}
      />
    );
  }

  return <DefaultDashboard />;
}
