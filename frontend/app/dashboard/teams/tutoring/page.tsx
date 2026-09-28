import { Suspense } from "react";
import { TeamsPageFallback } from "../_components/teams-attendance-view";
import { TeamsTutoringView } from "../_components/teams-tutoring-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function TutoringTeamsPage({ searchParams }: PageProps) {
  const { week } = await searchParams;

  return (
    <Suspense key={week ?? "current"} fallback={<TeamsPageFallback />}>
      <TeamsTutoringView
        basePath="/dashboard/teams/tutoring"
        weekParam={week}
      />
    </Suspense>
  );
}
