import { redirect } from "next/navigation";
import { canAccessWeeklyMemo } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/server/queries";

/**
 * FD/SS/Tutoring teams pages are team_leader+ (same gate as Weekly Memo).
 */
export default async function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!canAccessWeeklyMemo(profile)) {
    redirect("/dashboard");
  }
  return children;
}
