import { redirect } from "next/navigation";
import { MenteeMonitoringClient } from "@/components/mentee-monitoring/mentee-monitoring-client";
import { canAccessMenteeMonitoring } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/server/queries";
import { fetchMenteesWithCompliance } from "@/lib/server/data";
import { backendPost } from "@/lib/server/api-client";
import { campusWeekToDateRange, dateToCampusWeek } from "@/lib/format/time";
import type { ActivityRow, WahfRow, TutoringRow, MenteeWithCompliance } from "@/lib/types/supabase";

export default async function MenteePage() {
  const profile = await getCurrentProfile();
  if (!canAccessMenteeMonitoring(profile)) {
    redirect("/dashboard");
  }

  const currentCampusWeek = dateToCampusWeek(new Date());
  const complianceRange = currentCampusWeek == null ? null : campusWeekToDateRange(currentCampusWeek);
  const mentees = complianceRange
    ? await fetchMenteesWithCompliance(complianceRange.startDate, complianceRange.endDate)
    : [];

  const menteeUids = (mentees as Array<{ scholar_uid?: string }>)
    .map((m) => m.scholar_uid)
    .filter(Boolean) as string[];

  const [activity, wahf, tutoring] = await Promise.all([
    menteeUids.length
      ? backendPost<ActivityRow[]>("/api/form-logs/daily-activity/by-uids", { uids: menteeUids })
      : Promise.resolve([] as ActivityRow[]),
    menteeUids.length
      ? backendPost<WahfRow[]>("/api/form-logs/whaf/by-uids", { uids: menteeUids })
      : Promise.resolve([] as WahfRow[]),
    menteeUids.length
      ? backendPost<TutoringRow[]>("/api/form-logs/tutor-reports/by-uids", { uids: menteeUids })
      : Promise.resolve([] as TutoringRow[]),
  ]);

  return (
    <div className="space-y-6">
      <MenteeMonitoringClient
        mentees={mentees as MenteeWithCompliance[]}
        activity={activity as ActivityRow[]}
        wahf={wahf as WahfRow[]}
        tutoring={tutoring as TutoringRow[]}
        currentCampusWeek={currentCampusWeek}
      />
    </div>
  );
}
