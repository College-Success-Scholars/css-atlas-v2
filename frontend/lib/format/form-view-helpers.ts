/**
 * @file form-view-helpers.ts
 * @module frontend/lib/format
 *
 * Display formatting and parsing utilities for form log UI components.
 * Used in the personal activity modal, submission details modal, and any
 * component that renders MCF/WHAF/WPL form log data to the user.
 *
 * ## Responsibilities
 * - isEmptyValue(value): check if a form field value is blank/empty
 * - Label and status formatting for form log display fields
 * - Any shared UI helpers for form log rendering
 *
 * ## What belongs here
 * - Pure formatting/display functions for form log data
 *
 * ## What does NOT belong here
 * - Form log data fetching
 * - Deadline calculation (use @css-atlas/shared/form-status)
 * - Business logic
 */

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0
  return false
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value.trim() || "—"
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try { return JSON.stringify(value) } catch { return "—" }
}

export function getObjectValueByKeyPattern(obj: Record<string, unknown>, patterns: RegExp[]): unknown {
  const key = Object.keys(obj).find((k) => patterns.some((p) => p.test(k)))
  return key ? obj[key] : undefined
}

export function formatProjectItem(item: unknown): string {
  if (item === null || item === undefined) return ""
  if (typeof item === "string") return item.trim()
  if (typeof item !== "object") return String(item)
  const obj = item as Record<string, unknown>
  const projectName = getObjectValueByKeyPattern(obj, [/project/i, /task/i, /activity/i, /work/i, /time.*did/i, /what/i, /name/i])
  const hoursValue = getObjectValueByKeyPattern(obj, [/hours?/i, /^hrs?$/i, /duration/i, /time/i])
  const projectLabel = formatValue(projectName).replace(/^—$/, "").trim()
  const hoursLabel = formatValue(hoursValue).replace(/^—$/, "").trim()
  if (projectLabel && hoursLabel) return `${projectLabel}: ${hoursLabel}`
  if (projectLabel) return projectLabel
  if (hoursLabel) return hoursLabel
  return Object.entries(obj).filter(([, v]) => !isEmptyValue(v)).map(([k, v]) => `${k}: ${formatValue(v)}`).join(" | ")
}

export type WplProjectRow = { name: string; hours: string }

function formatHoursLabel(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  if (/\b(hr|hrs|hour|hours)\b/i.test(t)) return t
  const num = Number.parseFloat(t.replace(/,/g, ""))
  if (!Number.isNaN(num)) return `${num} ${num === 1 ? "hr" : "hrs"}`
  return t
}

export function parseWplProjectRows(projects: unknown): WplProjectRow[] {
  if (!Array.isArray(projects) || projects.length === 0) return []
  const rows: WplProjectRow[] = []
  for (const item of projects) {
    if (item === null || item === undefined) continue
    if (typeof item === "string") { const s = item.trim(); if (s) rows.push({ name: s, hours: "" }); continue }
    if (typeof item !== "object") { rows.push({ name: String(item), hours: "" }); continue }
    const obj = item as Record<string, unknown>
    const projectName = getObjectValueByKeyPattern(obj, [/project/i, /task/i, /activity/i, /work/i, /time.*did/i, /what/i, /name/i])
    const hoursValue = getObjectValueByKeyPattern(obj, [/hours?/i, /^hrs?$/i, /duration/i, /time/i])
    const name = formatValue(projectName).replace(/^—$/, "").trim()
    const hoursRaw = formatValue(hoursValue).replace(/^—$/, "").trim()
    let hours = formatHoursLabel(hoursRaw)
    if (!name && !hours) {
      const fallback = Object.entries(obj).filter(([, v]) => !isEmptyValue(v)).map(([k, v]) => `${k}: ${formatValue(v)}`).join(" | ")
      if (fallback) rows.push({ name: fallback, hours: "" })
      continue
    }
    if (hoursRaw && !hours) hours = hoursRaw
    rows.push({ name: name || "—", hours })
  }
  return rows
}

export function parseNumericGrade(grade: string): number | null {
  const m = grade.trim().match(/(\d+(?:\.\d+)?)/)
  return m ? (Number.isFinite(Number.parseFloat(m[1]!)) ? Number.parseFloat(m[1]!) : null) : null
}

export function gradeScoreClass(score: number | null): string {
  if (score === null) return "text-foreground"
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 70) return "text-amber-700 dark:text-amber-500"
  return "text-red-600 dark:text-red-400"
}

export function missedFieldDisplay(value: string | null | undefined): string {
  return (value?.trim().toLowerCase() ?? "") === "yes" ? "Yes" : "None"
}

export function formatMeetingTime12Hour(value: string | null | undefined): string {
  const raw = value?.trim()
  if (!raw) return "—"
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match) {
    const hours = Number(match[1])
    if (hours >= 0 && hours <= 23) return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`
  }
  const date = new Date(`1970-01-01T${raw}`)
  if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date)
  return raw
}
