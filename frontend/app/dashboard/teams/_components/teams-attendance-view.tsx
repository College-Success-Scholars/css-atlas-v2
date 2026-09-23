/**
 * @file teams-attendance-view.tsx
 * @module frontend/app/dashboard/teams
 *
 * Server loader for the FD/SS teams boards. Fetches via BACKEND_URL so Railway
 * production does not depend on NEXT_PUBLIC_BACKEND_URL baked into the client.
 */
import { redirect } from "next/navigation";
import { dateToCampusWeek } from "@/lib/format/time";
import { getAttendanceWeekBoard } from "@/lib/server/data";
import { parseWeekParam } from "@/app/dashboard/memo/_lib/week-navigation";
import {
  TeamsAttendanceClient,
  TeamsPageFallback,
} from "./teams-attendance-client";
import type { AttendanceKind, AttendanceWeekBoard } from "@/lib/types/attendance-week";

export { TeamsPageFallback };

export type TeamsAttendanceViewProps = {
  kind: AttendanceKind;
  title: string;
  basePath: string;
  weekParam?: string;
};

export async function TeamsAttendanceView({
  kind,
  title,
  basePath,
  weekParam,
}: TeamsAttendanceViewProps) {
  const currentCampusWeek = dateToCampusWeek(new Date());
  const yearStarted = currentCampusWeek != null;
  const parsedWeek = parseWeekParam(weekParam);
  const weekNum = parsedWeek ?? currentCampusWeek ?? 1;

  if (yearStarted && parsedWeek == null) {
    redirect(`${basePath}?week=${currentCampusWeek}`);
  }

  let board: AttendanceWeekBoard | null = null;
  let error: string | null = null;
  if (yearStarted) {
    try {
      board = await getAttendanceWeekBoard(weekNum, kind);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load board";
    }
  }

  return (
    <TeamsAttendanceClient
      kind={kind}
      title={title}
      basePath={basePath}
      weekNum={weekNum}
      currentCampusWeek={currentCampusWeek}
      board={board}
      error={error}
    />
  );
}
