import type { GradeEntry } from "@/lib/types/form-log"
import { EASTERN_TIMEZONE, scholarYearLabel } from "@/lib/format/time"
import type { MemoLivePageData, MemoScholarRow, ScholarFollowUpIssue, ScholarFollowUpRow } from "../types"

const LOW_COMPLETION_THRESHOLD = 75

const toScholarYear = (cohort: number | null) => scholarYearLabel(cohort) ?? "—"

const gradeGlanceLabel = (entry: GradeEntry) => {
  const title = [entry.course, entry.assessment].filter(Boolean).join(" · ")
  return title || "Grade"
}

const gradePct = (entry: GradeEntry) =>
  Number.isFinite(entry.percent) ? Math.round(entry.percent) : entry.percent

const formatWahfSubmittedAt = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

const wahfSubmittedAtLabel = (submittedAt: string | null) => {
  if (!submittedAt) return null
  return formatWahfSubmittedAt(submittedAt)
}

/**
 * Future work: expand follow-up Issues to **streaks** of missing WAHF or low
 * hours across recent campus weeks, so recurring offenders stand out from a
 * one-week miss. Streaks are out of scope here — see GitHub issue #64.
 */
const buildScholarFollowUpIssues = (
  row: MemoScholarRow,
  lowGrades: GradeEntry[]
): { flags: string[]; issues: ScholarFollowUpIssue[] } => {
  const flags: string[] = []
  const issues: ScholarFollowUpIssue[] = []
  const frontDeskPct = Math.max(0, Math.round(row.fdPct ?? 0))
  const studySessionPct = Math.max(0, Math.round(row.ssPct ?? 0))

  if ((row.fdPct ?? 0) < LOW_COMPLETION_THRESHOLD) {
    flags.push("Low front desk completion")
    issues.push({
      kind: "front-desk",
      glance: "Front desk",
      pct: frontDeskPct,
      requiredMinutes: row.fdRequired,
      insideMinutes: row.fdCompliance?.insideMinutes ?? 0,
      outsideMinutes: row.fdCompliance?.outsideMinutes ?? 0,
    })
  }
  if ((row.ssPct ?? 0) < LOW_COMPLETION_THRESHOLD) {
    flags.push("Low study session completion")
    issues.push({
      kind: "study-session",
      glance: "Study session",
      pct: studySessionPct,
      requiredMinutes: row.ssRequired,
      insideMinutes: row.ssCompliance?.insideMinutes ?? 0,
      outsideMinutes: row.ssCompliance?.outsideMinutes ?? 0,
    })
  }

  const scholarLowGrades = lowGrades.filter((grade) => grade.scholarName === row.scholarName)
  if (scholarLowGrades.length > 0) {
    flags.push("Low grade")
    for (const grade of scholarLowGrades) {
      issues.push({ kind: "grade", glance: gradeGlanceLabel(grade), pct: gradePct(grade) })
    }
  }

  if (row.wahfStatus === "missing") {
    flags.push("Missing WAHF")
    issues.push({
      kind: "wahf",
      glance: "WAHF",
      status: "missing",
      submittedAtLabel: wahfSubmittedAtLabel(row.wahfSubmittedAt),
    })
  } else if (row.wahfStatus === "late") {
    flags.push("Late WAHF")
    issues.push({
      kind: "wahf",
      glance: "WAHF",
      status: "late",
      submittedAtLabel: wahfSubmittedAtLabel(row.wahfSubmittedAt),
    })
  }

  return { flags, issues }
}

export const classifyScholarFollowUpRisk = (data: MemoLivePageData): ScholarFollowUpRow[] => {
  const rows = data.scholars
    .map((row) => {
      const { flags, issues } = buildScholarFollowUpIssues(row, data.gradeBreakdown.low)

      return {
        scholarName: row.scholarName,
        scholarYear: toScholarYear(row.cohort),
        teamLeader: row.teamLeader?.trim() || "Unassigned",
        flags,
        issues,
        frontDeskPct: Math.max(0, Math.round(row.fdPct ?? 0)),
        studySessionPct: Math.max(0, Math.round(row.ssPct ?? 0)),
        fdRequired: row.fdRequired,
        ssRequired: row.ssRequired,
      }
    })
    .filter((row) => row.issues.length > 0)

  return rows.sort((a, b) => (a.frontDeskPct + a.studySessionPct) - (b.frontDeskPct + b.studySessionPct))
}
