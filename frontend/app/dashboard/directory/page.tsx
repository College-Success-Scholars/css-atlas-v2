import { DirectoryDashboard } from "@/components/dashboard/widgets/directory-dashboard";
import { canAccessWeeklyMemo } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/server/queries";

export default async function DirectoryPage() {
  const profile = await getCurrentProfile();
  // Team leader form history is team_leader+ only (same effective-role gate as
  // Memo); the by-uids form reads behind it 403 everyone else.
  return <DirectoryDashboard canViewTeamLeaderForms={canAccessWeeklyMemo(profile)} />;
}
