"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import type { ActivityFormType, RecentFormSubmission } from "@css-atlas/shared/contracts/form-logs"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import { SubmissionDetailsModal } from "./submission-details-modal"
import { buildActivitySummary, formTone } from "@/lib/dashboard/activity-log-dictionary"

type FilterType = "ALL" | ActivityFormType

function formatSubmittedAt(value: string | null) {
  if (!value) return "Unknown time"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown time"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

export function PersonalActivityLogClient({ entries }: { entries: readonly RecentFormSubmission[] }) {
  const [filter, setFilter] = useState<FilterType>("ALL")

  const visibleEntries = useMemo(() => {
    return filter === "ALL" ? entries : entries.filter((entry) => entry.formType === filter)
  }, [entries, filter])

  return (
    <>
      <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
        {(["ALL", "WAHF", "WPL", "MCF"] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={filter === option ? "default" : "ghost"}
            className="rounded-lg"
            onClick={() => setFilter(option)}
          >
            {option === "ALL" ? "All" : option}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleEntries.map((entry) => {
          const formId = `activity-form-${entry.id}`
          const summaryId = `activity-summary-${entry.id}`
          const submittedId = `activity-submitted-${entry.id}`
          return (
            <div
              key={entry.id}
              className="rounded-xl border border-border/60 bg-card px-4 py-3"
            >
              <div className="grid gap-4 sm:grid-cols-[minmax(0,8rem)_1fr_auto] sm:items-start sm:gap-6">
                <div className="space-y-1.5">
                  <Label htmlFor={formId} className="text-muted-foreground">
                    Form
                  </Label>
                  <Badge
                    id={formId}
                    variant="outline"
                    className={cn(
                      "min-w-18 justify-center border-transparent font-semibold",
                      formTone[entry.formType]
                    )}
                  >
                    {entry.formType}
                  </Badge>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={summaryId} className="text-muted-foreground">
                    Summary
                  </Label>
                  <p id={summaryId} className="text-sm font-medium text-foreground">
                    {buildActivitySummary(entry)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end sm:text-right">
                  <div className="space-y-1.5 sm:text-right">
                    <Label htmlFor={submittedId} className="text-muted-foreground sm:ml-auto">
                      Submitted
                    </Label>
                    <p
                      id={submittedId}
                      className="text-sm text-muted-foreground tabular-nums sm:text-right"
                    >
                      {formatSubmittedAt(entry.submittedAt)}
                    </p>
                  </div>
                  <SubmissionDetailsModal entry={entry} />
                </div>
              </div>
            </div>
          )
        })}
        {visibleEntries.length === 0 && (
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
            No recent submissions yet.
          </div>
        )}
      </div>
    </>
  )
}
