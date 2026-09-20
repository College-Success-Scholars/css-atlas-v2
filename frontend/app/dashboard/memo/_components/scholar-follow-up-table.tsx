import { Clock } from "lucide-react"

import { CompletionMeter } from "@/components/data-display/completion-meter"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MemoAccordionSection } from "./memo-accordion-section"
import type { ScholarFollowUpIssue, ScholarFollowUpRow } from "../types"

type ScholarFollowUpTableProps = {
  rows: ScholarFollowUpRow[]
}

function FollowUpIssueDetail({ issue }: { issue: ScholarFollowUpIssue }) {
  if (issue.kind === "wahf") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {issue.submittedAtLabel ? (
          <span className="tabular-nums">{issue.submittedAtLabel}</span>
        ) : (
          <span className="text-muted-foreground">No submission</span>
        )}
        {issue.status === "late" ? <Badge variant="warning">Late</Badge> : null}
      </div>
    )
  }

  if (issue.kind === "grade") {
    return <CompletionMeter pct={issue.pct} />
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CompletionMeter pct={issue.pct} />
      {issue.requiredMinutes != null && issue.requiredMinutes > 0 ? (
        <span className="text-muted-foreground text-xs tabular-nums">of {issue.requiredMinutes} min</span>
      ) : null}
      <span className="text-muted-foreground text-xs tabular-nums">
        {issue.insideMinutes} min inside · {issue.outsideMinutes} min outside
      </span>
    </div>
  )
}

export function ScholarFollowUpTable({ rows }: ScholarFollowUpTableProps) {
  return (
    <MemoAccordionSection
      title="Scholar follow-up"
      description="Who needs a conversation this week — low hours, low grades, or missing/late WAHF."
      badgeText={`${rows.length} need attention`}
      badgeVariant="warning"
      rightLabel="Sorted by severity"
      defaultOpen
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="px-4">Scholar</TableHead>
            <TableHead>TL</TableHead>
            <TableHead>What&apos;s missing</TableHead>
            <TableHead className="pr-4">How it&apos;s missing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.scholarName}>
              <TableCell className="px-4 align-top">
                <div className="font-medium">{row.scholarName}</div>
                <div className="text-muted-foreground text-xs">{row.scholarYear}</div>
              </TableCell>
              <TableCell
                className={`align-top text-sm ${row.teamLeader === "Unassigned" ? "text-muted-foreground" : ""}`}
              >
                {row.teamLeader}
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-col items-start gap-2">
                  {row.issues.map((issue, index) => (
                    <div key={`${issue.kind}-${issue.glance}-${index}`} className="flex min-h-8 items-center">
                      <Badge variant="warning">{issue.glance}</Badge>
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell className="pr-4 align-top">
                <div className="flex flex-col flex-wrap content-start gap-2">
                  {row.issues.map((issue, index) => (
                    <div key={`${issue.kind}-${issue.glance}-${index}`} className="flex min-h-8 items-center">
                      <FollowUpIssueDetail issue={issue} />
                    </div>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MemoAccordionSection>
  )
}
