"use client"

import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { YEAR_NOT_STARTED_COPY } from "@/components/dashboard/widgets/year-not-started-state"
import { useWeeklyMemoNav } from "./weekly-memo-nav-context"
import { CampusWeekUrlNav, CAMPUS_WEEK_NAV_WIDTH_CLASS } from "@/components/data-display/campus-week-nav"
import { WeeklyMemoExportButton } from "./weekly-memo-export-button"

type WeeklyMemoHeaderShellProps = {
  weekParam?: string
}

function WeeklyMemoHeaderShellContent({ weekParam }: WeeklyMemoHeaderShellProps) {
  const nav = useWeeklyMemoNav()

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly memo</h1>
        {nav.yearNotStarted ? (
          <p className="text-muted-foreground text-sm">{YEAR_NOT_STARTED_COPY}</p>
        ) : null}
      </div>
      {!nav.yearNotStarted && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <WeeklyMemoExportButton weekNumber={nav.weekNumber} available={nav.hydrated && nav.weekNumber !== null} />
          <CampusWeekUrlNav
            weekParam={weekParam}
            selectedWeek={nav.weekNumber}
            weeks={nav.availableWeeks}
            currentCampusWeek={nav.currentCampusWeek}
            basePath="/dashboard/memo"
          />
        </div>
      )}
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
          </div>
          <Skeleton className={`h-9 ${CAMPUS_WEEK_NAV_WIDTH_CLASS}`} />
        </div>
      }
    >
      <WeeklyMemoHeaderShellContent weekParam={weekParam} />
    </Suspense>
  )
}
