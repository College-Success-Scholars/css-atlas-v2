"use client"

import { Check, X } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { WahfWeekSummary } from "@/lib/types/mentee-review"

import type { FollowUpDraft } from "./follow-up-drafts"
import { PENDING_STYLES, formatClock, formatDayMonth, formatWeekdayDate } from "./utils"

interface WahfSummaryCardProps {
  summary: WahfWeekSummary
  followUp: FollowUpDraft | null
}

function statusPill(summary: WahfWeekSummary) {
  switch (summary.status) {
    case "submitted":
      return (
        <Badge variant="success" className="rounded-full border-transparent px-2.5 py-1 text-[13px] font-semibold">
          <Check className="size-3.5" aria-hidden />
          Submitted
        </Badge>
      )
    case "missing":
      return (
        <Badge variant="outline" className="rounded-full border-transparent bg-destructive/10 px-2.5 py-1 text-[13px] font-semibold text-destructive">
          <X className="size-3.5" aria-hidden />
          Not submitted
        </Badge>
      )
    case "pending":
      return (
        <Badge variant="info"
          className={cn(
            "rounded-full border-transparent px-2.5 py-1 text-[13px] font-semibold",
            PENDING_STYLES.pill,
          )}
        >
          Not yet due
        </Badge>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          Status unavailable
        </span>
      )
  }
}

/** WAHF requirement card for the selected week. */
export function WahfSummaryCard({ summary, followUp }: WahfSummaryCardProps) {
  const submittedDetail =
    summary.status === "submitted" && summary.submittedAt
      ? `Submitted ${formatDayMonth(summary.submittedAt)} at ${formatClock(summary.submittedAt)}`
      : null

  return (
    <Card className="h-full min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="space-y-2 px-[18px] py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold">WAHF</h3>
          {statusPill(summary)}
        </div>

        {summary.status === "submitted" && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{submittedDetail}</p>
            {summary.onTime === true && <p className="text-sm text-muted-foreground">On time</p>}
            {summary.onTime === false && <p className="text-sm font-medium text-warning-muted-foreground">Late</p>}
          </div>
        )}

        {summary.status === "missing" && (
          <p className="text-sm text-muted-foreground">
            Was due {formatWeekdayDate(summary.dueAt)}
          </p>
        )}

        {summary.status === "pending" && (
          <p className="text-sm text-muted-foreground">Due {formatWeekdayDate(summary.dueAt)}</p>
        )}

        {summary.status === "unknown" && (
          <p className="text-sm text-muted-foreground">
            The WAHF submission status could not be read.
          </p>
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
