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

/** Latest WAHF grades — independent of the selected week. */
export function RecentGradesSummaryCard({ summary }: RecentGradesSummaryCardProps) {
  const submittedLabel = summary.submittedAt
    ? `${formatDayMonth(summary.submittedAt)} at ${formatClock(summary.submittedAt)}`
    : null

  return (
    <Card className="min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="space-y-3 px-[18px] py-4">
        <div className="space-y-1">
          <h2 className="text-[17px] font-semibold">Recent grades</h2>
          <p className="text-[13px] text-muted-foreground">
            {submittedLabel
              ? `From WAHF submitted ${submittedLabel}`
              : "From the most recent WAHF submission."}
          </p>
        </div>

        {summary.status === "grades" && summary.entries.length > 0 && (
          <ul aria-label="Grades from the latest WAHF submission">
              {summary.entries.map((entry, index) => (
                <li key={`${entry.course}-${entry.assessment}-${index}`} className="flex items-center justify-between gap-2.5 border-t border-border/50 py-2.5">
                  <div className="min-w-0 break-words">
                    <p className="text-sm font-semibold">{entry.course} <span className="font-normal text-muted-foreground">{entry.assessment}</span></p>
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
              ))}
          </ul>
        )}

        {summary.status === "empty" && (
          <p className="text-sm text-muted-foreground">No grades reported yet.</p>
        )}

        {summary.status === "error" && (
          <p className="text-sm text-muted-foreground">Grades could not be read.</p>
        )}
      </CardContent>
    </Card>
  )
}
