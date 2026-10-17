/**
 * @file am-pm-checklist-view.tsx
 * @module frontend/app/dashboard/teams
 *
 * Server loader for the Front Desk AM/PM checklist board. Owns campus-week
 * resolution, the redirect, and the fetch; the client owns week nav, tabs,
 * and the table.
 *
 * Reads only — intake stays Google Forms → Supabase.
 */
import { dateToCampusWeek } from "@/lib/format/time";
import { parseWeekParam } from "@/app/dashboard/memo/_lib/week-navigation";
import { getAmPmChecklistForWeek } from "@/lib/server/data";
import { redirect } from "next/navigation";
import { AM_PM_BASE_PATH, AmPmChecklistClient } from "./am-pm-checklist-client";
import type { AmPmChecklistRow } from "@/lib/types/am-pm-checklist";

export type AmPmChecklistViewProps = {
  weekParam?: string;
};

export async function AmPmChecklistView({ weekParam }: AmPmChecklistViewProps) {
  const currentCampusWeek = dateToCampusWeek(new Date());
  const yearStarted = currentCampusWeek != null;
  const parsedWeek = parseWeekParam(weekParam);
  const weekNum = parsedWeek ?? currentCampusWeek ?? 1;

  if (yearStarted && parsedWeek == null) {
    redirect(`${AM_PM_BASE_PATH}?week=${currentCampusWeek}`);
  }

  let rows: AmPmChecklistRow[] = [];
  let error: string | null = null;
  if (yearStarted) {
    try {
      rows = await getAmPmChecklistForWeek(weekNum);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load AM/PM checklist";
    }
  }

  return (
    <AmPmChecklistClient
      weekNum={weekNum}
      currentCampusWeek={currentCampusWeek}
      rows={rows}
      error={error}
    />
  );
}
