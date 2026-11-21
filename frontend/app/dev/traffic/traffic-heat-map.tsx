"use client";

import { useEffect, useState, useMemo } from "react";
import type { TrafficSession } from "@css-atlas/shared/contracts/traffic";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cssColor, themeIntensity } from "@/lib/theme/css-color";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
/** Minutes from 8am to 10pm ET (14 hours) */
const MINUTES_8_TO_22 = 14 * 60; // 840

/** Slots per day for 8am–10pm ET when each slot is slotMinutes long */
function slotsPerDay(slotMinutes: number): number {
  return Math.floor(MINUTES_8_TO_22 / slotMinutes);
}

function parseET(
  iso: string,
  slotMinutes: number
): { dayOfWeek: number; slotIndex: number } {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10
  );
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10
  );
  const dayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
  };
  const dayOfWeek = dayMap[weekday] ?? -1;
  const totalMinutesFrom8 = (hour - 8) * 60 + minute;
  const slotIndex =
    hour >= 8 && hour < 22 && totalMinutesFrom8 < MINUTES_8_TO_22
      ? Math.min(
          Math.floor(totalMinutesFrom8 / slotMinutes),
          slotsPerDay(slotMinutes) - 1
        )
      : -1;
  return { dayOfWeek, slotIndex };
}

function addSessionToGrid(
  session: { entryAt: string; exitAt: string },
  grid: number[][],
  slotMinutes: number
) {
  const slotMs = slotMinutes * 60 * 1000;
  const entryMs = new Date(session.entryAt).getTime();
  const exitMs = new Date(session.exitAt).getTime();
  const t0 = Math.floor(entryMs / slotMs) * slotMs;
  const numSlots = grid[0].length;

  for (let t = t0; t < exitMs; t += slotMs) {
    const slotEnd = t + slotMs;
    if (entryMs < slotEnd && exitMs > t) {
      const { dayOfWeek, slotIndex } = parseET(
        new Date(t).toISOString(),
        slotMinutes
      );
      if (dayOfWeek >= 0 && slotIndex >= 0 && slotIndex < numSlots) {
        grid[dayOfWeek][slotIndex]++;
      }
    }
  }
}

function aggregate(
  sessions: readonly TrafficSession[],
  slotMinutes: number
): number[][] {
  const numSlots = slotsPerDay(slotMinutes);
  const grid = Array.from({ length: 5 }, () => Array(numSlots).fill(0));
  for (const s of sessions) {
    addSessionToGrid(s, grid, slotMinutes);
  }
  return grid;
}

/** Slot index -> label for row; show label every (60/slotMinutes) slots for hour marks */
function slotLabel(slotIndex: number, slotMinutes: number): string {
  const totalMinutes = slotIndex * slotMinutes;
  const hour = 8 + Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  if (minute === 0) {
    return hour === 12 ? "12pm" : hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  }
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

/** How many slots per hour (for showing row labels on hour boundaries) */
function slotsPerHour(slotMinutes: number): number {
  return Math.max(1, Math.floor(60 / slotMinutes));
}

const TRAFFIC_COLOR = cssColor.traffic;
const HEADER_ROW_HEIGHT_PX = 20;
/** Base cell height at 15-min slots; scales up when slot size is larger (30 → 2×, 60 → 4×). */
const BASE_CELL_ROW_HEIGHT_PX = 12;
const REF_SLOT_MINUTES = 15;

/** Valid slot sizes (minutes) for the heat map time axis */
export const SLOT_MINUTES_OPTIONS = [15, 30, 60] as const;

export type SlotMinutesOption = (typeof SLOT_MINUTES_OPTIONS)[number];

interface TrafficHeatMapProps {
  sessions: readonly TrafficSession[];
  /** Time slot size in minutes (default 15). Use 15, 30, or 60. */
  slotMinutes?: number;
}

export function TrafficHeatMap({
  sessions,
  slotMinutes: slotMinutesProp = 15,
}: TrafficHeatMapProps) {
  const slotMinutes = Math.min(
    60,
    Math.max(5, [15, 30, 60].includes(slotMinutesProp) ? slotMinutesProp : 15)
  );
  const numSlots = slotsPerDay(slotMinutes);
  const labelEvery = slotsPerHour(slotMinutes);
  /** Cell height scales with slot size so 30-min and 60-min views have larger cells. */
  const cellRowHeightPx =
    BASE_CELL_ROW_HEIGHT_PX * (slotMinutes / REF_SLOT_MINUTES);

  const [loaded, setLoaded] = useState(false);
  const grid = useMemo(
    () => aggregate(sessions, slotMinutes),
    [sessions, slotMinutes]
  );
  const maxVal = useMemo(
    () => Math.max(0, ...grid.flat()),
    [grid]
  );

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Traffic Heat Map</CardTitle>
        <CardDescription>
          Room activity by day and time in {slotMinutes}-min increments (Mon–Fri,
          8am–10pm ET). Unpaired entries (no exit record) are assumed to stay
          1 hour unless a later exit is recorded.
        </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-auto">
            <div
              className="grid w-full grid-cols-[auto_repeat(5,1fr)] gap-0.5"
              style={{
                gridTemplateRows: `${HEADER_ROW_HEIGHT_PX}px repeat(${numSlots}, ${cellRowHeightPx}px)`,
              }}
            >
              <div className="col-start-1 row-start-1" aria-hidden />
              {DAYS.map((day) => (
                <Skeleton
                  key={day}
                  className="min-h-0 min-w-0 animate-pulse rounded"
                />
              ))}
              {Array.from({ length: numSlots }, (_, slot) => (
                <div key={slot} className="contents">
                  <Skeleton className="min-h-0 min-w-0 animate-pulse rounded" />
                  {Array.from({ length: 5 }, (_, d) => (
                    <Skeleton
                      key={d}
                      className="min-h-0 min-w-0 animate-pulse rounded"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Skeleton className="h-4 w-48 animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Heat Map</CardTitle>
        <CardDescription>
          Room activity by day and time in {slotMinutes}-minute increments (Mon–Fri,
          8am–10pm ET). Unpaired entries (no exit record) are assumed to stay
          1 hour unless a later exit is recorded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto">
          <div
            className="grid w-full grid-cols-[auto_repeat(5,1fr)] gap-0.5"
            style={{
              gridTemplateRows: `${HEADER_ROW_HEIGHT_PX}px repeat(${numSlots}, ${cellRowHeightPx}px)`,
            }}
          >
            <div className="col-start-1 row-start-1" aria-hidden />
            {DAYS.map((day) => (
              <div
                key={day}
                className="flex items-center justify-center text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: numSlots }, (_, slot) => (
              <div key={slot} className="contents">
                <div className="flex items-center justify-end pr-1.5 text-[10px] text-muted-foreground">
                  {slot % labelEvery === 0 ? slotLabel(slot, slotMinutes) : ""}
                </div>
                {DAYS.map((_, d) => {
                  const count = grid[d][slot];
                  const isEmpty = count === 0;
                  return (
                    <div
                      key={`${d}-${slot}`}
                      className={`flex min-h-0 min-w-0 items-center justify-center rounded-sm border border-border/50 text-[9px] font-medium transition-colors ${
                        isEmpty ? "bg-card" : ""
                      }`}
                      style={
                        !isEmpty
                          ? {
                              backgroundColor: themeIntensity(
                                TRAFFIC_COLOR,
                                maxVal > 0 ? count / maxVal : 0
                              ),
                              color:
                                count > 0 && count / (maxVal || 1) > 0.5
                                  ? "var(--success-foreground)"
                                  : "inherit",
                            }
                          : undefined
                      }
                      title={`${DAYS[d]} ${slotLabel(slot, slotMinutes)} – ${count} session(s)`}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            Scale: background (0) →{" "}
            <span
              className="inline-block h-3 w-3 rounded bg-traffic"
              aria-hidden
            />{" "}
            traffic. {slotMinutes}-min slots.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
