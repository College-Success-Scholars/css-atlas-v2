import { redirect } from "next/navigation";
import { MenteeMonitoringClient } from "@/components/mentee-monitoring/mentee-monitoring-client";
import { canAccessMenteeMonitoring } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/server/queries";
import { fetchAttendanceForUids, fetchMenteesWithCompliance } from "@/lib/server/data";
import { backendPost } from "@/lib/server/api-client";
import { campusWeekToDateRange, dateToCampusWeek } from "@/lib/format/time";
import { parseWeekParam } from "@/app/dashboard/memo/_lib/week-navigation";
import type { WahfRow, TutoringRow, MenteeWithCompliance } from "@/lib/types/supabase";
import type { AttendanceForUids } from "@/lib/types/attendance-week";

type PageProps = {
  searchParams: Promise<{ week?: string; uid?: string }>;
};

function menteeHref(week: number | null, uid?: string | null) {
  const params = new URLSearchParams();
  if (week != null && week > 0) params.set("week", String(week));
  if (uid) params.set("uid", uid);
  const query = params.toString();
  return query ? `/dashboard/mentee?${query}` : "/dashboard/mentee";
}

export default async function MenteePage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!canAccessMenteeMonitoring(profile)) {
    redirect("/dashboard");
  }

  const { week: weekParam, uid: uidParam } = await searchParams;
  const currentCampusWeek = dateToCampusWeek(new Date());
  const yearStarted = currentCampusWeek != null;
  const parsedWeek = parseWeekParam(weekParam);
  const selectedWeek = parsedWeek ?? currentCampusWeek;

  if (yearStarted && parsedWeek == null && currentCampusWeek != null) {
    redirect(menteeHref(currentCampusWeek, uidParam ?? null));
  }

  const complianceRange =
    selectedWeek == null ? null : campusWeekToDateRange(selectedWeek);
  const mentees = complianceRange
    ? await fetchMenteesWithCompliance(complianceRange.startDate, complianceRange.endDate)
    : [];

  const menteeUids = (mentees as Array<{ scholar_uid?: string }>)
    .map((m) => m.scholar_uid)
    .filter(Boolean) as string[];

  const selectedUid =
    uidParam && menteeUids.includes(uidParam) ? uidParam : menteeUids[0] ?? null;

  const emptyAttendance: AttendanceForUids = {
    week_num: selectedWeek ?? 0,
    week_start: "",
    rows: [],
  };

  const [attendance, wahf, tutoring] = await Promise.all([
    menteeUids.length && selectedWeek != null
      ? fetchAttendanceForUids(selectedWeek, menteeUids)
      : Promise.resolve(emptyAttendance),
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
        attendance={attendance}
        wahf={wahf as WahfRow[]}
        tutoring={tutoring as TutoringRow[]}
        currentCampusWeek={currentCampusWeek}
        selectedWeek={selectedWeek}
        selectedUid={selectedUid}
      />
    </div>
  );
}
