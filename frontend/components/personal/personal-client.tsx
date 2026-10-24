"use client"

import { useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { ArrowUpRight, ExternalLink, Eye } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CampusWeekNav } from "@/components/data-display/campus-week-nav"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PersonalClientProps, WahfRow, McfRow, WplRow, MenteeRow } from "@/lib/types/supabase"
import {
  findSubmissionForCampusWeek,
  computeWeekOptions,
  getFormStatusForWeek,
  getGreeting,
  formatSubmittedDateTime,
  formatSubmittedDay,
  buildMcfMenteeOptions,
  mcfProgressLabel,
  canBrowseMcf,
  type FormType,
  type FormStatusResult,
  type WeekOption,
} from "./utils"
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state"
import {
  gradeScoreClass,
  missedFieldDisplay,
  parseNumericGrade,
  parseWplProjectRows,
  formatMeetingTime12Hour,
} from "@/lib/format/form-view-helpers"

const INITIAL_HISTORY_WEEKS = 2
const HISTORY_WEEKS_INCREMENT = 2
const WORKDAY_URL = "https://www.myworkday.com/umd/login-saml2.htmld"

const FORM_TYPES: FormType[] = ["WAHF", "WPL", "MCF"]

const FORM_URLS: Record<FormType, string> = {
  WAHF: "https://docs.google.com/forms/d/e/1FAIpQLSdkQ_3BXulRH8G1uyOjcLNlG2DhBx-JnKvsN0SZ43M4qB7GdA/viewform",
  WPL: "https://docs.google.com/forms/d/e/1FAIpQLSeyK6mN22XWf5i2dgqkW6BFCvglK5DPEIHu8g3DbRPjpc0P6Q/viewform",
  MCF: "https://docs.google.com/forms/d/e/1FAIpQLSeaa-aUkIhUzl-WZnlGSMmdx0sJbjQhK6fZniJwL6azT5czkg/viewform",
}

const FORM_DEADLINES: Record<FormType, string> = {
  WAHF: "Due Thu 11:59pm",
  WPL: "Due Fri 5:00pm",
  MCF: "Due Fri 5:00pm",
}

type DialogState = {
  /** Bumps only when opening the modal so tab selection is not reset on week nav. */
  sessionKey: number
  campusWeek: number
  initialFormType: FormType
} | null

export function PersonalClient({ profile, wahf, mcf, wpl, mentees, currentCampusWeek }: PersonalClientProps) {
  const dialogSessionRef = useRef(0)
  const [dialogState, setDialogState] = useState<DialogState>(null)

  const openFormDialog = (campusWeek: number, initialFormType: FormType) => {
    dialogSessionRef.current += 1
    setDialogState({
      sessionKey: dialogSessionRef.current,
      campusWeek,
      initialFormType,
    })
  }
  const [historyWeeksVisible, setHistoryWeeksVisible] = useState(INITIAL_HISTORY_WEEKS)

  const greeting = useMemo(() => getGreeting(), [])
  const today = useMemo(() => format(new Date(), "EEEE, MMMM d"), [])

  const weekOptions = useMemo(
    () => computeWeekOptions(currentCampusWeek),
    [currentCampusWeek],
  )

  const menteeCount = profile.mentee_count ?? 0

  const currentWeekStatuses = useMemo(() => {
    if (currentCampusWeek == null) return []
    return FORM_TYPES.map((ft) =>
      getFormStatusForWeek(ft, wahf, mcf, wpl, currentCampusWeek, currentCampusWeek, menteeCount),
    )
  }, [wahf, mcf, wpl, currentCampusWeek, menteeCount])

  const pastWeeks = useMemo(
    () => weekOptions.filter((w) => !w.isCurrent),
    [weekOptions],
  )

  const visiblePastWeeks = useMemo(
    () => pastWeeks.slice(0, historyWeeksVisible),
    [pastWeeks, historyWeeksVisible],
  )

  const hasMoreHistoryWeeks = pastWeeks.length > historyWeeksVisible

  const firstName = profile.first_name ?? "there"

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <p className="text-sm text-muted-foreground">
          {today}
          {currentCampusWeek != null ? <> &middot; Week {currentCampusWeek}</> : null}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {firstName}
        </h1>
      </div>

      {currentCampusWeek == null ? (
        <YearNotStartedState variant="full" />
      ) : (
        <>
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            This Week&apos;s Forms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currentWeekStatuses.map((fs) => (
              <ThisWeekFormCard
                key={fs.formType}
                formStatus={fs}
                onView={() => openFormDialog(currentCampusWeek, fs.formType)}
              />
            ))}
          </div>
          <div className="mt-4">
            <WorkdayShortcut />
          </div>
        </section>

      {pastWeeks.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Submission History
          </h2>
          <div className="space-y-6">
            {visiblePastWeeks.map((week) => (
              <HistoryWeekBlock
                key={week.weekNum}
                weekNum={week.weekNum}
                label={week.label}
                wahf={wahf}
                mcf={mcf}
                wpl={wpl}
                menteeCount={menteeCount}
                currentCampusWeek={currentCampusWeek}
                onView={(formType) => openFormDialog(week.weekNum, formType)}
              />
            ))}
          </div>
          {hasMoreHistoryWeeks && (
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full cursor-pointer"
              onClick={() =>
                setHistoryWeeksVisible((n) =>
                  Math.min(n + HISTORY_WEEKS_INCREMENT, pastWeeks.length),
                )
              }
            >
              Load more
            </Button>
          )}
        </section>
      )}

      <FormDetailDialog
        state={dialogState}
        weekOptions={weekOptions}
        wahf={wahf}
        mcf={mcf}
        wpl={wpl}
        mentees={mentees}
        menteeCount={menteeCount}
        currentCampusWeek={currentCampusWeek}
        onClose={() => setDialogState(null)}
        onNavigateWeek={(campusWeek) =>
          setDialogState((prev) => (prev ? { ...prev, campusWeek } : null))
        }
      />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// This Week's Form Card
// ---------------------------------------------------------------------------

function WorkdayShortcut({ inDialog = false }: { inDialog?: boolean }) {
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

function ThisWeekFormCard({
  formStatus,
  onView,
}: {
  formStatus: FormStatusResult
  onView: () => void
}) {
  const { formType, status, submittedAt, daysOverdue, hoursLeft, daysLeft, submission } = formStatus
  const isMcf = formType === "MCF"
  const progress = isMcf
    ? mcfProgressLabel(formStatus.completedCount, formStatus.requiredCount)
    : null
  const showView = isMcf
    ? formStatus.completedCount > 0 && canBrowseMcf(formStatus)
    : status === "done" && Boolean(submission)
  const showSubmit = status === "pending" || status === "overdue" || status === "incomplete"
  const actionClassName = "h-10 w-full min-w-0 cursor-pointer rounded-none border-0 px-2 shadow-none"

  const borderClass =
    status === "done"
      ? "border-success/40 bg-success-muted/50"
      : status === "incomplete"
        ? "border-warning/40 bg-warning-muted/50"
        : status === "overdue"
          ? "border-destructive/40 bg-destructive/10"
          : ""

  return (
    <Card className={`gap-0 overflow-hidden py-0 ${borderClass}`}>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-base">{formType}</p>
            <p className="text-xs text-muted-foreground">{FORM_DEADLINES[formType]}</p>
            <span>{isMcf && formStatus.requiredCount > 0 && (
            <span className="ml-auto shrink-0 text-xs font-medium tabular-nums text-muted-foreground" aria-label={progress ?? undefined}>
              {formStatus.completedCount}/{formStatus.requiredCount} mentees
            </span>
          )}</span>
          </div>
          <StatusBadge status={status} />
        </div>

        <Separator />

        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p
            className={`min-w-0 flex-1 break-words text-sm leading-relaxed ${
              status === "overdue" ? "font-medium text-destructive" : "text-muted-foreground"
            }`}
          >
            {status === "overdue"
              ? `${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} late`
              : status === "incomplete"
                ? "Incomplete"
              : status === "pending"
                ? daysLeft > 0
                  ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`
                  : hoursLeft > 0 ? `${hoursLeft} ${hoursLeft === 1 ? "hour" : "hours"} left` : "Due soon"
                : isMcf && formStatus.requiredCount <= 0
                  ? progress
                  : submittedAt
                    ? `Submitted ${formatSubmittedDateTime(submittedAt)}`
                    : ""}
          </p>
        </div>
      </CardContent>
      {(showView || showSubmit) && (
        <div className={`grid border-t ${showView && showSubmit ? "grid-cols-2 gap-px bg-border" : "grid-cols-1"}`}>
          {showView ? (
            <Button
              variant="outline"
              className={actionClassName}
              onClick={() => onView()}
            >
              <Eye className="size-3.5" aria-hidden="true" /> View
            </Button>
          ) : null}
          {showSubmit ? (
            <Button variant={status === "pending" ? "outline" : "default"} className={actionClassName} asChild>
              <a href={FORM_URLS[formType]} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" aria-hidden="true" /> Submit
              </a>
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// History Week Block
// ---------------------------------------------------------------------------

function HistoryWeekBlock({
  weekNum,
  label,
  wahf,
  mcf,
  wpl,
  menteeCount,
  currentCampusWeek,
  onView,
}: {
  weekNum: number
  label: string
  wahf: WahfRow[]
  mcf: McfRow[]
  wpl: WplRow[]
  menteeCount: number
  currentCampusWeek: number | null
  onView: (formType: FormType) => void
}) {
  const statuses = useMemo(
    () =>
      FORM_TYPES.map((ft) =>
        getFormStatusForWeek(ft, wahf, mcf, wpl, weekNum, currentCampusWeek, menteeCount),
      ),
    [wahf, mcf, wpl, weekNum, currentCampusWeek, menteeCount],
  )

  return (
    <Card className="gap-0 overflow-hidden py-0" role="group" aria-labelledby={`history-week-${weekNum}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
        <h3 id={`history-week-${weekNum}`} className="text-sm font-semibold">
          Week {weekNum}
        </h3>
        <p className="ml-auto text-sm font-medium text-muted-foreground">
          {label.replace(/\s*[–-]\s*/g, " - ")}
        </p>
      </div>

      <div className="divide-y">
        {statuses.map((s) => (
          <HistoryFormRow
            key={s.formType}
            formStatus={s}
            onView={s.formType === "MCF" ? (canBrowseMcf(s) ? () => onView(s.formType) : undefined) : (s.submission ? () => onView(s.formType) : undefined)}
          />
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// History Form Row
// ---------------------------------------------------------------------------

function HistoryFormRow({
  formStatus,
  onView,
}: {
  formStatus: FormStatusResult
  onView?: () => void
}) {
  const { formType, status, submittedAt, isLate } = formStatus
  const isMcf = formType === "MCF"
  const progress = isMcf
    ? mcfProgressLabel(formStatus.completedCount, formStatus.requiredCount)
    : null

  const dotColor =
    status === "done" && !isLate
      ? "bg-success"
      : status === "done" && isLate
        ? "bg-warning"
        : status === "incomplete"
          ? "bg-warning"
          : "bg-destructive"

  let description: string
  if (isMcf && formStatus.requiredCount <= 0) {
    description = progress ?? "No mentee assigned"
  } else if (submittedAt) {
    const when = formatSubmittedDateTime(submittedAt)
    description = `Submitted ${when}${isLate ? " \u00b7 late" : ""}`
  } else {
    description = "Not submitted"
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-medium">{formType}</p>
            {isMcf && formStatus.requiredCount > 0 && (
              <span className="text-xs text-muted-foreground">{progress}</span>
            )}
          </div>
          <p className="break-words text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {status === "missed" || status === "incomplete" ? (
          <span className={`text-xs font-medium ${status === "incomplete" ? "text-warning" : "text-destructive"}`}>
            {status === "incomplete" || (isMcf && formStatus.completedCount > 0) ? "Incomplete" : "Missed"}
          </span>
        ) : null}
        {onView && (
          <Button size="sm" variant="outline" className="cursor-pointer" onClick={onView}>
            <Eye className="size-3.5" aria-hidden="true" /> View
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: FormStatusResult["status"] }) {
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
// Form Detail Dialog
// ---------------------------------------------------------------------------

function FormDetailDialog({
  state,
  weekOptions,
  wahf,
  mcf,
  wpl,
  mentees,
  menteeCount,
  currentCampusWeek,
  onClose,
  onNavigateWeek,
}: {
  state: DialogState
  weekOptions: WeekOption[]
  wahf: WahfRow[]
  mcf: McfRow[]
  wpl: WplRow[]
  mentees: MenteeRow[]
  menteeCount: number
  currentCampusWeek: number | null
  onClose: () => void
  onNavigateWeek: (campusWeek: number) => void
}) {
  const weeks = weekOptions.map((week) => week.weekNum)

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {state && (
        <FormDetailDialogContent
          key={state.sessionKey}
          campusWeek={state.campusWeek}
          initialFormType={state.initialFormType}
          weeks={weeks}
          onNavigateWeek={onNavigateWeek}
          wahf={wahf}
          mcf={mcf}
          wpl={wpl}
          mentees={mentees}
          menteeCount={menteeCount}
          currentCampusWeek={currentCampusWeek}
        />
      )}
    </Dialog>
  )
}

function FormDetailDialogContent({
  campusWeek,
  initialFormType,
  weeks,
  onNavigateWeek,
  wahf,
  mcf,
  wpl,
  mentees,
  menteeCount,
  currentCampusWeek,
}: {
  campusWeek: number
  initialFormType: FormType
  weeks: number[]
  onNavigateWeek: (campusWeek: number) => void
  wahf: WahfRow[]
  mcf: McfRow[]
  wpl: WplRow[]
  mentees: MenteeRow[]
  menteeCount: number
  currentCampusWeek: number | null
}) {
  const [activeTab, setActiveTab] = useState<FormType>(initialFormType)

  const footerStatus = useMemo(() => {
    const fs = getFormStatusForWeek(activeTab, wahf, mcf, wpl, campusWeek, currentCampusWeek, menteeCount)
    if (activeTab === "MCF") {
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
  }, [activeTab, wahf, mcf, wpl, campusWeek, currentCampusWeek, menteeCount])

  return (
    <DialogContent className="flex h-[min(85vh,42rem)] w-full max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl [&>button]:cursor-pointer">
      <div className="shrink-0 space-y-4 border-b px-6 pb-4 pt-6">
        <DialogHeader className="space-y-1 p-0 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Form submission
          </DialogTitle>
          <DialogDescription className="sr-only">
            Weekly form answers for the selected campus week.
          </DialogDescription>
        </DialogHeader>

        <CampusWeekNav
          weeks={weeks}
          selectedWeek={campusWeek}
          currentCampusWeek={currentCampusWeek}
          onWeekChange={onNavigateWeek}
          className="w-full sm:w-full"
        />

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
                id={`form-tab-${ft}`}
                aria-controls="personal-form-detail-panel"
                onClick={() => setActiveTab(ft)}
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
      </div>

      <div
        className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-4"
        role="tabpanel"
        id="personal-form-detail-panel"
        aria-labelledby={`form-tab-${activeTab}`}
      >
        <FormTabBody
          formType={activeTab}
          campusWeek={campusWeek}
          wahf={wahf}
          mcf={mcf}
          wpl={wpl}
          mentees={mentees}
        />
      </div>

      <div className="shrink-0 space-y-3 border-t px-6 py-4">
        {activeTab === "WPL" && <WorkdayShortcut inDialog />}
        <p className="text-center text-xs text-muted-foreground">{footerStatus}</p>
      </div>
    </DialogContent>
  )
}

function FormTabBody({
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

function McfWeekPanel({
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

function WahfTabBody({ row }: { row: WahfRow | null }) {
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

function WplTabBody({ row }: { row: WplRow | null }) {
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

function McfTabBody({ row, emptyLabel }: { row: McfRow | null; emptyLabel?: string }) {
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

function AdditionalDetailsSection({ items }: { items: { label: string; value: string }[] }) {
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
