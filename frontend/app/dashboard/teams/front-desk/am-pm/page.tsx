import { Suspense } from "react";
import { AmPmChecklistView } from "../../_components/am-pm-checklist-view";
import { TeamsPageFallback } from "../../_components/teams-attendance-client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ week?: string }>;
};

/** TL+ gate comes from app/dashboard/teams/layout.tsx. */
export default async function FrontDeskAmPmPage({ searchParams }: PageProps) {
  const { week } = await searchParams;

  return (
    <Suspense key={week ?? "current"} fallback={<TeamsPageFallback />}>
      <AmPmChecklistView weekParam={week} />
    </Suspense>
  );
}
