"use client"

import { useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { ExternalLink, Eye } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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
import type { PersonalClientProps, WahfRow, McfRow, WplRow, MenteeRow } from "@/lib/types/supabase"
import {
  computeWeekOptions,
  getFormStatusForWeek,
  getGreeting,
  formatSubmittedDateTime,
  mcfProgressLabel,
  canBrowseMcf,
  type FormType,
  type FormStatusResult,
  type WeekOption,
} from "./utils"
import {
  FORM_TYPES,
  FormDetailFooter,
  FormTabBody,
  FormTypeTabs,
  StatusBadge,
  WorkdayShortcut,
  formFooterStatus,
} from "./form-detail-views"
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state"

const INITIAL_HISTORY_WEEKS = 2
const HISTORY_WEEKS_INCREMENT = 2
const FORM_URLS: Record<FormType, string> = {
  WAHF: "https://docs.google.com/forms/d/e/1FAIpQLSdkQ_3BXulRH8G1uyOjcLNlG2DhBx-JnKvsN0SZ43M4qB7GdA/viewform",
  WPL: "https://docs.google.com/forms/d/e/1FAIpQLSeyK6mN22XWf5i2dgqkW6BFCvglK5DPEIHu8g3DbRPjpc0P6Q/viewform",
  MCF: "https://docs.google.com/forms/d/e/1FAIpQLSeaa-aUkIhUzl-WZnlGSMmdx0sJbjQhK6fZniJwL6azT5czkg/viewform",
}

const PANEL_ID = "personal-form-detail-panel"

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

  const footerStatus = useMemo(
    () => formFooterStatus(activeTab, { wahf, mcf, wpl }, campusWeek, currentCampusWeek, menteeCount),
    [activeTab, wahf, mcf, wpl, campusWeek, currentCampusWeek, menteeCount],
  )

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

        <FormTypeTabs activeTab={activeTab} onTabChange={setActiveTab} panelId={PANEL_ID} />
      </div>

      <div
        className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-4"
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={`${PANEL_ID}-tab-${activeTab}`}
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

      <FormDetailFooter formType={activeTab} status={footerStatus} />
    </DialogContent>
  )
}
