/**
 * @file teams-tutoring-client.tsx
 * @module frontend/app/dashboard/teams
 *
 * Tutoring teams page: campus-week tutor report forms, session detail, and remove.
 * Layout follows the FD/SS teams boards (header + week nav + section card).
 * Rows are loaded on the server; this client owns week nav, detail, and delete UI.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/data-display/data-table";
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state";
import { CampusWeekUrlNav } from "@/components/data-display/campus-week-nav";
import { campusWeekNumbers } from "@/lib/format/campus-week";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteTutorReportAction } from "@/lib/server/actions";
import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log";
import {
  TutoringSessionDialog,
  tutoringSessionTimeLabel,
} from "./tutoring-session-dialog";

export type TeamsTutoringClientProps = {
  basePath: string;
  weekNum: number;
  currentCampusWeek: number | null;
  rows: TutorReportWeekRow[] | null;
  error: string | null;
};

const DAY_SORT_MAP: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const columns: DataTableColumn<TutorReportWeekRow>[] = [
  {
    id: "tutor",
    header: "Tutor",
    field: "tutor_name",
    cellClassName: "font-medium",
    sortable: true,
  },
  {
    id: "day",
    header: "Day",
    field: "day_of_week",
    sortable: true,
    getSortValue: (row) => DAY_SORT_MAP[row.day_of_week] ?? 7,
  },
  {
    id: "time",
    header: "Time",
    field: "start_time",
    sortable: true,
    renderCell: (row) => <span>{tutoringSessionTimeLabel(row)}</span>,
  },
  {
    id: "scholar",
    header: "Scholar",
    field: "scholar_name",
    sortable: true,
  },
  {
    id: "courses",
    header: "Courses",
    field: "courses",
    renderCell: (row) => <span>{row.courses.join(", ")}</span>,
  },
];

export function TeamsTutoringClient({
  basePath,
  weekNum,
  currentCampusWeek,
  rows,
  error,
}: TeamsTutoringClientProps) {
  const router = useRouter();
  const yearStarted = currentCampusWeek != null;
  const weeks = useMemo(
    () => campusWeekNumbers(currentCampusWeek),
    [currentCampusWeek],
  );

  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [selectedRow, setSelectedRow] = useState<TutorReportWeekRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const visibleRows = useMemo(
    () => (rows ?? []).filter((row) => !removedIds.has(row.id)),
    [rows, removedIds]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tutoring</h1>
          <p className="text-muted-foreground text-sm">
            Tutor report forms for this campus week
          </p>
        </div>
        {yearStarted ? (
          <CampusWeekUrlNav
            selectedWeek={weekNum}
            weeks={weeks}
            currentCampusWeek={currentCampusWeek}
            basePath={basePath}
          />
        ) : null}
      </div>

      {!yearStarted ? (
        <YearNotStartedState />
      ) : (
        <>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {rows ? (
            <Card className="gap-0 py-0 overflow-hidden">
              <CardHeader className="border-b px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    Tutoring sessions
                  </CardTitle>
                  <span className="text-muted-foreground text-xs">
                    {visibleRows.length} forms · select a row for details
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {visibleRows.length === 0 ? (
                  <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                    No tutoring sessions this week.
                  </p>
                ) : (
                  <DataTable
                    data={visibleRows}
                    columns={columns}
                    rowKeyField="id"
                    defaultSortColumnId="day"
                    defaultSortDirection="asc"
                    className="rounded-none border-0"
                    onRowActivate={(row) => {
                      setSelectedRow(row);
                      setDetailOpen(true);
                    }}
                    getRowLabel={(row) =>
                      `Open session: ${row.scholar_name} with ${row.tutor_name}, ${row.day_of_week}`
                    }
                  />
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {selectedRow && (
        <TutoringSessionDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          row={selectedRow}
          onDelete={async () => {
            const result = await deleteTutorReportAction(selectedRow.id);
            if ("error" in result && result.error) {
              throw new Error(result.error);
            }
            setRemovedIds((prev) => new Set(prev).add(selectedRow.id));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
