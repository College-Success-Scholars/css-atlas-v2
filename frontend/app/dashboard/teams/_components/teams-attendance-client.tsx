/**
 * @file teams-attendance-client.tsx
 * @module frontend/app/dashboard/teams
 *
 * Shared FD / SS temporary teams board: campus-week completion + excuse edit.
 * Layout follows Weekly Memo / Mentee monitoring (header + week nav + section card).
 * Board data is loaded on the server; this client owns week nav, tabs, and excuse UI.
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMinutesToHoursAndMinutes } from "@/lib/format/time";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/data-display/data-table";
import { ProgressCell } from "@/components/data-display/progress-cell";
import { ExcuseDialog } from "@/components/attendance/excuse-dialog";
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state";
import { WeeklyMemoWeekNav } from "@/app/dashboard/memo/_components/weekly-memo-week-nav";
import { formatCampusWeekRangeWithYear } from "@/components/personal/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { upsertAttendanceExcuseAction } from "@/lib/server/actions";
import type {
  AttendanceKind,
  AttendanceWeekBoard,
  AttendanceWeekBoardRow,
} from "@/lib/types/attendance-week";

export type TeamsAttendanceClientProps = {
  kind: AttendanceKind;
  title: string;
  basePath: string;
  weekNum: number;
  currentCampusWeek: number | null;
  board: AttendanceWeekBoard | null;
  error: string | null;
};

const KIND_TABS: { kind: AttendanceKind; label: string; href: string }[] = [
  {
    kind: "front_desk",
    label: "Front desk",
    href: "/dashboard/teams/front-desk",
  },
  {
    kind: "study_session",
    label: "Study sessions",
    href: "/dashboard/teams/study",
  },
];

function dayCell(mins: number) {
  return (
    <span className="whitespace-pre-line text-xs tabular-nums">
      {formatMinutesToHoursAndMinutes(mins)}
    </span>
  );
}

export function TeamsPageFallback() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-[calc(5rem+190px)]" />
      </div>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function TeamsAttendanceClient({
  kind,
  title,
  basePath,
  weekNum,
  currentCampusWeek,
  board,
  error,
}: TeamsAttendanceClientProps) {
  const router = useRouter();
  const yearStarted = currentCampusWeek != null;

  const availableWeeks = useMemo(() => {
    if (currentCampusWeek == null || currentCampusWeek < 1) return [];
    return Array.from({ length: currentCampusWeek }, (_, i) => i + 1);
  }, [currentCampusWeek]);

  const weekIndex = availableWeeks.indexOf(weekNum);
  const prevWeek = weekIndex > 0 ? availableWeeks[weekIndex - 1] : null;
  const nextWeek =
    weekIndex >= 0 && weekIndex < availableWeeks.length - 1
      ? availableWeeks[weekIndex + 1]
      : null;

  const weekRangeLabel = yearStarted
    ? formatCampusWeekRangeWithYear(weekNum)
    : null;

  const [excuseRow, setExcuseRow] = useState<AttendanceWeekBoardRow | null>(
    null
  );
  const [excuseOpen, setExcuseOpen] = useState(false);

  const columns: DataTableColumn<AttendanceWeekBoardRow>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Scholar",
        field: "scholar_name",
        sortable: true,
        renderCell: (row) => (
          <div>
            <div className="font-medium">
              {row.scholar_name ?? row.scholar_uid}
            </div>
            {row.completion_pct != null && row.completion_pct < 75 ? (
              <Badge variant="warning" className="mt-1">
                Needs follow-up
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "mon",
        header: "Mon",
        field: "mon_min",
        sortable: true,
        renderCell: (row) => dayCell(row.mon_min),
      },
      {
        id: "tue",
        header: "Tue",
        field: "tues_min",
        sortable: true,
        renderCell: (row) => dayCell(row.tues_min),
      },
      {
        id: "wed",
        header: "Wed",
        field: "wed_min",
        sortable: true,
        renderCell: (row) => dayCell(row.wed_min),
      },
      {
        id: "thu",
        header: "Thu",
        field: "thurs_min",
        sortable: true,
        renderCell: (row) => dayCell(row.thurs_min),
      },
      {
        id: "fri",
        header: "Fri",
        field: "fri_min",
        sortable: true,
        renderCell: (row) => dayCell(row.fri_min),
      },
      {
        id: "logged",
        header: "Logged",
        field: "logged_min",
        sortable: true,
        renderCell: (row) => dayCell(row.logged_min),
      },
      {
        id: "excuse",
        header: "Excuse",
        field: "description",
        sortable: true,
        renderCell: (row) => {
          const hasExcuse = Boolean(row.description) || row.excuse_min > 0;
          return (
            <div className="flex max-w-56 flex-col items-start gap-2">
              <span
                className="text-muted-foreground line-clamp-2 text-xs"
                title={row.description ?? undefined}
              >
                {row.description ?? "—"}
                {row.excuse_min > 0 ? ` · ${row.excuse_min} min` : ""}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setExcuseRow(row);
                  setExcuseOpen(true);
                }}
              >
                {hasExcuse ? "Edit" : "Add excuse"}
              </Button>
            </div>
          );
        },
      },
      {
        id: "progress",
        header: "Progress",
        field: "completion_pct",
        sortable: true,
        renderCell: (row) => (
          <ProgressCell
            mode="time"
            total={row.logged_min}
            required={row.required_min}
            excuseMin={row.excuse_min}
            label={title}
          />
        ),
      },
    ],
    [title]
  );

  const summary = board?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {yearStarted && weekRangeLabel ? (
            <p className="text-muted-foreground text-sm">
              Week {weekNum} · {weekRangeLabel}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Scholar completion and excuses for this duty week
            </p>
          )}
        </div>
        {yearStarted ? (
          <WeeklyMemoWeekNav
            selectedWeek={weekNum}
            availableWeeks={availableWeeks}
            prevWeek={prevWeek}
            nextWeek={nextWeek}
            currentCampusWeek={currentCampusWeek}
            basePath={basePath}
          />
        ) : null}
      </div>

      {!yearStarted ? (
        <YearNotStartedState />
      ) : (
        <>
          <div className="flex items-center gap-1.5 rounded-md bg-muted/40 p-1 w-fit">
            {KIND_TABS.map((tab) => (
              <Link
                key={tab.kind}
                href={`${tab.href}?week=${weekNum}`}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm transition-colors",
                  tab.kind === kind
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {summary ? (
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span>{summary.scholar_count} scholars</span>
              <span aria-hidden>·</span>
              <Badge variant="success">{summary.at_or_above_90} at ≥90%</Badge>
              <Badge variant="warning">{summary.below_75} below 75%</Badge>
            </div>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {board ? (
            <Card className="gap-0 py-0 overflow-hidden">
              <CardHeader className="border-b px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    Weekly attendance
                  </CardTitle>
                  <span className="text-muted-foreground text-xs">
                    Sorted by scholar name
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {board.rows.length === 0 ? (
                  <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                    No scholars with {title.toLowerCase()} requirements this
                    week.
                  </p>
                ) : (
                  <DataTable
                    data={board.rows}
                    columns={columns}
                    rowKeyField="scholar_uid"
                    className="rounded-none border-0"
                  />
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {excuseRow && (
        <ExcuseDialog
          open={excuseOpen}
          onOpenChange={setExcuseOpen}
          kindLabel={title}
          scholarLabel={excuseRow.scholar_name ?? excuseRow.scholar_uid}
          weekNum={excuseRow.week_num}
          initialDescription={excuseRow.description}
          initialExcuseMin={excuseRow.excuse_min}
          onSubmit={async (values) => {
            const result = await upsertAttendanceExcuseAction({
              uid: excuseRow.scholar_uid,
              weekNum: excuseRow.week_num,
              kind: excuseRow.kind,
              excuse_min: values.excuse_min,
              description: values.description,
            });
            if ("error" in result && result.error) {
              throw new Error(result.error);
            }
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
