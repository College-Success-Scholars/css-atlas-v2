/**
 * @file am-pm-checklist-client.tsx
 * @module frontend/app/dashboard/teams
 *
 * Front Desk AM/PM checklist board. Layout follows the FD/SS attendance board
 * (header + week nav + board tabs + table).
 *
 * Shift validity is the only timing verdict: did the scholar submit during the
 * shift they claimed, allowing an hour's grace after it ends? The rule itself
 * lives in shared/front-desk-ampm-config.ts so the API applies the same one.
 *
 * ## What does NOT belong here
 * - The timing rule (shared config)
 * - Data loading (the server view component)
 */
"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/data-display/data-table";
import { CampusWeekUrlNav } from "@/components/data-display/campus-week-nav";
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state";
import { campusWeekNumbers } from "@/lib/format/campus-week";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TeamsViewTabs } from "./teams-view-tabs";
import type { AmPmChecklistRow } from "@/lib/types/am-pm-checklist";

export const AM_PM_BASE_PATH = "/dashboard/teams/front-desk/am-pm";

/** All program times are Eastern, regardless of the viewer's own timezone. */
const ET_TIMESTAMP = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return ET_TIMESTAMP.format(date);
}

function dash() {
  return <span className="text-muted-foreground">—</span>;
}

export type AmPmChecklistClientProps = {
  weekNum: number;
  currentCampusWeek: number | null;
  rows: AmPmChecklistRow[];
  error: string | null;
};

export function AmPmChecklistClient({
  weekNum,
  currentCampusWeek,
  rows,
  error,
}: AmPmChecklistClientProps) {
  const yearStarted = currentCampusWeek != null;
  const weeks = useMemo(() => campusWeekNumbers(currentCampusWeek), [currentCampusWeek]);
  const needsFollowUp = useMemo(() => rows.filter((r) => r.reminderOwed).length, [rows]);

  const columns: DataTableColumn<AmPmChecklistRow>[] = useMemo(
    () => [
      {
        id: "shift",
        header: "Shift",
        field: "shift",
        sortable: true,
        renderCell: (row) =>
          row.shift ? (
            <span className="text-xs">{row.shift}</span>
          ) : (
            <span className="text-muted-foreground text-xs italic">not set</span>
          ),
      },
      {
        id: "submitted",
        header: "Submitted",
        field: "submittedAt",
        sortable: true,
        getSortValue: (row) => row.submittedAt ?? "",
        renderCell: (row) => (
          <span className="text-xs tabular-nums">{formatSubmittedAt(row.submittedAt)}</span>
        ),
      },
      {
        id: "leader",
        header: "Leader",
        field: "leaderName",
        sortable: true,
        getSortValue: (row) => row.leaderMatch?.displayName ?? row.leaderName ?? "",
        renderCell: (row) => {
          if (row.leaderMatch) {
            return (
              <Link
                href={`/dev/profiles/${row.leaderMatch.uid}`}
                className="text-xs underline underline-offset-2 hover:text-foreground"
              >
                {row.leaderMatch.displayName}
              </Link>
            );
          }
          if (row.leaderName) {
            return (
              <span className="flex flex-col">
                <span className="text-xs">{row.leaderName}</span>
                <span className="text-muted-foreground text-[11px]">no roster match</span>
              </span>
            );
          }
          return dash();
        },
      },
      {
        id: "tasks",
        header: "Tasks",
        field: "tasksCompleted",
        sortable: true,
        getSortValue: (row) => (row.tasksTotal ? row.tasksCompleted / row.tasksTotal : 0),
        renderCell: (row) => (
          <span className="text-xs tabular-nums">
            {row.tasksCompleted}/{row.tasksTotal}
          </span>
        ),
      },
      {
        id: "shiftValid",
        header: "Shift valid",
        field: "shiftValid",
        sortable: true,
        // Ascending puts the problems first.
        getSortValue: (row) => (row.shiftValid ? 1 : 0),
        renderCell: (row) =>
          row.shiftValid ? (
            <Badge variant="success">Valid</Badge>
          ) : (
            <Badge variant="destructive">Outside shift</Badge>
          ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Front desk AM/PM</h1>
          <p className="text-muted-foreground text-sm">
            Checklist submissions and shift integrity for this duty week
          </p>
        </div>
        {yearStarted ? (
          <CampusWeekUrlNav
            selectedWeek={weekNum}
            weeks={weeks}
            currentCampusWeek={currentCampusWeek}
            basePath={AM_PM_BASE_PATH}
          />
        ) : null}
      </div>

      {!yearStarted ? (
        <YearNotStartedState />
      ) : (
        <>
          <TeamsViewTabs activeHref={AM_PM_BASE_PATH} weekNum={weekNum} />

          {error ? (
            <Card>
              <CardContent className="text-destructive py-6 text-sm">{error}</CardContent>
            </Card>
          ) : (
            <>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                <span>
                  {rows.length} {rows.length === 1 ? "submission" : "submissions"}
                </span>
                <span aria-hidden>·</span>
                {needsFollowUp > 0 ? (
                  <Badge variant="warning">{needsFollowUp} need follow-up</Badge>
                ) : (
                  <Badge variant="success">All submitted in shift</Badge>
                )}
              </div>

              <DataTable
                data={rows}
                rowKeyField="id"
                nameColumn={{
                  field: "scholarName",
                  fallbackField: "scholarUid",
                  sortable: true,
                }}
                columns={columns}
                defaultSortColumnId="shiftValid"
                defaultSortDirection="asc"
                emptyMessage="No AM/PM checklist submissions for this week"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
