"use client"

import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { YEAR_NOT_STARTED_COPY } from "@/components/dashboard/widgets/year-not-started-state"
import { useWeeklyMemoNav } from "./weekly-memo-nav-context"
import { WeeklyMemoExportButton } from "./weekly-memo-export-button"
import { WeeklyMemoWeekNav } from "./weekly-memo-week-nav"

type WeeklyMemoHeaderShellProps = {
  weekParam?: string
}

function WeeklyMemoHeaderShellContent({ weekParam }: WeeklyMemoHeaderShellProps) {
  const nav = useWeeklyMemoNav()
  const hasDates = nav.weekStartLabel != null && nav.weekEndLabel != null

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly memo</h1>
        {nav.yearNotStarted ? (
          <p className="text-muted-foreground text-sm">{YEAR_NOT_STARTED_COPY}</p>
        ) : hasDates ? (
            <p className="text-muted-foreground text-sm">
              {nav.weekStartLabel} - {nav.weekEndLabel}
            </p> 
        ) : (
          <Skeleton className="mt-1 h-5 w-48" />
        )}
      </div>
      {!nav.yearNotStarted && <div className="flex flex-wrap items-center justify-end gap-2">
        <WeeklyMemoExportButton weekNumber={nav.weekNumber} available={nav.hydrated && nav.weekNumber !== null} />
        <WeeklyMemoWeekNav
          weekParam={weekParam}
          selectedWeek={nav.weekNumber}
          availableWeeks={nav.availableWeeks}
          prevWeek={nav.prevWeek}
          nextWeek={nav.nextWeek}
          currentCampusWeek={nav.currentCampusWeek}
        />
      </div>}
    </div>
  )
}

export function WeeklyMemoHeaderShell({ weekParam }: WeeklyMemoHeaderShellProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Weekly memo</h1>
            <Skeleton className="mt-1 h-5 w-48" />
          </div>
          <Skeleton className="h-9 w-[calc(5rem+190px)]" />
        </div>
      }
    >
      <WeeklyMemoHeaderShellContent weekParam={weekParam} />
    </Suspense>
  )
}
