"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDurationLabel,
  formatWeekdayColumn,
  requiredMinutesForKind,
  sessionKindSurfaceClass,
  shiftsForScholarOnDate,
  weeklyScheduledHours,
} from "./schedule-helpers";
import { ScholarRowMenu } from "./scholar-row-menu";
import type {
  BoardScholar,
  DayShiftBlock,
  ScheduleBoardActions,
  SessionKind,
} from "./types";

type WeeklyBoardProps = {
  scholars: BoardScholar[];
  weekDates: string[];
  kind: SessionKind;
  onViewHistory?: (scholar: BoardScholar) => void;
  onManageShifts?: (scholar: BoardScholar) => void;
  actions?: ScheduleBoardActions;
};

function ShiftCard({ block }: { block: DayShiftBlock }) {
  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5 text-left text-xs shadow-xs",
        sessionKindSurfaceClass(block.kind, block.durationHours),
      )}
      title={`${block.startTime}–${block.endTime} · ${formatDurationLabel(block.durationHours)}`}
    >
      <div className="font-medium tabular-nums">
        {block.startTime} – {block.endTime}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-1 opacity-80">
        <span>{formatDurationLabel(block.durationHours)}</span>
        <span className="truncate">{block.kind === "front_desk" ? "FD" : "SS"}</span>
      </div>
    </div>
  );
}

export function WeeklyBoard({
  scholars,
  weekDates,
  kind,
  onViewHistory,
  onManageShifts,
  actions,
}: WeeklyBoardProps) {
  const canAdd = Boolean(actions?.onAddShift);
  const showTools = Boolean(onViewHistory || onManageShifts);

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="sticky left-0 z-10 w-48 bg-muted/40 px-3 py-2 text-left font-medium">
              Scholar
            </th>
            {weekDates.map((dateKey) => {
              const { weekday, dayNum } = formatWeekdayColumn(dateKey);
              return (
                <th
                  key={dateKey}
                  className="min-w-[120px] px-2 py-2 text-center font-medium"
                >
                  <div className="flex flex-col items-center px-1 py-1">
                    <span>{weekday}</span>
                    <span className="tabular-nums text-muted-foreground">{dayNum}</span>
                  </div>
                </th>
              );
            })}
            <th className="w-16 px-2 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {scholars.length === 0 ? (
            <tr>
              <td
                colSpan={weekDates.length + 2}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                No eligible scholars for this kind (cohort + required minutes &gt; 0).
              </td>
            </tr>
          ) : (
            scholars.map((scholar) => {
              const total = weeklyScheduledHours(scholar, weekDates, kind);
              return (
                <tr key={scholar.uid} className="border-b last:border-b-0 align-top">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="font-medium leading-tight">{scholar.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {scholar.classYearLabel ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {scholar.classYearLabel}
                            </Badge>
                          ) : null}
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            req{" "}
                            {formatDurationLabel(
                              requiredMinutesForKind(scholar, kind) / 60,
                            )}
                          </span>
                        </div>
                      </div>
                      {showTools ? (
                        <ScholarRowMenu
                          onViewHistory={() => onViewHistory?.(scholar)}
                          onManageShifts={() => onManageShifts?.(scholar)}
                        />
                      ) : null}
                    </div>
                  </td>
                  {weekDates.map((dateKey) => {
                    const blocks = shiftsForScholarOnDate(scholar, dateKey, kind);
                    return (
                      <td key={dateKey} className="relative px-1.5 py-1.5">
                        <div className="group/cell relative min-h-16 space-y-1">
                          {blocks.map((block) => (
                            <ShiftCard key={`${block.id}:${block.date}`} block={block} />
                          ))}
                          {blocks.length === 0 && canAdd ? (
                            <button
                              type="button"
                              title="Add shift"
                              onClick={() =>
                                actions?.onAddShift?.({
                                  scholarUid: scholar.uid,
                                  date: dateKey,
                                  kind,
                                })
                              }
                              className="flex h-16 w-full items-center justify-center rounded-md opacity-0 transition-opacity group-hover/cell:opacity-100"
                            >
                              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                                <Plus className="size-4" />
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    {formatDurationLabel(total)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
