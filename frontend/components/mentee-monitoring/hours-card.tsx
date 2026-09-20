"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"
import type { DailyHoursEntry } from "./utils"

const COLOR_CONFIG = {
  emerald: {
    progressIndicator: "[&_[data-slot=progress-indicator]]:bg-success",
    bar: "bg-success",
    statusDot: "text-success",
  },
  sky: {
    progressIndicator: "[&_[data-slot=progress-indicator]]:bg-info",
    bar: "bg-info",
    statusDot: "text-info",
  },
} as const

interface HoursCardProps {
  title: string
  completed: number
  total: number
  color: keyof typeof COLOR_CONFIG
  dailyHours: DailyHoursEntry[]
  todayLabel: string
}

export function HoursCard({
  title,
  completed,
  total,
  color,
  dailyHours,
  todayLabel,
}: HoursCardProps) {
  const remaining = Math.max(0, total - completed)
  const percentage =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  const onTrack = percentage >= 75
  const cfg = COLOR_CONFIG[color]
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

  const maxHours = Math.max(
    ...dailyHours.flatMap((day) => [day.hours, day.scheduledHours]),
    0.1,
  )
  const BAR_MAX_HEIGHT = 64 // px

  const formatScheduledInterval = (start: string | null, end: string | null) => {
    if (!start || !end) return null
    return `${format(parseISO(start), "h:mm a")} to ${format(parseISO(end), "h:mm a")}`
  }

  return (
    <Card className="h-full min-h-0 flex-col justify-start py-0">
      <CardContent className="flex flex-1 flex-col justify-start space-y-4 pt-4 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-2xl font-semibold tracking-tight">
            {fmt(completed)}&thinsp;/&thinsp;{fmt(total)} hrs
          </p>
          <Badge variant="warning" className="shrink-0">
            {fmt(remaining)} hrs left
          </Badge>
        </div>

        <Progress
          value={percentage}
          className={cn("h-2.5 bg-muted", cfg.progressIndicator)}
        />

        <p className="text-sm text-muted-foreground">
          <span className={cn("mr-1 inline-block size-2 rounded-full", onTrack ? "bg-success" : "bg-warning")} />
          {onTrack ? "On track this week" : "Behind target this week"}
        </p>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            This week (UTC)
          </p>
          <div
            className="grid grid-cols-7 gap-1.5 sm:gap-2"
            role="group"
            aria-label={`${title}: actual logged hours and scheduled shift hours by day`}
          >
            {dailyHours.map((day) => {
              const actualBarHeight =
                day.hours > 0
                  ? Math.max(4, Math.round((day.hours / maxHours) * BAR_MAX_HEIGHT))
                  : 2
              const scheduledBarHeight =
                day.scheduledHours > 0
                  ? Math.max(4, Math.round((day.scheduledHours / maxHours) * BAR_MAX_HEIGHT))
                  : 0
              const isToday = day.dayLabel === todayLabel
              const scheduledInterval = formatScheduledInterval(
                day.scheduledStart,
                day.scheduledEnd,
              )
              const status = day.noShow
                ? "Scheduled shift not attended"
                : day.unscheduled
                  ? "Unscheduled activity"
                  : null
              const chartLabel = [
                day.dayLabel,
                `${fmt(day.hours)} actual logged hours`,
                scheduledInterval
                  ? `${fmt(day.scheduledHours)} scheduled hours, ${scheduledInterval}`
                  : "No scheduled shift",
                status,
              ]
                .filter(Boolean)
                .join(". ")

              return (
                <div
                  key={day.dayLabel}
                  className="flex min-w-0 flex-col items-center gap-1"
                  role="group"
                  aria-label={chartLabel}
                >
                  <div
                    className="relative flex w-full items-end justify-center"
                    style={{ height: BAR_MAX_HEIGHT }}
                    aria-hidden="true"
                  >
                    {scheduledBarHeight > 0 && (
                      <div
                        className={cn(
                          "absolute bottom-0 w-full max-w-8 rounded-sm border-2",
                          day.noShow
                            ? "border-warning border-dashed"
                            : "border-foreground/70",
                        )}
                        style={{ height: scheduledBarHeight }}
                      />
                    )}
                    <div
                      className={cn(
                        "relative w-full max-w-8 rounded-sm transition-[height]",
                        day.hours > 0 ? cfg.bar : "bg-muted",
                        day.unscheduled && "ring-1 ring-warning",
                      )}
                      style={{ height: actualBarHeight }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wide sm:text-xs",
                      isToday
                        ? "font-bold text-foreground"
                        : "font-medium text-muted-foreground",
                    )}
                  >
                    {day.dayLabel}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {day.hours > 0 ? `${fmt(day.hours)}h` : "-"}
                  </span>
                  {status && (
                    <span className="text-center text-[10px] font-medium leading-none text-muted-foreground">
                      {day.noShow ? "No show" : "Unscheduled"}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-sm", cfg.bar)} aria-hidden="true" />
              Actual logged hours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm border border-foreground/70" aria-hidden="true" />
              Scheduled shift
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
