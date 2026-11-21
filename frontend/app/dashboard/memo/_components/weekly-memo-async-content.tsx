import { FullAttendanceDetailSection } from "./full-attendance-detail-section"
import { RecognitionBoardSection } from "./recognition-board-section"
import { ScholarFollowUpTable } from "./scholar-follow-up-table"
import { TeamLeaderPerformanceTable } from "./team-leader-performance-table"
import { TutoringLogSection } from "./tutoring-log-section"
import { WeeklyKpiCards } from "./weekly-kpi-cards"
import { WeeklyMemoNavSync } from "./weekly-memo-nav-context"
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state"
import { getWeeklyMemo } from "@/lib/server/data"
import { parseWeekParam } from "@/lib/format/campus-week"

type WeeklyMemoAsyncContentProps = {
  weekParam?: string
}

export async function WeeklyMemoAsyncContent({ weekParam }: WeeklyMemoAsyncContentProps) {
  const data = await getWeeklyMemo(parseWeekParam(weekParam) ?? undefined)

  if (data.yearNotStarted) {
    return (
      <>
        <WeeklyMemoNavSync
          weekStartLabel={null}
          weekEndLabel={null}
          weekNumber={null}
          availableWeeks={[]}
          prevWeek={null}
          nextWeek={null}
          currentCampusWeek={null}
          yearNotStarted
        />
        <YearNotStartedState variant="full" />
      </>
    )
  }

  return (
    <>
      <WeeklyMemoNavSync
        weekStartLabel={data.weekStartLabel}
        weekEndLabel={data.weekEndLabel}
        weekNumber={data.weekNumber}
        availableWeeks={data.navigation.availableWeeks}
        prevWeek={data.navigation.prevWeek}
        nextWeek={data.navigation.nextWeek}
        currentCampusWeek={data.navigation.currentCampusWeek}
        yearNotStarted={false}
      />
      <WeeklyKpiCards cards={data.kpis} />
      <TeamLeaderPerformanceTable rows={data.teamLeaderRows} />
      <ScholarFollowUpTable rows={data.scholarRows} />
      <TutoringLogSection data={data.tutoringLog} />
      <RecognitionBoardSection data={data.recognitionBoard} />
      <FullAttendanceDetailSection data={data.fullAttendanceDetail} />
    </>
  )
}
