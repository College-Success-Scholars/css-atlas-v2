import { Suspense } from "react";
import {
  TeamsAttendanceView,
  TeamsPageFallback,
} from "../_components/teams-attendance-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function StudyTeamsPage({ searchParams }: PageProps) {
  const { week } = await searchParams;

  return (
    <Suspense key={week ?? "current"} fallback={<TeamsPageFallback />}>
      <TeamsAttendanceView
        kind="study_session"
        title="Study sessions"
        basePath="/dashboard/teams/study"
        weekParam={week}
      />
    </Suspense>
  );
}
