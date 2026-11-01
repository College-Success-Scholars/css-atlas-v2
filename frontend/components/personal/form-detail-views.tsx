"use client"

import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WahfRow, McfRow, WplRow, MenteeRow } from "@/lib/types/supabase"
import {
  findSubmissionForCampusWeek,
  getFormStatusForWeek,
  formatSubmittedDay,
  buildMcfMenteeOptions,
  mcfProgressLabel,
  type FormType,
  type FormStatusResult,
} from "./utils"
import {
  gradeScoreClass,
  missedFieldDisplay,
  parseNumericGrade,
  parseWplProjectRows,
  formatMeetingTime12Hour,
} from "@/lib/format/form-view-helpers"

// Form detail views shared by the Personal page and the Directory team leader
// popup. `readOnly` drops the viewer's own write shortcuts (Workday) so another
// person's submissions can be shown without them.

const WORKDAY_URL = "https://www.myworkday.com/umd/login-saml2.htmld"

export const FORM_TYPES: FormType[] = ["WAHF", "WPL", "MCF"]

type FormRows = {
  wahf: WahfRow[]
  mcf: McfRow[]
  wpl: WplRow[]
}

// ---------------------------------------------------------------------------
// Workday Shortcut
// ---------------------------------------------------------------------------

export function WorkdayShortcut({ inDialog = false }: { inDialog?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${inDialog ? "" : "rounded-lg border bg-muted/30 p-4"}`}>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">Enter your hours in Workday</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Search for &quot;Enter My Time&quot; in Workday to enter your hours. Opens in a separate window.
        </p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 cursor-pointer" asChild>
        <a
          href={WORKDAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            window.open(WORKDAY_URL, "_blank", "popup=yes,width=1100,height=800,noopener,noreferrer")
          }}
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Open Workday
          <span className="sr-only"> (opens in a separate window)</span>
        </a>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: FormStatusResult["status"] }) {
  switch (status) {
    case "done":
      return (
        <Badge variant="success">
          Done
        </Badge>
      )
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>
    case "incomplete":
      return <Badge variant="warning">Incomplete</Badge>
    case "missed":
      return <Badge variant="destructive">Missed</Badge>
    case "pending":
      return (
        <Badge variant="secondary">Pending</Badge>
      )
  }
}

// ---------------------------------------------------------------------------
// Form Type Tabs
// ---------------------------------------------------------------------------

export function FormTypeTabs({
  activeTab,
  onTabChange,
  panelId,
}: {
  activeTab: FormType
  onTabChange: (formType: FormType) => void
  panelId: string
}) {
  return (
    <div
      role="tablist"
      aria-label="Form type"
      className="flex flex-wrap gap-2"
    >
      {FORM_TYPES.map((ft) => {
        const selected = activeTab === ft
        return (
          <button
            key={ft}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`${panelId}-tab-${ft}`}
            aria-controls={panelId}
            onClick={() => onTabChange(ft)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              selected
                ? "border-primary/50 bg-primary/5 text-foreground ring-1 ring-primary/35"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {ft}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form Detail Footer
// ---------------------------------------------------------------------------

export function formFooterStatus(
  formType: FormType,
  { wahf, mcf, wpl }: FormRows,
  campusWeek: number,
  currentCampusWeek: number | null,
  menteeCount: number,
): string {
  const fs = getFormStatusForWeek(formType, wahf, mcf, wpl, campusWeek, currentCampusWeek, menteeCount)
  if (formType === "MCF") {
    const progress = mcfProgressLabel(fs.completedCount, fs.requiredCount)
    if (fs.requiredCount <= 0) return progress
    if (fs.status !== "done" || !fs.submittedAt) {
      return fs.completedCount > 0 ? `${progress} submitted` : progress
    }
    const day = formatSubmittedDay(fs.submittedAt)
    const when = fs.isLate ? `Submitted ${day} · late` : `Submitted ${day} · on time`
    return `${progress} · ${when}`
  }
  if (fs.status !== "done" || !fs.submittedAt) return "Not submitted"
  const day = formatSubmittedDay(fs.submittedAt)
  return fs.isLate ? `Submitted ${day} · late` : `Submitted ${day} · on time`
}

export function FormDetailFooter({
  formType,
  status,
  readOnly = false,
}: {
  formType: FormType
  status: string
  readOnly?: boolean
}) {
  return (
    <div className="shrink-0 space-y-3 border-t px-6 py-4">
      {formType === "WPL" && !readOnly && <WorkdayShortcut inDialog />}
      <p className="text-center text-xs text-muted-foreground">{status}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form Tab Bodies
// ---------------------------------------------------------------------------

export function FormTabBody({
  formType,
  campusWeek,
  wahf,
  mcf,
  wpl,
  mentees,
}: {
  formType: FormType
  campusWeek: number
  wahf: WahfRow[]
  mcf: McfRow[]
  wpl: WplRow[]
  mentees: MenteeRow[]
}) {
  if (formType === "WAHF") {
    const row = findSubmissionForCampusWeek(wahf, campusWeek)
    return <WahfTabBody row={row} />
  }
  if (formType === "WPL") {
    const row = findSubmissionForCampusWeek(wpl, campusWeek)
    return <WplTabBody row={row} />
  }
  return <McfWeekPanel campusWeek={campusWeek} mcf={mcf} mentees={mentees} />
}

export function McfWeekPanel({
  campusWeek,
  mcf,
  mentees,
}: {
  campusWeek: number
  mcf: McfRow[]
  mentees: MenteeRow[]
}) {
  const options = useMemo(
    () => buildMcfMenteeOptions(mentees, mcf, campusWeek),
    [mentees, mcf, campusWeek],
  )
  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? "")

  const selected = options.find((option) => option.key === selectedKey) ?? options[0] ?? null

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No mentees assigned for this week.</p>
  }

  return (
    <div className="space-y-4">
      {options.length >= 1 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mentee
          </p>
          <Select
            value={selected?.key ?? ""}
            onValueChange={setSelectedKey}
          >
            <SelectTrigger className="w-full min-w-0 cursor-pointer" aria-label="Select mentee MCF">
              <SelectValue placeholder="Select a mentee" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.menteeName}
                  {option.submission ? "" : " · missing"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <McfTabBody
        row={selected?.submission ?? null}
        emptyLabel={
          selected
            ? `Not submitted for ${selected.menteeName} this week.`
            : "Not submitted for this week."
        }
      />
    </div>
  )
}

export function WahfTabBody({ row }: { row: WahfRow | null }) {
  if (!row) {
    return <p className="text-sm text-muted-foreground">Not submitted for this week.</p>
  }

  const grades = row.assignment_grades && Object.keys(row.assignment_grades).length > 0
  const additional: { label: string; value: string }[] = []
  if (row.scholar_name?.trim()) additional.push({ label: "Scholar", value: row.scholar_name })
  if (row.course_changes?.trim()) additional.push({ label: "Course changes", value: row.course_changes })
  if (row.course_change_details?.trim()) {
    additional.push({ label: "Change details", value: row.course_change_details })
  }
  if (row.tl_meeting_in_person?.trim()) {
    additional.push({ label: "TL meeting in person", value: row.tl_meeting_in_person })
  }

  return (
    <div className="space-y-6 text-sm">
      {grades && (
        <div>
          <div className="relative mb-3 text-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
            <span className="relative bg-background px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assignment grades by course
            </span>
          </div>
          <div className="space-y-3">
            {Object.entries(row.assignment_grades!).map(([course, assignmentMap]) => (
              <div
                key={course}
                className="overflow-hidden rounded-lg border border-border bg-background"
              >
                <div className="border-b border-border bg-muted/50 px-3 py-2 font-semibold">
                  {course}
                </div>
                <div className="divide-y divide-border">
                  {Object.entries(assignmentMap).map(([assignment, grade]) => {
                    const num = parseNumericGrade(String(grade))
                    return (
                      <div
                        key={assignment}
                        className="flex items-center justify-between gap-4 px-3 py-2.5"
                      >
                        <span>{assignment}</span>
                        <span className={`shrink-0 font-semibold tabular-nums ${gradeScoreClass(num)}`}>
                          {grade}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Missed classes
          </p>
          <p className="mt-1 font-semibold text-foreground">
            {missedFieldDisplay(row.missed_classes)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Missed assignments
          </p>
          <p className="mt-1 font-semibold text-foreground">
            {missedFieldDisplay(row.missed_assignments)}
          </p>
        </div>
      </div>

      {additional.length > 0 && (
        <AdditionalDetailsSection items={additional} />
      )}
    </div>
  )
}

export function WplTabBody({ row }: { row: WplRow | null }) {
  if (!row) {
    return <p className="text-sm text-muted-foreground">Not submitted for this week.</p>
  }

  const projects = parseWplProjectRows(row.projects)
  const met = row.met_with_all?.trim() || "—"
  const hours = row.hours_worked
  const explanation = row.explanation?.trim() ?? ""

  const additional: { label: string; value: string }[] = []
  if (row.full_name?.trim()) additional.push({ label: "Name", value: row.full_name })

  return (
    <div className="space-y-6 text-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Total hours
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">
          {hours != null ? hours : "—"}
          {hours != null && (
            <span className="ml-2 text-base font-normal text-muted-foreground">hrs this week</span>
          )}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Met with all scholars
        </p>
        <p className="mt-1 font-semibold text-foreground">{met}</p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Project breakdown
        </p>
        {projects.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {projects.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-3 py-2.5">
                <span>{p.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{p.hours || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Explanation / notes
        </p>
        {explanation ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-foreground">
            {explanation}
          </div>
        ) : (
          <p className="text-muted-foreground">—</p>
        )}
      </div>

      {additional.length > 0 && <AdditionalDetailsSection items={additional} />}
    </div>
  )
}

export function McfTabBody({ row, emptyLabel }: { row: McfRow | null; emptyLabel?: string }) {
  if (!row) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyLabel ?? "Not submitted for this week."}
      </p>
    )
  }

  const reason = row.reason_no_meeting?.trim()
  const mentee = row.mentee_name?.trim() || "—"
  const meetingDate = row.meeting_date?.trim() || "—"
  const inPerson = row.met_in_person?.trim() || "—"
  const tasks = row.tasks_completed?.trim() || "—"
  const notes = row.meeting_notes?.trim() ?? ""

  const additional: { label: string; value: string }[] = []
  if (row.meeting_time?.trim()) {
    additional.push({ label: "Meeting time", value: formatMeetingTime12Hour(row.meeting_time) })
  }
  if (row.needs_tutor?.trim()) additional.push({ label: "Needs tutor", value: row.needs_tutor })
  if (row.tutoring_status?.trim()) additional.push({ label: "Tutoring status", value: row.tutoring_status })
  if (row.mentor_name?.trim()) additional.push({ label: "Mentor", value: row.mentor_name })
  if (row.support_rank?.trim()) additional.push({ label: "Support rank", value: row.support_rank })
  if (row.submitted_by_email?.trim()) {
    additional.push({ label: "Submitted by", value: row.submitted_by_email })
  }

  return (
    <div className="space-y-6 text-sm">
      {reason && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          No meeting held this week — reason: {reason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mentee
          </p>
          <p className="mt-1 font-semibold text-foreground">{mentee}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Meeting date
          </p>
          <p className="mt-1 font-semibold text-foreground">{meetingDate}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            In person
          </p>
          <p className="mt-1 font-semibold text-foreground">{inPerson}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tasks completed
        </p>
        <p className="text-foreground">{tasks}</p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Meeting notes
        </p>
        {notes ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-foreground">
            {notes}
          </div>
        ) : (
          <p className="text-muted-foreground">—</p>
        )}
      </div>

      {additional.length > 0 && <AdditionalDetailsSection items={additional} />}
    </div>
  )
}

export function AdditionalDetailsSection({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Additional details
      </p>
      <ul className="space-y-2 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item.label}>
            <span className="font-medium text-foreground">{item.label}: </span>
            {item.value}
          </li>
        ))}
      </ul>
    </div>
  )
}
