import { Suspense } from "react"

import { CampusWeekUrlNav, CAMPUS_WEEK_NAV_WIDTH_CLASS } from "@/components/data-display/campus-week-nav"
import { Skeleton } from "@/components/ui/skeleton"

type WeeklyMemoHeaderProps = {
  weekNumber: number
  availableWeeks: number[]
  currentCampusWeek: number | null
  basePath?: string
}

export function WeeklyMemoHeader({
  weekNumber,
  availableWeeks,
  currentCampusWeek,
  basePath = "/dashboard/memo",
}: WeeklyMemoHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly memo</h1>
      </div>
      <Suspense fallback={<Skeleton className={`h-9 ${CAMPUS_WEEK_NAV_WIDTH_CLASS}`} />}>
        <CampusWeekUrlNav
          selectedWeek={weekNumber}
          weeks={availableWeeks}
          currentCampusWeek={currentCampusWeek}
          basePath={basePath}
        />
      </Suspense>
    </div>
  )
}
