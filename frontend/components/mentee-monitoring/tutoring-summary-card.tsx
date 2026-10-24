"use client"

import { Check } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TutoringWeekSummary } from "@/lib/types/mentee-review"

import { formatShiftDay } from "./utils"

interface TutoringSummaryCardProps {
  summary: TutoringWeekSummary
}

/** Recorded tutoring attendance for the selected week; one line per report. */
export function TutoringSummaryCard({ summary }: TutoringSummaryCardProps) {
  return (
    <Card className="h-full min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="space-y-2 px-[18px] py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold">Tutoring</h3>
          {summary.status === "recorded" && (
            <Badge variant="success" className="rounded-full border-transparent px-2.5 py-1 text-[13px] font-semibold">
              <Check className="size-3.5" aria-hidden />
              Attended
            </Badge>
          )}
          {summary.status === "none" && (
            <Badge variant="secondary" className="max-w-full rounded-full bg-muted px-2.5 py-1 text-[13px] font-semibold whitespace-normal text-muted-foreground">
              No attendance recorded
            </Badge>
          )}
          {summary.status === "unknown" && (
            <Badge variant="secondary" className="rounded-full bg-muted px-2.5 py-1 text-[13px] font-semibold text-muted-foreground">
              Not available
            </Badge>
          )}
        </div>

        {summary.status === "recorded" && summary.reports.length > 0 && (
          <ul className="divide-y divide-border">
            {summary.reports.map((report) => {
              const times =
                report.startTime && report.endTime
                  ? `${report.startTime}–${report.endTime}`
                  : report.startTime ?? report.endTime ?? null
              return (
                <li key={report.reportId} className="space-y-0.5 py-2 first:pt-0">
                  <p className={cn("text-sm font-medium", report.courses.length === 0 && "text-muted-foreground")}>
                    {report.courses.length > 0 ? report.courses.join(", ") : "Tutoring session"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[report.date ? formatShiftDay(report.date) : null, times]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              )
            })}
          </ul>
        )}

        {summary.status === "none" && (
          <p className="text-sm text-muted-foreground">No tutoring attendance recorded this week.</p>
        )}

        {summary.status === "unknown" && (
          <p className="text-sm text-muted-foreground">
            Tutoring attendance could not be read.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
