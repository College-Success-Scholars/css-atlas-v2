"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { GradeComparison, LatestGradesSummary } from "@/lib/types/mentee-review"

import { GRADE_BAND_STYLES, formatClock, formatDayMonth, formatPercent } from "./utils"

interface RecentGradesSummaryCardProps {
  summary: LatestGradesSummary
}

function comparisonText(comparison: GradeComparison): string {
  if (comparison.direction === "equal") {
    const prior = comparison.priorAssessment ? ` (${comparison.priorAssessment})` : ""
    return `Same as ${formatPercent(comparison.priorPercent)}${prior}`
  }
  const arrow = comparison.direction === "up" ? "↑" : "↓"
  const prior = comparison.priorAssessment ? ` (${comparison.priorAssessment})` : ""
  return `${arrow} from ${formatPercent(comparison.priorPercent)}${prior}`
}

/** This and last calendar week's WAHF grades — independent of the selected week. */
export function RecentGradesSummaryCard({ summary }: RecentGradesSummaryCardProps) {
  return (
    <Card className="min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="space-y-3 px-[18px] py-4">
        <div className="space-y-1">
          <h2 className="text-[17px] font-semibold">Recent grades</h2>
          <p className="text-[13px] text-muted-foreground">
            This week and last week · WAHF submissions
          </p>
        </div>

        {summary.status === "grades" && summary.entries.length > 0 && (
          <ul aria-label="Grades from this week and last week">
            {summary.entries.map((entry, index) => {
              // Legacy single-submission payloads/fixtures have summary provenance only.
              const submittedAt = entry.submittedAt ?? summary.submittedAt
              return (
                <li key={`${entry.submissionId ?? summary.submissionId}-${index}`} className="flex items-center justify-between gap-2.5 border-t border-border/50 py-2.5">
                  <div className="min-w-0 break-words">
                    <p className="text-sm font-semibold">{entry.course} <span className="font-normal text-muted-foreground">{entry.assessment}</span></p>
                    {submittedAt && (
                      <p className="text-[13px] text-muted-foreground">
                        Submitted <time dateTime={submittedAt}>{formatDayMonth(submittedAt)} at {formatClock(submittedAt)} ET</time>
                      </p>
                    )}
                    {entry.comparison ? (
                      <p className="text-[13px] text-muted-foreground">
                        {comparisonText(entry.comparison)}
                      </p>
                    ) : entry.firstGrade ? (
                      <p className="text-[13px] text-muted-foreground">First grade logged</p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className={cn("max-w-[45%] rounded-full border-transparent px-2.5 py-1 text-[13px] font-semibold whitespace-normal break-words", GRADE_BAND_STYLES[entry.band ?? "neutral"])}>
                    {entry.rawGrade}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}

        {summary.status === "empty" && (
          <p className="text-sm text-muted-foreground">No grades reported this week or last week.</p>
        )}

        {summary.status === "error" && (
          <p className="text-sm text-muted-foreground">Grades could not be read.</p>
        )}
      </CardContent>
    </Card>
  )
}
