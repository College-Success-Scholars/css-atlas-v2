"use client"

import { useState, useMemo } from "react"

import { CompletionMeter } from "@/components/data-display/completion-meter"
import { DataTable, type DataTableColumn } from "@/components/data-display/data-table"
import { cn } from "@/lib/utils"
import { MemoAccordionSection } from "./memo-accordion-section"
import { ScholarNameLink } from "./scholar-name-link"
import type { AttendanceDetailRow, FullAttendanceDetailSectionData } from "../types"

type FullAttendanceDetailSectionProps = {
  data: FullAttendanceDetailSectionData
}

const columns: DataTableColumn<AttendanceDetailRow>[] = [
  {
    id: "scholar",
    header: "Scholar",
    field: "scholarName",
    cellClassName: "font-medium",
    sortable: true,
    renderCell: (row) => (
      <ScholarNameLink scholarId={row.scholarId} isMentee={row.isMentee} cohort={row.cohort}>
        {row.scholarName}
      </ScholarNameLink>
    ),
  },
  {
    id: "class",
    header: "Class",
    field: "scholarYear",
  },
  {
    id: "completed",
    header: "Completed minutes",
    field: "completedMinutes",
    sortable: true,
  },
  {
    id: "excuse",
    header: "Excuse minutes",
    field: "excuseMinutes",
    sortable: true,
    renderCell: (row) =>
      row.excuseMinutes > 0 ? (
        <span className="tabular-nums">{row.excuseMinutes}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "required",
    header: "Required minutes",
    field: "requiredMinutes",
    sortable: true,
  },
  {
    id: "completion",
    header: "Completion",
    field: "completionPct",
    sortable: true,
    compareFn: (a, b) =>
      a.completionPct !== b.completionPct
        ? a.completionPct - b.completionPct
        : a.scholarName.localeCompare(b.scholarName),
    renderCell: (row) => <CompletionMeter pct={row.completionPct} />,
  },
]

export function FullAttendanceDetailSection({ data }: FullAttendanceDetailSectionProps) {
  const [selectedTabId, setSelectedTabId] = useState(data.tabs[0]?.id ?? "front-desk")

  const selectedTab = useMemo(
    () => data.tabs.find((tab) => tab.id === selectedTabId) ?? data.tabs[0],
    [data.tabs, selectedTabId]
  )

  if (!selectedTab) return null

  const { wahfCensus } = data

  return (
    <MemoAccordionSection
      title="Full attendance detail"
      description="Hours for every scholar with required minutes, plus overall WAHF submission. Missing or late WAHF shows on scholar follow-up."
      rightLabel={data.rightLabel}
    >
      <div className="space-y-3 px-3 py-3">
        <div className="rounded-md bg-muted/40 p-3">
          <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">WAHF</div>
          <p className="text-muted-foreground mt-1 text-xs">
            Overall submission among scholars with required hours. WPL and MCF are on team leader performance.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">On time</div>
              <div className="font-medium text-success tabular-nums">{wahfCensus.onTime}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Late</div>
              <div className="font-medium text-warning-muted-foreground tabular-nums">{wahfCensus.late}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Missing</div>
              <div className="font-medium text-destructive tabular-nums">{wahfCensus.missing}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-muted/40 p-1">
          {data.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTabId(tab.id)}
              className={cn(
                "cursor-pointer rounded-sm px-3 py-1.5 text-sm transition-colors",
                tab.id === selectedTabId ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <DataTable<AttendanceDetailRow>
          data={selectedTab.rows}
          rowKeyField="scholarName"
          columns={columns}
          defaultSortColumnId="completion"
          defaultSortDirection="asc"
          emptyMessage="No attendance records"
        />
      </div>
    </MemoAccordionSection>
  )
}
