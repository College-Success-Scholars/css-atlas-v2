import type { ActivityFormType, RecentFormSubmission } from "@css-atlas/shared/contracts/form-logs"

export const formTone: Record<ActivityFormType, string> = {
  WAHF: "text-info-muted-foreground bg-info-muted",
  WPL: "text-success-muted-foreground bg-success-muted",
  MCF: "text-warning-muted-foreground bg-warning-muted",
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0
  return false
}

function normalizeYesNo(value: string | null | undefined): "yes" | "no" | null {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (normalized === "yes") return "yes"
  if (normalized === "no") return "no"
  return null
}

function countAssignmentGrades(value: unknown): number {
  if (isEmptyValue(value)) return 0
  if (Array.isArray(value)) return value.reduce((acc, item) => acc + countAssignmentGrades(item), 0)
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => !isEmptyValue(v))
    if (entries.length === 0) return 0
    const hasNestedObjects = entries.some(([, v]) => typeof v === "object" && v !== null)
    if (!hasNestedObjects) return entries.length
    return entries.reduce((acc, [, v]) => acc + countAssignmentGrades(v), 0)
  }
  return 1
}

function countProjects(value: unknown): number {
  if (isEmptyValue(value)) return 0
  if (Array.isArray(value)) return value.length
  return 1
}

export function buildActivitySummary(entry: RecentFormSubmission): string {
  if (entry.formType === "WPL") {
    const hours = entry.hours_worked ?? 0
    const projects = countProjects(entry.projects)
    const metWithAll = normalizeYesNo(entry.met_with_all)
    const menteeText =
      metWithAll === "yes"
        ? "Met with all mentee"
        : metWithAll === "no"
          ? "Did not meet with all mentee"
          : "Mentee meeting status unknown"
    return `${hours} hrs · ${projects} projects · ${menteeText}`
  }

  if (entry.formType === "MCF") {
    const mentee = entry.mentee_name?.trim() || "Unknown mentee"
    const metInPerson = normalizeYesNo(entry.met_in_person)
    const meetText =
      metInPerson === "yes"
        ? "Met in person"
        : metInPerson === "no"
          ? "Did not Meet"
          : "Meeting status unknown"
    const needsTutor = normalizeYesNo(entry.needs_tutor)
    const tutorText =
      needsTutor === "yes"
        ? "Tutor needed"
        : needsTutor === "no"
          ? "No tutor needed"
          : "Tutor status unknown"
    return `${mentee}: ${meetText} · ${tutorText}`
  }

  const assignmentsCount = countAssignmentGrades(entry.assignment_grades)
  const assignmentsText =
    assignmentsCount > 0 ? `${assignmentsCount} assignments graded` : "No assignments"
  const missedClassesText =
    normalizeYesNo(entry.missed_classes) === "yes" ? "Missed class(es)" : "No missed classes"
  const courseChangesText =
    normalizeYesNo(entry.course_changes) === "yes" ? "Course changes reported" : "No course changes"
  return `${assignmentsText} · ${missedClassesText} · ${courseChangesText}`
}
