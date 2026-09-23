import type { GradeBreakdown, GradeEntry } from "@/lib/types/form-log"
import type { MemoTutorReportRow } from "@/lib/types/tutor-report-log"
import type {
  FormStatus,
  MemoLivePageData,
  MemoScholarRow,
  RecognitionBoardSectionData,
  TeamLeaderPerformanceRow,
  TutoringLogRow,
  WeeklyKpiCard,
  WeeklyMemoViewData,
} from "../types"
import { classifyScholarFollowUpRisk } from "./risk-classifier"
import {
  EASTERN_TIMEZONE,
  freshmanCohortYear,
  scholarYearGroupLabel,
  scholarYearLabel,
  sophomoreCohortYear,
} from "@/lib/format/time"

/** Matches backend WEEKLY_MEMO_SNAPSHOT_COMPLETE_PERCENT in weekly-memo-report.service.ts */
const SNAPSHOT_COMPLETE_PERCENT = 80

const getFormStatus = (completed: number, required: number, late: boolean): FormStatus => {
  if (required <= 0 || completed >= required) return late ? "late" : "on-time"
  return completed > 0 ? "late" : "missing"
}

/** MCF is one form per mentee. Some-but-not-all is incomplete, not late. */
function getMcfStatus(completed: number, required: number, late: boolean): FormStatus {
  if (required <= 0) return "on-time"
  if (completed <= 0) return "missing"
  if (completed < required) return "incomplete"
  return late ? "late" : "on-time"
}

const hasNoMenteeAssignment = (mcfRequired: number): boolean => mcfRequired <= 0

const formatWeekDateRange = (weekLabel: string) => {
  const [start, end] = weekLabel.split("-").map((part) => part.trim())
  return {
    weekStartLabel: start || weekLabel,
    weekEndLabel: end || weekLabel,
  }
}

const buildTeamLeaderRows = (data: MemoLivePageData): TeamLeaderPerformanceRow[] =>
  data.teamLeaderFormStats.map((row) => {
    const hasNoMentee = hasNoMenteeAssignment(row.mcfRequired)
    return {
      leaderName: row.name,
      mcf: hasNoMentee ? "on-time" : getMcfStatus(row.mcfCompleted, row.mcfRequired, row.mcfLate),
      wpl: getFormStatus(row.wplCompleted, row.wplRequired, row.wplLate),
      wahf: getFormStatus(row.wahfCompleted, row.wahfRequired, row.wahfLate),
      menteesOk: row.wahfPct >= 90 && row.wplPct >= 90 && row.mcfPct >= 90 ? ("yes" as const) : ("check" as const),
      hasNoMentee,
    }
  })

const mapTutoringLogRow = (report: MemoTutorReportRow): TutoringLogRow => ({
  id: report.id,
  scholarName: report.scholarName,
  dayOfWeek: report.dayOfWeek,
  tutorName: report.tutorName,
  courses: report.courses,
  startTime: report.startTime,
  endTime: report.endTime,
})

const RECOGNITION_BANDS = [
  { id: "high" as const, label: "90 – 100%", key: "high" as const },
  { id: "mid" as const, label: "70 – 89%", key: "mid" as const },
  { id: "low" as const, label: "Below 70%", key: "low" as const },
]

const byGradePercentDesc = (left: GradeEntry, right: GradeEntry) => {
  if (left.percent !== right.percent) return right.percent - left.percent
  const byName = left.scholarName.localeCompare(right.scholarName)
  if (byName !== 0) return byName
  return left.course.localeCompare(right.course)
}

const buildRecognitionBoard = (breakdown: GradeBreakdown): RecognitionBoardSectionData => {
  const bands = RECOGNITION_BANDS.map((band) => ({
    id: band.id,
    label: band.label,
    entries: [...breakdown[band.key]].sort(byGradePercentDesc),
  }))
  const total = bands.reduce((sum, band) => sum + band.entries.length, 0)
  return {
    badgeText: `${total} grade${total === 1 ? "" : "s"}`,
    rightLabel: "90–100% · 70–89% · Below 70%",
    bands,
  }
}

const buildTutoringLog = (tutorReports: MemoTutorReportRow[]) => {
  const sessions = tutorReports
    .filter((report) => report.scholarName !== "EMPTY SESSION")
    .map(mapTutoringLogRow)
  const emptySessions = tutorReports
    .filter((report) => report.scholarName === "EMPTY SESSION")
    .map(mapTutoringLogRow)

  return {
    badgeText: `${sessions.length} session${sessions.length === 1 ? "" : "s"}`,
    rightLabel: "Sessions · Empty sessions",
    tabs: [
      { id: "sessions" as const, label: "Sessions", rows: sessions },
      { id: "empty-sessions" as const, label: "Empty sessions", rows: emptySessions },
    ],
  }
}

function hoursCompletionPercent(completedMinutes: number, requiredMinutes: number): number {
  return Math.max(0, Math.min(100, Math.round((completedMinutes / requiredMinutes) * 100)))
}

function scholarHoursComplete(
  scholar: MemoScholarRow,
  totalKey: "fdTotal" | "ssTotal",
  excuseKey: "fdExcuseMin" | "ssExcuseMin",
  requiredKey: "fdRequired" | "ssRequired",
): boolean {
  const requiredMinutes = scholar[requiredKey]
  if (requiredMinutes == null || requiredMinutes <= 0) return false
  const completedMinutes = scholar[totalKey] + scholar[excuseKey]
  return hoursCompletionPercent(completedMinutes, requiredMinutes) >= SNAPSHOT_COMPLETE_PERCENT
}

/** Print snapshot hours: complete at 80%+, Sophomores then Freshmen, denominator is the class-year roster. */
function snapshotHoursOverview(
  scholars: MemoScholarRow[],
  totalKey: "fdTotal" | "ssTotal",
  excuseKey: "fdExcuseMin" | "ssExcuseMin",
  requiredKey: "fdRequired" | "ssRequired",
): Array<{ label: string; completed: number; total: number }> {
  return [sophomoreCohortYear(), freshmanCohortYear()].map((cohort) => {
    const inCohort = scholars.filter((scholar) => scholar.cohort === cohort)
    const completed = inCohort.filter((scholar) =>
      scholarHoursComplete(scholar, totalKey, excuseKey, requiredKey)
    ).length
    return {
      label: scholarYearGroupLabel(cohort) ?? `Cohort ${cohort}`,
      completed,
      total: inCohort.length,
    }
  })
}

function ratioPct(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100)
}

function hoursKpiCard(
  title: string,
  overview: Array<{ label: string; completed: number; total: number }>,
): WeeklyKpiCard {
  const completed = overview.reduce((sum, row) => sum + row.completed, 0)
  const total = overview.reduce((sum, row) => sum + row.total, 0)
  return {
    title,
    primaryValue: `${completed} / ${total}`,
    secondaryText: `${SNAPSHOT_COMPLETE_PERCENT}% or more`,
    trendText: "",
    pct: ratioPct(completed, total),
    subStats: overview.map((row) => {
      const pct = ratioPct(row.completed, row.total)
      return { label: row.label, value: `${row.completed} / ${row.total} (${pct}%)`, pct }
    }),
  }
}

function visitsTrendText(
  thisWeekCount: number,
  lastComparableCount: number,
  selectedWeek: number,
  currentCampusWeek: number | null,
): string {
  if (selectedWeek <= 1) return ""
  if (thisWeekCount === 0 && lastComparableCount === 0) return ""
  const direction = thisWeekCount >= lastComparableCount ? "up" : "down"
  if (selectedWeek === currentCampusWeek) {
    const weekday = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: EASTERN_TIMEZONE,
    })
    return `${direction} vs last ${weekday}`
  }
  return `${direction} vs last week`
}

export const assembleWeeklyMemo = (data: MemoLivePageData): WeeklyMemoViewData => {
  const weekDates = formatWeekDateRange(data.weekLabel)

  const teamLeaderRows = buildTeamLeaderRows(data)
  const scholarRows = classifyScholarFollowUpRisk(data)
  const tutoringLog = buildTutoringLog(data.tutorReports)
  const noShowCount = tutoringLog.tabs.find((tab) => tab.id === "empty-sessions")?.rows.length ?? 0
  const sessionsLogged = data.tutorReports.length - noShowCount

  const makeAttendanceRows = (
    totalKey: "fdTotal" | "ssTotal",
    excuseKey: "fdExcuseMin" | "ssExcuseMin",
    requiredKey: "fdRequired" | "ssRequired"
  ) =>
    data.scholars
      .filter((scholar) => (scholar[requiredKey] ?? 0) > 0)
      .map((scholar) => {
        const logged = scholar[totalKey]
        const excuseMinutes = scholar[excuseKey]
        const requiredMinutes = scholar[requiredKey] ?? 0
        const completedMinutes = logged + excuseMinutes
        const completionPct =
          requiredMinutes > 0 ? Math.round((completedMinutes / requiredMinutes) * 100) : 0
        return {
          scholarName: scholar.scholarName,
          scholarYear: scholarYearLabel(scholar.cohort) ?? "—",
          completedMinutes,
          excuseMinutes,
          requiredMinutes,
          completionPct: Math.max(0, Math.min(100, completionPct)),
        }
      })

  return {
    ...data,
    weekStartLabel: weekDates.weekStartLabel,
    weekEndLabel: weekDates.weekEndLabel,
    weekNumber: data.selectedWeekNumber,
    kpis: [
      {
        title: "Visits this week",
        primaryValue: String(data.trafficEntryCountForSelectedWeek),
        secondaryText: `${data.trafficSessions.length} traffic sessions`,
        trendText: visitsTrendText(
          data.trafficEntryCountForSelectedWeek,
          data.trafficComparableLastWeekCount,
          data.selectedWeekNumber,
          data.currentCampusWeek,
        ),
        subStats: [],
      },
      hoursKpiCard(
        "Front desk hours",
        snapshotHoursOverview(data.scholars, "fdTotal", "fdExcuseMin", "fdRequired"),
      ),
      hoursKpiCard(
        "Study session hours",
        snapshotHoursOverview(data.scholars, "ssTotal", "ssExcuseMin", "ssRequired"),
      ),
      {
        title: "Tutoring sessions",
        primaryValue: String(sessionsLogged),
        secondaryText: `${noShowCount} no-show${noShowCount === 1 ? "" : "s"}`,
        trendText: "",
        subStats: [],
      },
    ],
    teamLeaderRows,
    scholarRows,
    tutoringLog,
    recognitionBoard: buildRecognitionBoard(data.gradeBreakdown),
    fullAttendanceDetail: {
      rightLabel: "Front desk · Study sessions · WAHF",
      wahfCensus: {
        onTime: data.scholars.filter((row) => row.wahfStatus === "on-time").length,
        late: data.scholars.filter((row) => row.wahfStatus === "late").length,
        missing: data.scholars.filter((row) => row.wahfStatus === "missing").length,
      },
      tabs: [
        { id: "front-desk", label: "Front desk", rows: makeAttendanceRows("fdTotal", "fdExcuseMin", "fdRequired") },
        { id: "study-sessions", label: "Study sessions", rows: makeAttendanceRows("ssTotal", "ssExcuseMin", "ssRequired") },
      ],
    },
  }
}
