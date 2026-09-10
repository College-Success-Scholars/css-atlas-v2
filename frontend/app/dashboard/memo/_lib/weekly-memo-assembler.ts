import type { GradeBreakdown, GradeEntry } from "@/lib/types/form-log"
import type { MemoTutorReportRow } from "@/lib/types/tutor-report-log"
import type {
  FormStatus,
  MemoLivePageData,
  RecognitionBoardSectionData,
  TeamLeaderPerformanceRow,
  TutoringLogRow,
  WeeklyMemoViewData,
} from "../types"
import { classifyScholarFollowUpRisk } from "./risk-classifier"
import { scholarYearLabel } from "@/lib/format/time"

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

export const assembleWeeklyMemo = (data: MemoLivePageData): WeeklyMemoViewData => {
  const weekDates = formatWeekDateRange(data.weekLabel)
  const visitsLastWeek = data.trafficWeeklyData.find((entry) => entry.weekNumber === data.selectedWeekNumber - 1)?.entryCount ?? 0
  const visitsTrend = data.trafficEntryCountForSelectedWeek - visitsLastWeek

  const teamLeaderRows = buildTeamLeaderRows(data)
  const scholarRows = classifyScholarFollowUpRisk(data)
  const tutoringLog = buildTutoringLog(data.tutorReports)
  const emptySessionCount = tutoringLog.tabs.find((tab) => tab.id === "empty-sessions")?.rows.length ?? 0

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

  const averageScholarPct = (key: "fdPct" | "ssPct") => {
    const vals = data.scholars.map((row) => row[key]).filter((pct): pct is number => pct != null)
    if (vals.length === 0) return 0
    return Math.round(vals.reduce((acc, pct) => acc + pct, 0) / vals.length)
  }

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
        trendText: visitsLastWeek ? `${visitsTrend >= 0 ? "up" : "down"} vs last week` : "",
        subStats: [],
      },
      {
        title: "Front desk completion",
        primaryValue: `${averageScholarPct("fdPct")}%`,
        secondaryText: `${data.scholars.filter((row) => (row.fdRequired ?? 0) > 0).length} scholars`,
        trendText: "",
        subStats: [],
      },
      {
        title: "Study session completion",
        primaryValue: `${averageScholarPct("ssPct")}%`,
        secondaryText: `${data.scholars.filter((row) => (row.ssRequired ?? 0) > 0).length} scholars`,
        trendText: "",
        subStats: [],
      },
      {
        title: "Tutoring sessions held",
        primaryValue: String(data.tutorReports.length),
        secondaryText: `${emptySessionCount} empty session${emptySessionCount === 1 ? "" : "s"}`,
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
