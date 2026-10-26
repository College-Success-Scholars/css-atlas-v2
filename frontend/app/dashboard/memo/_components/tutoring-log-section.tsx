"use client"

import { useMemo, useState } from "react"

import { DataTable, type DataTableColumn } from "@/components/data-display/data-table"
import { cn } from "@/lib/utils"
import { MemoAccordionSection } from "./memo-accordion-section"
import { ScholarNameLink } from "./scholar-name-link"
import type { TutoringLogRow, TutoringLogSectionData } from "../types"

type TutoringLogSectionProps = {
  data: TutoringLogSectionData
}

const DAY_SORT_MAP: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

const sessionColumns: DataTableColumn<TutoringLogRow>[] = [
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
    id: "day",
    header: "Day",
    field: "dayOfWeek",
    sortable: true,
    getSortValue: (row) => DAY_SORT_MAP[row.dayOfWeek] ?? 7,
  },
  {
    id: "tutor",
    header: "Tutor",
    field: "tutorName",
    sortable: true,
  },
  {
    id: "courses",
    header: "Courses",
    field: "courses",
    renderCell: (row) => <span>{row.courses.join(", ")}</span>,
  },
  {
    id: "time",
    header: "Time",
    field: "startTime",
    sortable: true,
    renderCell: (row) => (
      <span>
        {row.startTime} – {row.endTime}
      </span>
    ),
  },
]

const emptySessionColumns: DataTableColumn<TutoringLogRow>[] = [
  {
    id: "day",
    header: "Day",
    field: "dayOfWeek",
    sortable: true,
    getSortValue: (row) => DAY_SORT_MAP[row.dayOfWeek] ?? 7,
  },
  {
    id: "tutor",
    header: "Tutor",
    field: "tutorName",
    sortable: true,
  },
]

export function TutoringLogSection({ data }: TutoringLogSectionProps) {
  const [selectedTabId, setSelectedTabId] = useState(data.tabs[0]?.id ?? "sessions")

  const selectedTab = useMemo(
    () => data.tabs.find((tab) => tab.id === selectedTabId) ?? data.tabs[0],
    [data.tabs, selectedTabId]
  )

  if (!selectedTab) return null

  const columns = selectedTab.id === "sessions" ? sessionColumns : emptySessionColumns
  const emptyMessage =
    selectedTab.id === "sessions" ? "No tutoring sessions this week" : "No empty sessions this week"

  return (
    <MemoAccordionSection
      title="Tutoring log"
      badgeText={data.badgeText}
      badgeClassName="bg-info-muted text-info-muted-foreground border-info/30"
      rightLabel={data.rightLabel}
    >
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-center gap-1.5 rounded-md bg-muted/40 p-1">
          {data.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTabId(tab.id)}
              className={cn(
                "cursor-pointer rounded-sm px-3 py-1.5 text-sm transition-colors",
                tab.id === selectedTabId
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <DataTable<TutoringLogRow>
          data={selectedTab.rows}
          rowKeyField="id"
          columns={columns}
          defaultSortColumnId="day"
          defaultSortDirection="asc"
          emptyMessage={emptyMessage}
        />
      </div>
    </MemoAccordionSection>
  )
}
