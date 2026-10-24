import { redirect } from "next/navigation";

import { MenteeMonitoringClient } from "@/components/mentee-monitoring/mentee-monitoring-client";
import { canAccessMenteeMonitoring } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/server/queries";
import { fetchMenteeReview, fetchMentees } from "@/lib/server/data";
import { dateToCampusWeek } from "@/lib/format/time";
import { parseWeekParam } from "@/lib/format/campus-week";
import type { MenteeReview } from "@/lib/types/mentee-review";
import styles from "@/components/mentee-monitoring/mentee-review.module.css";

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
  const requestedWeek = parseWeekParam(weekParam);

  // The current week is the ceiling: never select or fetch a future week.
  const selectedWeek =
    currentCampusWeek == null
      ? null
      : requestedWeek == null
        ? currentCampusWeek
        : Math.min(requestedWeek, currentCampusWeek);

  if (selectedWeek != null && selectedWeek !== requestedWeek) {
    redirect(menteeHref(selectedWeek, uidParam ?? null));
  }

  // Switcher options are the caller's assigned mentees (RLS-scoped).
  const mentees = await fetchMentees();
  const selectedUid =
    uidParam && mentees.some((mentee) => mentee.uid === uidParam)
      ? uidParam
      : mentees[0]?.uid ?? null;

  let review: MenteeReview | null = null;
  if (selectedUid) {
    review = await fetchMenteeReview(selectedUid, selectedWeek);
  }

  return (
    <div className={`${styles.surface} min-h-full px-4 pt-7 pb-16 sm:px-6`}>
      <div className="mx-auto w-full max-w-[1160px]">
        <MenteeMonitoringClient
          mentees={mentees}
          review={review}
          selectedWeek={selectedWeek}
        />
      </div>
    </div>
  );
}
