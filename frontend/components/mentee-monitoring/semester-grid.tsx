"use client"

import { useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  SectionResult,
  ShiftSessionKind,
  WeekDescriptor,
  WeekReviewSummary,
} from "@/lib/types/mentee-review"

import { SectionError } from "./section-error"
import { PENDING_STYLES, formatDayMonth, formatHours, formatPercent } from "./utils"

type RowId = ShiftSessionKind | "wahf" | "tutoring"

const ROWS: { id: RowId; label: string }[] = [
  { id: "front_desk", label: "Front desk" },
  { id: "study_session", label: "Study" },
  { id: "wahf", label: "WAHF" },
  { id: "tutoring", label: "Tutoring" },
]

type CellTone = "green" | "orange" | "red" | "pending" | "neutral" | "future" | "break"

const TONE_CLASSES: Record<CellTone, string> = {
  green: "border-success/30 bg-success-muted text-success-muted-foreground",
  orange: "border-warning/30 bg-warning-muted text-warning-muted-foreground",
  red: "border-destructive/20 bg-destructive/10 text-destructive",
  pending: PENDING_STYLES.cell,
  neutral: "border-border/70 bg-muted/70 text-muted-foreground",
  future: "border-dashed border-border bg-transparent text-transparent",
  break: "border-border bg-muted/40 text-muted-foreground",
}

function columnBackground(
  week: WeekDescriptor,
  currentWeek: number | null,
  hoveredWeek: number | null,
  selectedWeek: number | null,
): string {
  if (selectedWeek === week.weekNumber) return "bg-primary/[0.07]"
  if (currentWeek === week.weekNumber) {
    return hoveredWeek === week.weekNumber ? "bg-info-muted/80" : "bg-info-muted/50"
  }
  if (hoveredWeek === week.weekNumber && week.isSelectable) return "bg-muted/40"
  return ""
}

interface GridCell {
  text: string
  tone: CellTone
  disabled: boolean
  description: string
}

function cellFor(row: RowId, label: string, week: WeekDescriptor, summary: WeekReviewSummary | null): GridCell {
  const base = `week ${week.weekNumber}`
  if (week.isBreak) return { text: "", tone: "break", disabled: true, description: `${label}: ${base}, break` }
  if (week.isFuture) return { text: "", tone: "future", disabled: true, description: `${label}: ${base}, not yet started` }
  if (!summary) return { text: "", tone: "neutral", disabled: true, description: `${label}: ${base}, unavailable` }

  if (row === "wahf") {
    switch (summary.wahf.status) {
      case "submitted":
        return { text: "✓", tone: "green", disabled: false, description: `${label}: ${base}, submitted` }
      case "missing":
        return { text: "✕", tone: "red", disabled: false, description: `${label}: ${base}, not submitted` }
      case "pending":
        return { text: "", tone: "pending", disabled: false, description: `${label}: ${base}, not yet due` }
      default:
        return { text: "", tone: "neutral", disabled: false, description: `${label}: ${base}, unavailable` }
    }
  }

  if (row === "tutoring") {
    if (summary.tutoring.status === "recorded") {
      return { text: "✓", tone: "green", disabled: false, description: `${label}: ${base}, attended` }
    }
    return { text: "", tone: "neutral", disabled: false, description: `${label}: ${base}, no attendance recorded` }
  }

  const hours = summary.hours.find((entry) => entry.kind === row)
  if (!hours) {
    return { text: "", tone: "neutral", disabled: false, description: `${label}: ${base}, unavailable` }
  }

  const value = `${formatHours(hours.loggedMinutes)}${hours.noShowCount > 0 ? " •" : ""}`
  // Match the cards: the band is the source of truth whenever a target exists,
  // even when no shifts were assigned (off-shift logs still count).
  const tone: CellTone =
    week.isCurrent && hours.pending ? "pending" : hours.band ?? "neutral"
  const logged = formatHours(hours.loggedMinutes)
  const target = hours.targetMinutes != null && hours.targetMinutes > 0
    ? formatHours(hours.targetMinutes)
    : null
  const notes = [
    target ? `${logged} of ${target} hours` : `${logged} hours`,
    hours.percent != null ? formatPercent(hours.percent) : null,
    hours.noShowCount > 0 ? `${hours.noShowCount} no-show` : null,
    hours.pending ? "in progress" : null,
  ]
    .filter(Boolean)
    .join(", ")
  return { text: value, tone, disabled: false, description: `${label}: ${base}, ${notes}` }
}

interface SemesterGridProps {
  result: SectionResult<WeekReviewSummary[]>
  weeks: WeekDescriptor[]
  selectedWeek: number | null
  currentWeek: number | null
  pending: boolean
  onSelect: (week: number) => void
  onRetry: () => void
}

/** Semester week grid: one column per week, one row per requirement, column selection. */
export function SemesterGrid({
  result,
  weeks,
  selectedWeek,
  currentWeek,
  pending,
  onSelect,
  onRetry,
}: SemesterGridProps) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null)

  if (!result.ok) {
    return (
      <SectionError
        title="Semester grid"
        message={result.error.message}
        retriable={result.error.retriable}
        onRetry={onRetry}
        pending={pending}
      />
    )
  }

  const summaries = new Map(result.data.map((summary) => [summary.weekNumber, summary]))

  return (
    <Card className="min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="min-w-0 space-y-3 px-5 py-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Semester overview <span className="font-normal text-muted-foreground">· select a week</span></h2>
          <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-sm bg-success-muted" aria-hidden />
              90%+
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-sm bg-warning-muted" aria-hidden />
              60–89%
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-sm bg-destructive/10" aria-hidden />
              Under 60% or missed
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-sm bg-info-muted ring-1 ring-info/30" aria-hidden />
              Current week
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden>•</span>
              no-show
            </li>
          </ul>
        </div>

        <div className="min-w-0 overflow-x-auto p-0.5" role="group" aria-label="Semester weeks by requirement">
          <table className="w-full table-fixed border-separate border-spacing-x-[5px] border-spacing-y-1.5" style={{ minWidth: Math.max(680, 96 + weeks.length * 37) }}>
            <caption className="sr-only">
              Each column is one instructional week. Hover a column to preview it, then select it to review that week.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-24 text-left text-xs font-medium text-muted-foreground">
                  <span className="sr-only">Requirement</span>
                </th>
                {weeks.map((week) => {
                  const isSelected = selectedWeek === week.weekNumber
                  const isCurrent = currentWeek === week.weekNumber
                  const isHovered = hoveredWeek === week.weekNumber
                  const headerLabel = week.isBreak ? "Break" : isCurrent ? "Now" : String(week.weekNumber)
                  const dateRange = `${formatDayMonth(week.startDate)}–${formatDayMonth(week.endDate)}`
                  return (
                    <th key={week.weekNumber} scope="col" className="p-0">
                      <Button variant="ghost"
                        type="button"
                        disabled={!week.isSelectable}
                        aria-pressed={isSelected}
                        aria-current={isCurrent ? "true" : undefined}
                        aria-label={`Week ${week.weekNumber}, ${dateRange}${isCurrent ? ", current week" : ""}`}
                        title={`Week ${week.weekNumber} · ${dateRange}`}
                        onClick={() => onSelect(week.weekNumber)}
                        onMouseEnter={() => setHoveredWeek(week.weekNumber)}
                        onMouseLeave={() => setHoveredWeek(null)}
                        onFocus={() => setHoveredWeek(week.weekNumber)}
                        onBlur={() => setHoveredWeek(null)}
                        className={cn(
                          "h-8 w-full rounded-md px-0 text-xs font-medium transition-colors disabled:opacity-100",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          week.isSelectable ? "cursor-pointer" : "cursor-default",
                          isSelected
                            ? "bg-primary/10 font-bold text-primary"
                            : isCurrent
                              ? isHovered ? "bg-info-muted text-foreground" : "bg-info-muted/60 text-foreground"
                              : isHovered && week.isSelectable
                                ? "bg-muted/60 text-foreground"
                                : "text-muted-foreground",
                        )}
                      >
                        {headerLabel}
                      </Button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="w-24 align-middle text-left text-[13px] font-medium"
                  >
                    {row.label}
                  </th>
                  {weeks.map((week) => {
                    const cell = cellFor(row.id, row.label, week, summaries.get(week.weekNumber) ?? null)
                    const description = `${cell.description} · ${formatDayMonth(week.startDate)}–${formatDayMonth(week.endDate)}`
                    const isSelected = selectedWeek === week.weekNumber
                    const isCurrent = currentWeek === week.weekNumber
                    const isHovered = hoveredWeek === week.weekNumber && week.isSelectable
                    return (
                      <td
                        key={week.weekNumber}
                        data-week={week.weekNumber}
                        className={cn(
                          "p-0 align-middle transition-colors",
                          columnBackground(week, currentWeek, hoveredWeek, selectedWeek),
                        )}
                        onMouseEnter={() => setHoveredWeek(week.weekNumber)}
                        onMouseLeave={() => setHoveredWeek(null)}
                      >
                        <Button variant="ghost"
                          type="button"
                          disabled={cell.disabled}
                          tabIndex={-1}
                          aria-pressed={isSelected}
                          aria-label={description}
                          title={description}
                          onClick={() => onSelect(week.weekNumber)}
                          onFocus={() => setHoveredWeek(week.weekNumber)}
                          onBlur={() => setHoveredWeek(null)}
                          className={cn(
                            "flex h-8 w-full items-center justify-center rounded-md border px-0 text-xs font-semibold leading-none tabular-nums transition-colors disabled:opacity-100 motion-reduce:transition-none",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            TONE_CLASSES[cell.tone],
                            cell.disabled ? "cursor-default" : "cursor-pointer",
                            isSelected && "ring-1 ring-inset ring-primary/40",
                            isCurrent && !isSelected && "ring-1 ring-inset ring-info/30",
                            isHovered && !isSelected && !isCurrent && "ring-1 ring-inset ring-foreground/15",
                          )}
                        >
                          {cell.text}
                        </Button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
