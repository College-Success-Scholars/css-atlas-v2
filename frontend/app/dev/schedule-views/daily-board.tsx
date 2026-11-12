"use client";

import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatDurationLabel,
  parseHhMm,
  sessionKindSurfaceClass,
  sortScholarsByEarliestShift,
} from "./schedule-helpers";
import { ScholarRowMenu } from "./scholar-row-menu";
import type {
  BoardScholar,
  DayShiftBlock,
  ScheduleBoardActions,
  SessionKind,
} from "./types";
import { WeekDayBar } from "./week-day-bar";

const AXIS_START_MIN = 8 * 60; // 8:00
const AXIS_END_MIN = 20 * 60; // 20:00
const AXIS_SPAN = AXIS_END_MIN - AXIS_START_MIN;
const HOUR_TICKS = Array.from(
  { length: (AXIS_END_MIN - AXIS_START_MIN) / 60 + 1 },
  (_, i) => AXIS_START_MIN / 60 + i,
);

type DailyBoardProps = {
  scholars: BoardScholar[];
  blocks: DayShiftBlock[];
  kind: SessionKind;
  loading: boolean;
  dateLabel: string;
  weekDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onViewHistory?: (scholar: BoardScholar) => void;
  onManageShifts?: (scholar: BoardScholar) => void;
  actions?: ScheduleBoardActions;
};

function hourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

function barStyle(startTime: string, endTime: string): CSSProperties {
  const start = Math.max(AXIS_START_MIN, parseHhMm(startTime));
  const end = Math.min(AXIS_END_MIN, parseHhMm(endTime));
  const left = ((start - AXIS_START_MIN) / AXIS_SPAN) * 100;
  const width = Math.max(2, ((end - start) / AXIS_SPAN) * 100);
  return { left: `${left}%`, width: `${width}%` };
}

function blocksByScholar(blocks: DayShiftBlock[]): Map<string, DayShiftBlock[]> {
  const map = new Map<string, DayShiftBlock[]>();
  for (const block of blocks) {
    const list = map.get(block.scholarUid) ?? [];
    list.push(block);
    map.set(block.scholarUid, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => parseHhMm(a.startTime) - parseHhMm(b.startTime));
  }
  return map;
}

export function DailyBoard({
  scholars,
  blocks,
  kind,
  loading,
  dateLabel,
  weekDates,
  selectedDate,
  onSelectDate,
  onViewHistory,
  onManageShifts,
  actions,
}: DailyBoardProps) {
  const byUid = blocksByScholar(blocks);
  const orderedScholars = sortScholarsByEarliestShift(scholars, blocks);
  const canEdit = Boolean(actions?.onEditShift);
  const canAdd = Boolean(actions?.onAddShift);
  const showTools = Boolean(onViewHistory || onManageShifts);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{dateLabel}</span>
          <span className="text-muted-foreground">Timeline</span>
        </div>
        {weekDates.length > 0 ? (
          <WeekDayBar
            weekDates={weekDates}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[12rem_1fr] border-b bg-muted/40">
            <div className="px-3 py-2 text-sm font-medium">Scholar</div>
            <div className="relative px-2 py-2">
              <div className="relative flex justify-between text-[11px] text-muted-foreground">
                {HOUR_TICKS.map((hour) => (
                  <span key={hour} className="tabular-nums">
                    {hourLabel(hour)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[12rem_1fr] items-center gap-2">
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : orderedScholars.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No eligible scholars for this kind.
            </div>
          ) : (
            orderedScholars.map((scholar) => {
              const rowBlocks = byUid.get(scholar.uid) ?? [];
              return (
                <div
                  key={scholar.uid}
                  className="grid grid-cols-[12rem_1fr] items-stretch border-b last:border-b-0"
                >
                  <div className="px-3 py-3">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">
                          {scholar.name}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {scholar.classYearLabel ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {scholar.classYearLabel}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {showTools ? (
                        <ScholarRowMenu
                          onViewHistory={() => onViewHistory?.(scholar)}
                          onManageShifts={() => onManageShifts?.(scholar)}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="group/row relative min-h-14 border-l px-2 py-2">
                    {rowBlocks.map((block) => {
                      const chip = (
                        <span className="truncate tabular-nums">
                          {block.startTime}–{block.endTime}
                          <span className="ml-1 opacity-70">
                            {formatDurationLabel(block.durationHours)}
                          </span>
                        </span>
                      );
                      const className = cn(
                        "absolute top-1/2 z-10 flex h-8 -translate-y-1/2 items-center overflow-hidden rounded-md border px-2 text-[11px] font-medium shadow-xs",
                        sessionKindSurfaceClass(kind, block.durationHours),
                        canEdit && "cursor-pointer hover:ring-2 hover:ring-primary/40",
                      );
                      const style = barStyle(block.startTime, block.endTime);
                      const title = `${block.startTime}–${block.endTime} (${formatDurationLabel(block.durationHours)})`;
                      return canEdit ? (
                        <button
                          key={`${block.id}:${block.date}`}
                          type="button"
                          className={className}
                          style={style}
                          title={`${title} · Edit`}
                          onClick={() => actions?.onEditShift?.(block)}
                        >
                          {chip}
                        </button>
                      ) : (
                        <div
                          key={`${block.id}:${block.date}`}
                          className={className}
                          style={style}
                          title={title}
                        >
                          {chip}
                        </div>
                      );
                    })}
                    {canAdd && rowBlocks.length === 0 ? (
                      <button
                        type="button"
                        title="Add shift"
                        onClick={() =>
                          actions?.onAddShift?.({
                            scholarUid: scholar.uid,
                            date: selectedDate,
                            kind,
                          })
                        }
                        className="absolute inset-y-2 left-2 right-2 z-0 flex items-center justify-center rounded-md opacity-0 transition-opacity group-hover/row:opacity-100"
                      >
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Plus className="size-4" />
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
