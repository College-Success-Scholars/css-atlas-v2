/**
 * @file teams-tutoring-view.tsx
 * @module frontend/app/dashboard/teams
 *
 * Server loader for the tutoring teams page. Fetches via BACKEND_URL so Railway
 * production does not depend on NEXT_PUBLIC_BACKEND_URL baked into the client.
 */
import { redirect } from "next/navigation";
import { dateToCampusWeek } from "@/lib/format/time";
import { getTutorReportWeekRows } from "@/lib/server/data";
import { parseWeekParam } from "@/app/dashboard/memo/_lib/week-navigation";
import { TeamsTutoringClient } from "./teams-tutoring-client";
import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log";

export type TeamsTutoringViewProps = {
  basePath: string;
  weekParam?: string;
};

export async function TeamsTutoringView({
  basePath,
  weekParam,
}: TeamsTutoringViewProps) {
  const currentCampusWeek = dateToCampusWeek(new Date());
  const yearStarted = currentCampusWeek != null;
  const parsedWeek = parseWeekParam(weekParam);
  const weekNum = parsedWeek ?? currentCampusWeek ?? 1;

  if (yearStarted && parsedWeek == null) {
    redirect(`${basePath}?week=${currentCampusWeek}`);
  }

  let rows: TutorReportWeekRow[] | null = null;
  let error: string | null = null;
  if (yearStarted) {
    try {
      rows = await getTutorReportWeekRows(weekNum);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load tutoring sessions";
    }
  }

  return (
    <TeamsTutoringClient
      basePath={basePath}
      weekNum={weekNum}
      currentCampusWeek={currentCampusWeek}
      rows={rows}
      error={error}
    />
  );
}
