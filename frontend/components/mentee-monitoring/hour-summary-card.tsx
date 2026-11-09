"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { HourWeekSummary, ShiftEvidence, WeekTier } from "@/lib/types/mentee-review"

import { TIER_UI, TierBadge } from "./tier-badge"
import tierStyles from "./tier-styles.module.css"
import {
  HOUR_BAND_STYLES,
  PENDING_STYLES,
  formatClockRange,
  formatCompactHours,
  formatHours,
  formatPercent,
  formatShiftDay,
  hourCardTitle,
  shiftStatusLabel,
} from "./utils"

interface HourSummaryCardProps {
  summary: HourWeekSummary
  /** Tier earned independently by this hourly requirement. */
  tier?: WeekTier | null
}

function shiftTrailing(shift: ShiftEvidence): string {
  if (
    (shift.status === "attended" || shift.status === "short" || shift.status === "active") &&
    shift.overlapMinutes > 0
  ) {
    const hours = formatCompactHours(shift.overlapMinutes)
    return shift.status === "short" ? `${hours} · Short` : hours
  }
  return shiftStatusLabel(shift.status)
}

function shiftTone(shift: ShiftEvidence): string {
  switch (shift.status) {
    case "attended":
      return "text-foreground"
    case "short":
      return "text-warning-muted-foreground"
    case "no_show":
      return "text-destructive"
    case "active":
      return PENDING_STYLES.text
    case "upcoming":
    case "unconfirmed":
      return "text-muted-foreground"
  }
}

/** One requirement card: percent, hours vs target, notched bar, shift + off-shift rows. */
export function HourSummaryCard({ summary, tier = null }: HourSummaryCardProps) {
  const title = hourCardTitle(summary.kind)
  const hasTarget = summary.targetMinutes != null && summary.targetMinutes > 0
  const styles = summary.band ? HOUR_BAND_STYLES[summary.band] : null
  const tierUi = tier ? TIER_UI[tier] : null
  const completionPercent = hasTarget
    ? summary.percent ?? (summary.loggedMinutes / (summary.targetMinutes ?? 1)) * 100
    : null
  const barPercent = Math.min(100, Math.max(0, completionPercent ?? 0))

  const percentEl =
    completionPercent != null ? (
      <span className={cn("text-sm font-semibold tabular-nums @max-[340px]:text-xs", tierUi?.text ?? styles?.text)}>
        {formatPercent(completionPercent)}
      </span>
    ) : null

  const statusEl = summary.assignmentAvailable && !hasTarget ? (
    <span className="text-sm font-medium text-muted-foreground">No hours required</span>
  ) : null

  const scheduledShifts = [...summary.shifts].sort(
    (a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart),
  )
  const offShiftLogs = [...summary.offShiftLogs].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  )
  const hasSessionList = scheduledShifts.length > 0 || offShiftLogs.length > 0

  return (
    <Card
      data-tier={tier ?? undefined}
      className={cn("@container h-full min-w-0 gap-0 py-0 shadow-none", tierUi?.card)}
    >
      <CardContent className="relative z-10 space-y-3 px-[18px] py-4">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="text-[15px] font-semibold @max-[340px]:text-sm">{title}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1" data-slot="completion-status">
            {tier || percentEl ? (
              <div className="flex min-h-6 flex-nowrap items-center gap-1.5" data-slot="completion-metrics">
                {tier ? <TierBadge tier={tier} className="@max-[340px]:gap-0.5 @max-[340px]:text-[11px] @max-[340px]:[&_svg]:size-3" /> : null}
                {percentEl}
              </div>
            ) : null}
            {statusEl}
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className={cn(
              "text-[26px] font-semibold tracking-tight tabular-nums",
              tier === "legendary" && tierStyles.legendaryHours,
            )}
          >
            {formatHours(summary.loggedMinutes)}
          </span>
          <span className="text-[15px] text-muted-foreground">
            {hasTarget ? `of ${Number(formatHours(summary.targetMinutes ?? 0))}h` : "hrs logged"}
          </span>
          {(summary.excuseMinutes > 0 || summary.excuseDescription) && (
            <span className="text-[13px] font-semibold text-info-muted-foreground">
              {formatHours(summary.excuseMinutes)}h excused
            </span>
          )}
          {summary.overageMinutes > 0 && (
            <span
              className={cn(
                "text-[13px] font-semibold",
                tierUi ? tierUi.text : "text-success-muted-foreground",
              )}
            >
              +{summary.overageMinutes} min extra
            </span>
          )}
        </div>
        {summary.excuseDescription ? (
          <p className="text-sm text-muted-foreground">{summary.excuseDescription}</p>
        ) : null}

        <div className="space-y-1" data-slot="completion-bar">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Completion
          </p>
          <div
            className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(barPercent)}
            aria-valuetext={
              completionPercent != null
                ? `${title}: ${formatPercent(completionPercent)} of the weekly target`
                : `${title}: no weekly target`
            }
          >
            <div
              className={cn(
                "h-full rounded-full",
                tierUi ? tierUi.bar : styles?.bar ?? "bg-muted-foreground/40",
              )}
              style={{
                width: `${barPercent}%`,
                backgroundColor: tier
                  ? undefined
                  : summary.band === "green" ? "var(--success)"
                    : summary.band === "orange" ? "var(--warning)"
                      : summary.band === "red" ? "var(--destructive)" : "var(--info)",
              }}
            />
          </div>
        </div>

        {hasSessionList ? (
          <div className="space-y-0" data-slot="session-list">
            {scheduledShifts.length > 0 ? (
              <div data-slot="scheduled-shifts">
                <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Assigned shifts
                </p>
                <ul>
                  {scheduledShifts.map((shift) => {
                    const day = formatShiftDay(shift.scheduledStart)
                    const assigned = formatClockRange(shift.scheduledStart, shift.scheduledEnd)
                    const logged =
                      shift.loggedStart && shift.loggedEnd
                        ? formatClockRange(shift.loggedStart, shift.loggedEnd)
                        : null
                    const trailing = shiftTrailing(shift)
                    return (
                      <li
                        key={`shift-${shift.sourceId}`}
                        aria-label={
                          logged
                            ? `${day}, assigned ${assigned}, logged ${logged}, ${trailing}`
                            : `${day}, assigned ${assigned}, ${trailing}`
                        }
                        className="flex items-center gap-2 border-t border-border/50 py-2 text-[13px] tabular-nums"
                      >
                        <span className="shrink-0 font-semibold" title={day}>{day.slice(0, 3)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="whitespace-nowrap text-muted-foreground">{assigned}</span>
                          {logged && logged !== assigned ? (
                            <span className="mt-0.5 block text-[12px] text-muted-foreground/80">
                              logged {logged}
                            </span>
                          ) : null}
                        </span>
                        <span className={cn("ml-auto shrink-0 font-semibold", shiftTone(shift))}>
                          {trailing}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {offShiftLogs.length > 0 ? (
              <div data-slot="off-shift-logs">
                <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Extra logged
                </p>
                <ul>
                  {offShiftLogs.map((log, index) => {
                    const day = formatShiftDay(log.start)
                    const times = formatClockRange(log.start, log.end)
                    const hours = formatCompactHours(log.minutes)
                    return (
                      <li
                        key={`log-${log.kind}-${log.sourceIds.join("-")}-${index}`}
                        aria-label={`${day}, ${times}, ${hours}`}
                        className="flex items-center gap-2 border-t border-border/50 py-2 text-[13px] tabular-nums"
                      >
                        <span className="shrink-0 font-semibold" title={day}>{day.slice(0, 3)}</span>
                        <span className="whitespace-nowrap text-muted-foreground">{times}</span>
                        <span className="ml-auto shrink-0 font-semibold">{hours}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
