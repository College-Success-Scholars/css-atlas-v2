"use client";

import { useEffect, useState, useMemo } from "react";
import type { ScholarWithCompletedSession } from "@css-atlas/shared/contracts/session-logs";
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
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8–19

type ViewMode = "front-desk" | "study-session" | "both";

interface SessionHeatMapProps {
  completedStudy: readonly ScholarWithCompletedSession[];
  completedFd: readonly ScholarWithCompletedSession[];
}

function parseET(iso: string): { dayOfWeek: number; hour: number } {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10
  );
  const dayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
  };
  return { dayOfWeek: dayMap[weekday] ?? -1, hour };
}

const HOUR_MS = 60 * 60 * 1000;

function addSessionToGrid(
  session: ScholarWithCompletedSession,
  grid: number[][]
) {
  const entryMs = new Date(session.entryAt).getTime();
  const exitMs = new Date(session.exitAt).getTime();
  const entryHourStart = Math.floor(entryMs / HOUR_MS) * HOUR_MS;

  for (let t = entryHourStart; t < exitMs; t += HOUR_MS) {
    const hourEnd = t + HOUR_MS;
    if (entryMs < hourEnd && exitMs > t) {
      const { dayOfWeek, hour } = parseET(new Date(t).toISOString());
      if (dayOfWeek >= 0 && hour >= 8 && hour <= 19) {
        grid[dayOfWeek][hour - 8]++;
      }
    }
  }
}

function aggregate(
  completedStudy: readonly ScholarWithCompletedSession[],
  completedFd: readonly ScholarWithCompletedSession[]
) {
  const study: number[][] = Array.from({ length: 5 }, () =>
    Array(12).fill(0)
  );
  const fd: number[][] = Array.from({ length: 5 }, () => Array(12).fill(0));

  for (const s of completedStudy) {
    addSessionToGrid(s, study);
  }
  for (const s of completedFd) {
    addSessionToGrid(s, fd);
  }

  return { study, fd };
}

const FRONT_DESK_COLOR = cssColor.frontDesk;
const STUDY_COLOR = cssColor.study;
const BOTH_COLOR = cssColor.formWahf;

export function SessionHeatMap({
  completedStudy,
  completedFd,
}: SessionHeatMapProps) {
  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("front-desk");

  const { study, fd } = useMemo(
    () => aggregate(completedStudy, completedFd),
    [completedStudy, completedFd]
  );

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 600);
    return () => clearTimeout(t);
  }, []);

  const { grid, maxVal, mode } = useMemo(() => {
    const g: { count: number; isBoth: boolean }[][] = Array.from(
      { length: 5 },
      () => Array(12).fill(null).map(() => ({ count: 0, isBoth: false }))
    );
    let max = 0;
    for (let d = 0; d < 5; d++) {
      for (let h = 0; h < 12; h++) {
        const sCount = study[d][h];
        const fCount = fd[d][h];
        if (viewMode === "front-desk") {
          g[d][h] = { count: fCount, isBoth: false };
        } else if (viewMode === "study-session") {
          g[d][h] = { count: sCount, isBoth: false };
        } else {
          g[d][h] = {
            count: sCount + fCount,
            isBoth: sCount > 0 && fCount > 0,
          };
        }
        if (g[d][h].count > max) max = g[d][h].count;
      }
    }
    return {
      grid: g,
      maxVal: max,
      mode: viewMode,
    };
  }, [study, fd, viewMode]);

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Session Heat Map</CardTitle>
              <CardDescription>
                Activity by day and time (Mon–Fri, 8am–8pm)
              </CardDescription>
            </div>
            <div className="inline-flex h-9 w-64 rounded-lg border bg-muted/50 p-0.5">
              <Skeleton className="m-1 h-7 flex-1 rounded-md animate-pulse" />
              <Skeleton className="m-1 h-7 flex-1 rounded-md animate-pulse" />
              <Skeleton className="m-1 h-7 flex-1 rounded-md animate-pulse" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[min(400px,50vh)] w-full">
            <div className="grid h-full w-full grid-cols-[auto_repeat(5,1fr)] grid-rows-[auto_repeat(12,minmax(0,1fr))] gap-1">
              <div className="col-start-1 row-start-1" aria-hidden />
              {DAYS.map((day) => (
                <Skeleton
                  key={day}
                  className="min-h-0 min-w-0 animate-pulse rounded"
                />
              ))}
              {Array.from({ length: 12 }, (_, h) => (
                <div key={h} className="contents">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Session Heat Map</CardTitle>
            <CardDescription>
              Activity by day and time (Mon–Fri, 8am–8pm)
            </CardDescription>
          </div>
          <div
            className="inline-flex h-9 rounded-lg border bg-muted/50 p-0.5"
            role="group"
            aria-label="View mode"
          >
            {(
              [
                ["front-desk", "Front Desk"],
                ["study-session", "Study Session"],
                ["both", "Both"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setViewMode(value)}
                className={`rounded-md px-3 text-sm font-medium transition-colors ${
                  viewMode === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[min(400px,50vh)] w-full">
          <div className="grid h-full w-full grid-cols-[auto_repeat(5,1fr)] grid-rows-[auto_repeat(12,minmax(0,1fr))] gap-1">
            <div className="col-start-1 row-start-1" aria-hidden />
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {HOURS.map((hour, h) => (
              <div key={hour} className="contents">
                <div
                  className="flex items-center justify-end pr-2 text-xs text-muted-foreground"
                >
                  {hour === 12
                    ? "12pm"
                    : hour < 12
                      ? `${hour}am`
                      : `${hour - 12}pm`}
                </div>
                {DAYS.map((_, d) => {
                  const cell = grid[d][h];
                  const isEmpty = cell.count === 0;
                  const isBoth = mode === "both" && cell.isBoth;
                  const color =
                    mode === "front-desk"
                      ? FRONT_DESK_COLOR
                      : mode === "study-session"
                        ? STUDY_COLOR
                        : isBoth
                          ? BOTH_COLOR
                          : fd[d][h] > 0
                            ? FRONT_DESK_COLOR
                            : STUDY_COLOR;
                  return (
                    <div
                      key={`${d}-${h}`}
                      className={`flex min-h-0 min-w-0 items-center justify-center rounded border border-border/50 text-[10px] font-medium transition-colors ${
                        isEmpty ? "bg-card" : ""
                      }`}
                      style={
                        !isEmpty
                          ? {
                              backgroundColor: themeIntensity(
                                color,
                                maxVal > 0 ? cell.count / maxVal : 0
                              ),
                              color:
                                cell.count > 0 &&
                                (cell.count / (maxVal || 1)) > 0.5
                                  ? "var(--success-foreground)"
                                  : "inherit",
                            }
                          : undefined
                      }
                      title={`${DAYS[d]} ${hour}:00 - ${cell.count} session(s)${isBoth ? " (both types)" : ""}`}
                    >
                      {cell.count > 0 ? cell.count : ""}
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
              className="inline-block h-3 w-3 rounded"
              style={{
                backgroundColor:
                  mode === "front-desk"
                    ? FRONT_DESK_COLOR
                    : mode === "study-session"
                      ? STUDY_COLOR
                      : BOTH_COLOR,
              }}
              aria-hidden
            />{" "}
            {mode === "front-desk"
              ? "Front Desk"
              : mode === "study-session"
                ? "Study Session"
                : "Both overlap"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
