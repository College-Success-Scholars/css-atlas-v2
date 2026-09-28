"use client"

/**
 * @file campus-week-nav.tsx
 * @module frontend/components/data-display
 *
 * Shared campus-week selector: previous/next plus a dropdown.
 * Each option shows the week number and the calendar days that week represents.
 * Callers own navigation (URL push or local state) via `onWeekChange`.
 */

import { useMemo, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  adjacentCampusWeeks,
  formatCampusWeekDateRange,
  formatCampusWeekOptionLabel,
  parseWeekParam,
} from "@/lib/format/campus-week"
import { cn } from "@/lib/utils"

/** Full control width: two icon buttons plus a label of "Week 12 (current) · Aug 31–Sep 6". */
export const CAMPUS_WEEK_NAV_WIDTH_CLASS = "w-full sm:w-[26rem]"

export type CampusWeekNavProps = {
  weeks: number[]
  selectedWeek: number | null
  currentCampusWeek: number | null
  onWeekChange: (week: number) => void
  pending?: boolean
  className?: string
}

function WeekOptionLabel({
  week,
  currentCampusWeek,
  muteDates = false,
}: {
  week: number
  currentCampusWeek: number | null
  muteDates?: boolean
}) {
  const dates = formatCampusWeekDateRange(week)
  const hasDates = dates !== `Week ${week}`
  const isCurrent = week === currentCampusWeek

  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 font-medium">
        Week {week}
        {isCurrent ? " (current)" : ""}
      </span>
      {hasDates ? (
        <span className={cn("truncate", muteDates && "text-muted-foreground")}>{dates}</span>
      ) : null}
    </span>
  )
}

export function CampusWeekNav({
  weeks,
  selectedWeek,
  currentCampusWeek,
  onWeekChange,
  pending = false,
  className,
}: CampusWeekNavProps) {
  const orderedWeeks = useMemo(() => {
    const unique = new Set(weeks.filter((week) => week > 0))
    if (selectedWeek != null && selectedWeek > 0) unique.add(selectedWeek)
    return Array.from(unique).sort((a, b) => a - b)
  }, [weeks, selectedWeek])

  const { prevWeek, nextWeek } = adjacentCampusWeeks(orderedWeeks, selectedWeek)

  const changeWeek = (week: number) => {
    if (pending || week === selectedWeek) return
    onWeekChange(week)
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        CAMPUS_WEEK_NAV_WIDTH_CLASS,
        pending && "opacity-60",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 cursor-pointer"
        disabled={pending || prevWeek === null}
        onClick={() => prevWeek != null && changeWeek(prevWeek)}
        aria-label="Previous week"
      >
        <ChevronLeft className="size-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <Select
          value={selectedWeek != null ? String(selectedWeek) : undefined}
          onValueChange={(value) => changeWeek(Number(value))}
          disabled={pending || orderedWeeks.length === 0}
        >
          <SelectTrigger
            className="h-9 w-full min-w-0 cursor-pointer"
            aria-label={
              selectedWeek != null
                ? formatCampusWeekOptionLabel(selectedWeek, currentCampusWeek)
                : "Select week"
            }
          >
            {selectedWeek != null ? (
              <WeekOptionLabel week={selectedWeek} currentCampusWeek={currentCampusWeek} muteDates />
            ) : (
              <span className="text-muted-foreground">Select week</span>
            )}
          </SelectTrigger>
          <SelectContent>
            {orderedWeeks.map((week) => (
              <SelectItem
                key={week}
                value={String(week)}
                textValue={formatCampusWeekOptionLabel(week, currentCampusWeek)}
              >
                <WeekOptionLabel week={week} currentCampusWeek={currentCampusWeek} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 cursor-pointer"
        disabled={pending || nextWeek === null}
        onClick={() => nextWeek != null && changeWeek(nextWeek)}
        aria-label="Next week"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

export type CampusWeekUrlNavProps = Omit<CampusWeekNavProps, "onWeekChange" | "pending"> & {
  basePath: string
  /** Extra query params included on every week change (for example heat-map increment). */
  searchParams?: Record<string, string>
  /** Server-rendered `?week=` value, used before client search params hydrate. */
  weekParam?: string
}

export function CampusWeekUrlNav({
  basePath,
  searchParams: extraSearchParams,
  weekParam,
  selectedWeek,
  ...rest
}: CampusWeekUrlNavProps) {
  const router = useRouter()
  const urlSearchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const urlWeek = parseWeekParam(urlSearchParams.get("week") ?? weekParam ?? undefined)
  const resolvedSelectedWeek = urlWeek ?? selectedWeek ?? null

  return (
    <CampusWeekNav
      {...rest}
      selectedWeek={resolvedSelectedWeek}
      pending={isPending}
      onWeekChange={(week) => {
        const params = new URLSearchParams(extraSearchParams)
        params.set("week", String(week))
        const query = params.toString()
        startTransition(() => {
          router.push(query ? `${basePath}?${query}` : basePath)
        })
      }}
    />
  )
}
