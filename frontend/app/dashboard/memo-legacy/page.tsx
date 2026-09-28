import { redirect } from "next/navigation"
import { canAccessWeeklyMemo } from "@/lib/auth"
import { backendGet } from "@/lib/server/api-client"
import { getCurrentProfile } from "@/lib/server/queries"
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state"
import { FullAttendanceDetailSection } from "../memo/_components/full-attendance-detail-section"
import { RecognitionBoardSection } from "../memo/_components/recognition-board-section"
import { ScholarFollowUpTable } from "../memo/_components/scholar-follow-up-table"
import { TeamLeaderPerformanceTable } from "../memo/_components/team-leader-performance-table"
import { TutoringLogSection } from "../memo/_components/tutoring-log-section"
import { WeeklyKpiCards } from "../memo/_components/weekly-kpi-cards"
import { WeeklyMemoHeader } from "../memo/_components/weekly-memo-header"
import { assembleWeeklyMemo } from "../memo/_lib/weekly-memo-assembler"
import { computeWeekNavigation } from "../memo/_lib/week-navigation"
import { isMemoYearNotStarted, type MemoPageData } from "../memo/types"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ week?: string }>
}

export default async function DashboardMemoPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile()
  if (!canAccessWeeklyMemo(profile)) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const weekParam = params.week

  const query = weekParam ? `?weekNumber=${weekParam}` : ""
  const memoData = await backendGet<MemoPageData>(`/api/memo/page-data${query}`)

  if (isMemoYearNotStarted(memoData)) {
    return (
      <main className="space-y-4 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Weekly memo</h1>
        </div>
        <YearNotStartedState variant="full" />
      </main>
    )
  }

  const data = assembleWeeklyMemo(memoData)

  const navigation = computeWeekNavigation({
    trafficWeeklyData: memoData.trafficWeeklyData,
    selectedWeekNumber: memoData.selectedWeekNumber,
    currentCampusWeek: memoData.currentCampusWeek,
  })

  return (
    <main className="space-y-4 pb-4">
      <WeeklyMemoHeader
        weekNumber={data.weekNumber}
        availableWeeks={navigation.availableWeeks}
        currentCampusWeek={memoData.currentCampusWeek}
        basePath="/dashboard/memo-legacy"
      />
      <WeeklyKpiCards cards={data.kpis} />
      <TeamLeaderPerformanceTable rows={data.teamLeaderRows} />
      <ScholarFollowUpTable rows={data.scholarRows} />
      <TutoringLogSection data={data.tutoringLog} />
      <RecognitionBoardSection data={data.recognitionBoard} />
      <FullAttendanceDetailSection data={data.fullAttendanceDetail} />
    </main>
  )
}
