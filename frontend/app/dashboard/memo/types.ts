import type { ScholarWithCompletedSession } from "@/lib/types/session-log"
import type { TrafficSession } from "@/lib/types/traffic"
import type { FormCompletionOverall } from "@/components/data-display/form-completion-overview-card"
import type { MemoTutorReportRow } from "@/lib/types/tutor-report-log"
import type { GradeBreakdown, GradeEntry, TeamLeaderFormStatsRow } from "@/lib/types/form-log"
import type { ShiftComplianceByKind } from "@/lib/types/supabase"

export type ScholarWahfStatus = "on-time" | "late" | "missing"

export type MemoScholarRow = {
  scholarId: string
  scholarName: string
  cohort: number | null
  /** Display name from mentor_mentee, or "Unassigned". */
  teamLeader: string
  fdTotal: number
  ssTotal: number
  fdRequired: number | null
  ssRequired: number | null
  fdExcuseMin: number
  ssExcuseMin: number
  fdPct: number | null
  ssPct: number | null
  wahfStatus: ScholarWahfStatus
  wahfSubmittedAt: string | null
  fdCompliance: ShiftComplianceByKind
  ssCompliance: ShiftComplianceByKind
}

export type MemoTLRow = {
  scholarId: string
  name: string
  mcfCompleted: number
  mcfRequired: number
  mcfLate: boolean
  mcfPct: number | null
  mcfLatestAt: string | null
}

export type MemoPieData = {
  cohort2024: {
    total: number
    fdCompleteCount: number
    ssCompleteCount: number
    fdPercent: number
    ssPercent: number
  }
  cohort2025: {
    total: number
    fdCompleteCount: number
    ssCompleteCount: number
    fdPercent: number
    ssPercent: number
  }
}

/** Default memo view when `dateToCampusWeek(now)` is null (before Fall start). */
export type MemoYearNotStartedData = {
  yearNotStarted: true
  currentCampusWeek: null
}

export type MemoLivePageData = {
  yearNotStarted?: false
  scholars: MemoScholarRow[]
  teamLeaders: MemoTLRow[]
  pieData: MemoPieData
  formCompletionOverall: FormCompletionOverall
  completedStudy: ScholarWithCompletedSession[]
  completedFd: ScholarWithCompletedSession[]
  trafficWeeklyData: { weekNumber: number; entryCount: number }[]
  trafficEntryCountForSelectedWeek: number
  trafficSessions: TrafficSession[]
  tutorReports: MemoTutorReportRow[]
  gradeBreakdown: GradeBreakdown
  wahfDonut: {
    total: number
    completeCount: number
    lateCount: number
    percentComplete: number
  }
  teamLeaderFormStats: TeamLeaderFormStatsRow[]
  weekLabel: string
  currentCampusWeek: number | null
  selectedWeekNumber: number
}

export type MemoPageData = MemoYearNotStartedData | MemoLivePageData

export function isMemoYearNotStarted(
  data: MemoPageData,
): data is MemoYearNotStartedData {
  return "yearNotStarted" in data && data.yearNotStarted === true
}

export type FormStatus = "submitted" | "on-time" | "missing" | "late" | "incomplete" | "check-mentees"

export type WeeklyKpiCard = {
  title: string
  primaryValue: string
  secondaryText: string
  trendText: string
  subStats: { label: string; value: string }[]
}

export type TeamLeaderPerformanceRow = {
  leaderName: string
  mcf: FormStatus
  wpl: FormStatus
  wahf: FormStatus
  menteesOk: "yes" | "check"
  /** True when roster mentee_count is ≤ 0 (including the -1 no-relationship sentinel). */
  hasNoMentee: boolean
}

export type ScholarFollowUpIssueKind = "front-desk" | "study-session" | "grade" | "wahf"

/** Hours issue: glance is the area name; detail is a completion meter. */
export type ScholarFollowUpHoursIssue = {
  kind: "front-desk" | "study-session"
  glance: string
  pct: number
  requiredMinutes: number | null
  insideMinutes: number
  outsideMinutes: number
}

/** Grade issue: glance is the assignment title; detail is the percent. */
export type ScholarFollowUpGradeIssue = {
  kind: "grade"
  glance: string
  pct: number
}

/** WAHF issue: glance is "WAHF"; detail is submitted-at or an empty time state. */
export type ScholarFollowUpWahfIssue = {
  kind: "wahf"
  glance: string
  status: "late" | "missing"
  submittedAtLabel: string | null
}

/** One concerning follow-up stat (healthy hours are omitted). */
export type ScholarFollowUpIssue =
  | ScholarFollowUpHoursIssue
  | ScholarFollowUpGradeIssue
  | ScholarFollowUpWahfIssue

export type ScholarFollowUpRow = {
  scholarName: string
  scholarYear: string
  teamLeader: string
  flags: string[]
  issues: ScholarFollowUpIssue[]
  frontDeskPct: number
  studySessionPct: number
  fdRequired: number | null
  ssRequired: number | null
}

export type RecognitionBoardBandId = "high" | "mid" | "low"

export type RecognitionBoardBand = {
  id: RecognitionBoardBandId
  label: string
  entries: GradeEntry[]
}

export type RecognitionBoardSectionData = {
  badgeText: string
  rightLabel: string
  bands: RecognitionBoardBand[]
}

export type AttendanceDetailRow = {
  scholarName: string
  scholarYear: string
  completedMinutes: number
  excuseMinutes: number
  requiredMinutes: number
  completionPct: number
}

export type FullAttendanceDetailTab = {
  id: "front-desk" | "study-sessions"
  label: string
  rows: AttendanceDetailRow[]
}

export type FullAttendanceDetailSectionData = {
  rightLabel: string
  wahfCensus: WahfCensusSummary
  tabs: FullAttendanceDetailTab[]
}

export type WahfCensusSummary = {
  onTime: number
  late: number
  missing: number
}

export type TutoringLogRow = {
  id: number
  scholarName: string
  dayOfWeek: string
  tutorName: string
  courses: string[]
  startTime: string
  endTime: string
}

export type TutoringLogTab = {
  id: "sessions" | "empty-sessions"
  label: string
  rows: TutoringLogRow[]
}

export type TutoringLogSectionData = {
  badgeText: string
  rightLabel: string
  tabs: TutoringLogTab[]
}

export type WeeklyMemoViewData = MemoLivePageData & {
  weekStartLabel: string
  weekEndLabel: string
  weekNumber: number
  kpis: WeeklyKpiCard[]
  teamLeaderRows: TeamLeaderPerformanceRow[]
  scholarRows: ScholarFollowUpRow[]
  tutoringLog: TutoringLogSectionData
  recognitionBoard: RecognitionBoardSectionData
  fullAttendanceDetail: FullAttendanceDetailSectionData
}
