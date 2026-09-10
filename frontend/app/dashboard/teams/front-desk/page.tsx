import { Suspense } from "react";
import {
  TeamsAttendanceView,
  TeamsPageFallback,
} from "../_components/teams-attendance-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function FrontDeskTeamsPage({ searchParams }: PageProps) {
  const { week } = await searchParams;

  return (
    <Suspense key={week ?? "current"} fallback={<TeamsPageFallback />}>
      <TeamsAttendanceView
        kind="front_desk"
        title="Front desk"
        basePath="/dashboard/teams/front-desk"
        weekParam={week}
      />
    </Suspense>
  );
}
