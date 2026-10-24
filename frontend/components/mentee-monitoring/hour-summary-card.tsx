"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { HourWeekSummary, ShiftEvidence } from "@/lib/types/mentee-review"

import type { FollowUpDraft } from "./follow-up-drafts"
import {
  HOUR_BAND_STYLES,
  PENDING_STYLES,
  formatClock,
  formatHours,
  formatPercent,
  formatShiftDay,
  hourCardTitle,
} from "./utils"

interface HourSummaryCardProps {
  summary: HourWeekSummary
  followUp: FollowUpDraft | null
}

type RowTone = "muted" | "orange" | "red" | "blue"

const ROW_TONE_CLASSES: Record<RowTone, string> = {
  muted: "text-muted-foreground",
  orange: "text-warning-muted-foreground",
  red: "text-destructive",
  blue: "text-info-muted-foreground",
}

function shiftRow(shift: ShiftEvidence) {
  const scheduled = `${formatClock(shift.scheduledStart)}–${formatClock(shift.scheduledEnd)}`
  const hasLogged = shift.loggedStart != null && shift.loggedEnd != null
  const logged = hasLogged && shift.loggedStart && shift.loggedEnd
    ? `${formatClock(shift.loggedStart)}–${formatClock(shift.loggedEnd)}`
    : null

  switch (shift.status) {
    case "attended":
      return { times: logged ?? scheduled, value: `${formatHours(shift.overlapMinutes)} hrs`, tone: "muted" as RowTone }
    case "short":
      return {
        times: `${logged ?? scheduled} · scheduled ${scheduled}`,
        value: `${formatHours(shift.overlapMinutes)} hrs`,
        tone: "orange" as RowTone,
      }
    case "no_show":
      return { times: `Scheduled ${scheduled}`, value: "No-show", tone: "red" as RowTone }
    case "unconfirmed":
      return { times: `Scheduled ${scheduled}`, value: "Unconfirmed", tone: "muted" as RowTone }
    case "active":
      return { times: `Scheduled ${scheduled}`, value: "In progress", tone: "blue" as RowTone }
    case "upcoming":
    default:
      return { times: `Scheduled ${scheduled}`, value: "Upcoming", tone: "blue" as RowTone }
  }
}

/** One requirement card: percent/pending, hours vs target, notched bar, shift + off-shift rows. */
export function HourSummaryCard({ summary, followUp }: HourSummaryCardProps) {
  const title = hourCardTitle(summary.kind)
  const hasTarget = summary.targetMinutes != null && summary.targetMinutes > 0
  const styles = summary.band ? HOUR_BAND_STYLES[summary.band] : null
  const barPercent =
    summary.assignmentAvailable && hasTarget && summary.percent != null
      ? Math.min(100, Math.max(0, summary.percent))
      : 0

  const statusEl = !summary.assignmentAvailable ? (
    <span className="text-sm font-medium text-muted-foreground">No shifts assigned</span>
  ) : !hasTarget ? (
    <span className="text-sm font-medium text-muted-foreground">No hours required</span>
  ) : summary.pending ? (
    <span
      className={cn(
        "text-sm font-semibold",
        PENDING_STYLES.text,
      )}
    >
      In progress
    </span>
  ) : summary.percent != null ? (
    <span className={cn("text-sm font-semibold", styles?.text)}>
      {formatPercent(summary.percent)}
    </span>
  ) : null

  const nothingToShow =
    summary.assignmentAvailable && summary.shifts.length === 0 && summary.offShiftLogs.length === 0

  return (
    <Card className="h-full min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="space-y-3 px-[18px] py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {statusEl}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[26px] font-semibold tracking-tight tabular-nums">
            {formatHours(summary.loggedMinutes)}
          </span>
          <span className="text-[15px] text-muted-foreground">
            {hasTarget ? `of ${Number(formatHours(summary.targetMinutes ?? 0))}h` : "hrs logged"}
          </span>
        {summary.overageMinutes > 0 && (
          <span className="text-[13px] font-semibold text-success-muted-foreground">
            +{summary.overageMinutes} min extra
          </span>
        )}
        </div>

        <div
          className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={
            hasTarget && summary.percent != null
              ? `${title}: ${formatPercent(summary.percent)} of the weekly target`
              : `${title}: no weekly target`
          }
        >
          <div
            className={cn("h-full rounded-full", summary.pending ? PENDING_STYLES.bar : styles?.bar)}
            style={{ width: `${barPercent}%` }}
          />
           <span className="absolute inset-y-0 left-[60%] w-0.5 bg-card" aria-hidden />
           <span className="absolute inset-y-0 left-[90%] w-0.5 bg-card" aria-hidden />
        </div>

        {!summary.assignmentAvailable ? (
          <p className="text-sm text-muted-foreground">No shifts assigned this week.</p>
        ) : nothingToShow ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul>
            {summary.shifts.map((shift) => {
              const row = shiftRow(shift)
              return (
                <li key={shift.sourceId} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-border/50 py-1.5 text-sm">
                  <span className="font-semibold" title={formatShiftDay(shift.date)}>{formatShiftDay(shift.date).slice(0, 3)}</span>
                  <span className="min-w-0 break-words text-muted-foreground">{row.times}</span>
                  <p className={cn("text-right text-[13px] font-medium tabular-nums", ROW_TONE_CLASSES[row.tone])}>
                    {row.value}
                  </p>
                </li>
              )
            })}
            {summary.offShiftLogs.map((log, index) => (
              <li
                key={`${log.kind}-${log.sourceIds.join("-")}-${index}`}
                className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-border/50 py-1.5 text-sm"
              >
                <span className="font-semibold" title={formatShiftDay(log.start)}>{formatShiftDay(log.start).slice(0, 3)}</span>
                <span className="min-w-0 break-words text-muted-foreground">
                  {formatClock(log.start)}–{formatClock(log.end)} (not scheduled)
                </span>
                <p className="text-[13px] font-medium tabular-nums text-muted-foreground">
                  {formatHours(log.minutes)} hrs
                </p>
              </li>
            ))}
          </ul>
        )}

        {followUp && (
          <div>
            {followUp.href ? (
              <a
                href={followUp.href}
                className="inline-flex min-h-11 items-center text-sm font-medium text-info-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {followUp.label}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground" title="No scholar email on file">
                {followUp.label} — no scholar email on file
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
