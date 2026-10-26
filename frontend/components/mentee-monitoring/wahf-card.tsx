"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { WahfStatus } from "./utils"
import { SubmissionDetailsModal } from "@/components/dashboard/widgets/submission-details-modal"

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return format(date, "MMM d, yyyy 'at' h:mm a")
}

interface WahfCardProps {
  menteeName: string
  status: WahfStatus
}

export function WahfCard({ menteeName, status }: WahfCardProps) {
  const alertState = !status.submitted && status.daysOverdue > 0

  return (
    <Card
      className={cn(
        "h-full min-h-0 flex-col justify-start py-0",
        alertState && "border-destructive/50",
      )}
    >
      <CardContent className="flex flex-1 flex-col justify-start space-y-4 pt-4 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          WAHF submission
        </p>

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
                Weekly Academic Honors Form
              </p>
              <p
                className={cn(
                  "text-sm",
                  alertState ? "text-destructive/90" : "text-muted-foreground",
                )}
              >
                Due {status.dueDate}
                {alertState ? (
                  <> &middot; {status.daysOverdue} days overdue</>
                ) : null}
                {status.submitted && status.latestSubmission ? (
                  <> &middot; Submitted {formatSubmittedAt(status.latestSubmission.created_at)}</>
                ) : null}
              </p>
            </div>
            <Badge
              variant={status.submitted ? "default" : "destructive"}
              className="shrink-0"
            >
              {status.submitted ? "Submitted" : "Not submitted"}
            </Badge>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {status.submitted
            ? `${menteeName} is up to date on this form.`
            : `Follow up with ${menteeName} to submit this form immediately.`}
        </p>
        {status.latestSubmission && (
          <SubmissionDetailsModal
            key={status.latestSubmission.id}
            entry={{
              ...status.latestSubmission,
              formType: "WAHF",
              submittedAt: status.latestSubmission.created_at,
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
