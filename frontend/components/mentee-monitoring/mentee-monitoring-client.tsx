"use client"

import { useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, AlertCircle, User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { MenteeMonitoringClientProps } from "@/lib/types/supabase"
import {
  computeWeekOptions,
  addComplianceToDailyHours,
  attendanceRowForKind,
  dailyHoursFromAttendance,
  minutesToHours,
  computeWahfStatus,
  computeTutoringSessions,
  menteeName,
  getTodayDayLabel,
} from "./utils"
import { HoursCard } from "./hours-card"
import { TutoringCard } from "./tutoring-card"
import { WahfCard } from "./wahf-card"
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state"

function menteeHref(week: number | null, uid?: string | null) {
  const params = new URLSearchParams()
  if (week != null && week > 0) params.set("week", String(week))
  if (uid) params.set("uid", uid)
  const query = params.toString()
  return query ? `/dashboard/mentee?${query}` : "/dashboard/mentee"
}

export function MenteeMonitoringClient({
  mentees,
  attendance,
  wahf,
  tutoring,
  currentCampusWeek,
  selectedWeek,
  selectedUid: selectedUidProp,
}: MenteeMonitoringClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const yearStarted = currentCampusWeek != null

  const validMentees = useMemo(
    () => mentees.filter((m) => m.scholar_uid != null),
    [mentees],
  )

  const selectedUid = selectedUidProp ?? validMentees[0]?.scholar_uid ?? ""
  const weekNum = selectedWeek ?? currentCampusWeek ?? 0

  const weekOptions = useMemo(
    () => computeWeekOptions(currentCampusWeek),
    [currentCampusWeek],
  )

  const weekIndex = weekOptions.findIndex((w) => w.weekNum === weekNum)

  const selectedMentee = validMentees.find((m) => m.scholar_uid === selectedUid)
  const name = selectedMentee ? menteeName(selectedMentee) : "Unknown"
  const todayLabel = getTodayDayLabel()

  function navigate(week: number | null, uid: string) {
    const href = menteeHref(week, uid)
    startTransition(() => {
      router.push(href)
    })
  }

  const ssRow = useMemo(
    () => attendanceRowForKind(attendance.rows, selectedUid, "study_session"),
    [attendance.rows, selectedUid],
  )
  const fdRow = useMemo(
    () => attendanceRowForKind(attendance.rows, selectedUid, "front_desk"),
    [attendance.rows, selectedUid],
  )

  const ssDailyHours = useMemo(
    () =>
      addComplianceToDailyHours(
        dailyHoursFromAttendance(ssRow),
        selectedMentee?.ssCompliance ?? null,
        weekNum,
      ),
    [ssRow, selectedMentee?.ssCompliance, weekNum],
  )
  const fdDailyHours = useMemo(
    () =>
      addComplianceToDailyHours(
        dailyHoursFromAttendance(fdRow),
        selectedMentee?.fdCompliance ?? null,
        weekNum,
      ),
    [fdRow, selectedMentee?.fdCompliance, weekNum],
  )

  const ssCompleted = minutesToHours(ssRow?.logged_min ?? 0)
  const fdCompleted = minutesToHours(fdRow?.logged_min ?? 0)
  const ssExcuseHours = minutesToHours(ssRow?.excuse_min ?? 0)
  const fdExcuseHours = minutesToHours(fdRow?.excuse_min ?? 0)

  const ssRequired = (selectedMentee?.ss_required ?? 0) / 60
  const fdRequired = (selectedMentee?.fd_required ?? 0) / 60

  const wahfStatus = useMemo(
    () =>
      yearStarted && weekNum > 0
        ? computeWahfStatus(wahf, selectedUid, weekNum, currentCampusWeek)
        : null,
    [wahf, selectedUid, weekNum, currentCampusWeek, yearStarted],
  )

  const tutoringSessions = useMemo(
    () =>
      yearStarted && weekNum > 0
        ? computeTutoringSessions(tutoring, selectedUid, weekNum)
        : [],
    [tutoring, selectedUid, weekNum, yearStarted],
  )

  if (validMentees.length === 0) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Users className="size-12 text-muted-foreground" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold mb-2">No mentees yet</h2>
          <p className="text-muted-foreground max-w-md">
            When mentees are assigned to you, their study and front desk hours,
            tutoring, and WAHF status will show here.
          </p>
        </div>
      </div>
    )
  }

  const canGoBack = weekIndex < weekOptions.length - 1
  const canGoForward = weekIndex > 0

  function goBack() {
    if (canGoBack) navigate(weekOptions[weekIndex + 1].weekNum, selectedUid)
  }
  function goForward() {
    if (canGoForward) navigate(weekOptions[weekIndex - 1].weekNum, selectedUid)
  }

  const currentWeekOption = weekOptions[weekIndex]

  const showAlert =
    wahfStatus != null && !wahfStatus.submitted && wahfStatus.daysOverdue > 0

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <p className="text-sm text-muted-foreground">
            UID {selectedUid}
            {yearStarted ? (
              <>
                {" "}
                &middot; {currentWeekOption?.label ?? `Week ${weekNum}`}
              </>
            ) : null}
          </p>
        </div>

        {/* Width = two h-9 icon buttons + gap-1 + former week dropdown (190px) */}
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-[calc(5rem+190px)] sm:shrink-0">
          {/* Mentee selector — same width as week row below */}
          <Select
            value={selectedUid}
            onValueChange={(uid) => navigate(selectedWeek, uid)}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Select mentee" />
            </SelectTrigger>
            <SelectContent>
              {validMentees.map((m) => (
                <SelectItem key={m.scholar_uid} value={m.scholar_uid!}>
                  {menteeName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {yearStarted && (
            <div className={cn("flex w-full items-center gap-1", isPending && "opacity-60")}>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 cursor-pointer"
                disabled={!canGoBack || isPending}
                onClick={goBack}
                aria-label="Previous week"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <div className="min-w-0 flex-1">
                <Select
                  value={String(weekNum)}
                  onValueChange={(v) => navigate(Number(v), selectedUid)}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full min-w-0 cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekOptions.map((w) => (
                      <SelectItem key={w.weekNum} value={String(w.weekNum)}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 cursor-pointer"
                disabled={!canGoForward || isPending}
                onClick={goForward}
                aria-label="Next week"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {!yearStarted ? (
        <YearNotStartedState variant="full" />
      ) : (
        <>
          {/* ---- Alert Banner ---- */}
          {showAlert && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-destructive" />
                <p className="text-sm font-medium text-destructive">
                  WAHF form overdue &mdash; action required
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-destructive/20 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                {wahfStatus.daysOverdue} days overdue
              </span>
            </div>
          )}

          {/* ---- Card Grid ---- */}
          <div className="grid gap-4 md:grid-cols-2">
            <HoursCard
              title="Study session hours"
              completed={ssCompleted}
              total={ssRequired}
              color="emerald"
              dailyHours={ssDailyHours}
              todayLabel={todayLabel}
              excuseHours={ssExcuseHours}
              excuseDescription={ssRow?.description ?? null}
            />
            <HoursCard
              title="Front desk hours"
              completed={fdCompleted}
              total={fdRequired}
              color="sky"
              dailyHours={fdDailyHours}
              todayLabel={todayLabel}
              excuseHours={fdExcuseHours}
              excuseDescription={fdRow?.description ?? null}
            />
            <TutoringCard sessions={tutoringSessions} menteeName={name} />
            {wahfStatus != null && (
              <WahfCard menteeName={name} status={wahfStatus} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
