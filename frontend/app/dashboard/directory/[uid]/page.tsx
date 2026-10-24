import { notFound, redirect } from "next/navigation";

import { MenteeMonitoringClient } from "@/components/mentee-monitoring/mentee-monitoring-client";
import styles from "@/components/mentee-monitoring/mentee-review.module.css";
import { canAccessWeeklyMemo } from "@/lib/auth";
import { parseWeekParam } from "@/lib/format/campus-week";
import { dateToCampusWeek } from "@/lib/format/time";
import { fetchDirectoryMenteeReview } from "@/lib/server/data";
import { getCurrentProfile } from "@/lib/server/queries";
import type { MenteeReview } from "@/lib/types/mentee-review";

type PageProps = {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ week?: string }>;
};

function scholarHref(uid: string, week: number | null) {
  const params = new URLSearchParams();
  if (week != null && week > 0) params.set("week", String(week));
  const query = params.toString();
  const path = `/dashboard/directory/${encodeURIComponent(uid)}`;
  return query ? `${path}?${query}` : path;
}

export default async function DirectoryScholarPage({ params, searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  // Weekly review data is team-leader+ only. Scholars keep the directory modal.
  if (!canAccessWeeklyMemo(profile)) {
    redirect("/dashboard/directory");
  }

  const { uid: rawUid } = await params;
  const uid = rawUid?.trim();
  if (!uid) notFound();

  const { week: weekParam } = await searchParams;
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
    redirect(scholarHref(uid, selectedWeek));
  }

  let review: MenteeReview;
  try {
    review = await fetchDirectoryMenteeReview(uid, selectedWeek);
  } catch (error) {
    // Not a mentee (or not visible under RLS): the directory keeps its modal.
    if (error instanceof Error && error.message === "Mentee not found") {
      notFound();
    }
    throw error;
  }

  return (
    <div className={`${styles.surface} min-h-full px-4 pt-7 pb-16 sm:px-6`}>
      <div className="mx-auto w-full max-w-[1160px]">
        <MenteeMonitoringClient
          mentees={[review.mentee]}
          review={review}
          selectedWeek={selectedWeek}
          detailPath={scholarHref(uid, null)}
        />
      </div>
    </div>
  );
}
