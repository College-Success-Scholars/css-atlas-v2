"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AmPmChecklistRow } from "@/lib/types/am-pm-checklist"

/** All program times are Eastern, regardless of the viewer's own timezone. */
const ET_TIMESTAMP = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
})

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "no timestamp"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "no timestamp"
  return ET_TIMESTAMP.format(date)
}

interface AmPmCardProps {
  menteeName: string
  /** This mentee's submissions for the selected week only. */
  rows: AmPmChecklistRow[]
}

export function AmPmCard({ menteeName, rows }: AmPmCardProps) {
  const owed = rows.filter((r) => r.reminderOwed).length
  const alertState = owed > 0

  return (
    <Card
      className={cn(
        "h-full min-h-0 flex-col justify-start py-0",
        alertState && "border-destructive/50",
      )}
    >
      <CardContent className="flex flex-1 flex-col justify-start space-y-4 pt-4 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Front desk AM/PM checklist
        </p>

        {rows.length === 0 ? (
          <>
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="font-semibold text-foreground">No submissions</p>
              <p className="text-sm text-muted-foreground">
                Nothing filed for this week.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {menteeName} may not have worked a front desk shift this week.
            </p>
          </>
        ) : (
          <>
            <div
              className={cn(
                "rounded-lg border p-4",
                alertState
                  ? "border-destructive/30 bg-destructive/10"
                  : "border-border bg-muted/40",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p
                    className={cn(
                      "font-semibold",
                      alertState ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {rows.length} {rows.length === 1 ? "submission" : "submissions"}
                  </p>
                  <p
                    className={cn(
                      "text-sm",
                      alertState ? "text-destructive/90" : "text-muted-foreground",
                    )}
                  >
                    {owed > 0
                      ? `${owed} filed outside the claimed shift`
                      : "All filed within shift"}
                  </p>
                </div>
                <Badge
                  variant={alertState ? "destructive" : "default"}
                  className="shrink-0"
                >
                  {alertState ? "Needs follow-up" : "On track"}
                </Badge>
              </div>
            </div>

            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="flex flex-col">
                    <span className="text-xs">{row.shift ?? "shift not set"}</span>
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                      {formatSubmittedAt(row.submittedAt)}
                      {row.tasksTotal > 0
                        ? ` · ${row.tasksCompleted}/${row.tasksTotal} tasks`
                        : ""}
                    </span>
                  </span>
                  <Badge
                    variant={row.shiftValid ? "success" : "destructive"}
                    className="shrink-0"
                  >
                    {row.shiftValid ? "In shift" : "Outside shift"}
                  </Badge>
                </li>
              ))}
            </ul>

            <p className="text-sm text-muted-foreground">
              {owed > 0
                ? `Follow up with ${menteeName} about filing the checklist during their shift.`
                : `${menteeName} is filing the checklist on time.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
