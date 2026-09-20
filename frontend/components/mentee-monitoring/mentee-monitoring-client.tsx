"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, AlertCircle, User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MenteeMonitoringClientProps } from "@/lib/types/supabase"
import {
  computeWeekOptions,
  filterActivityForMenteeWeek,
  computeDailyHours,
  addComplianceToDailyHours,
  sumMinutesToHours,
  computeWahfStatus,
  computeTutoringSessions,
  menteeName,
  getTodayDayLabel,
} from "./utils"
import { HoursCard } from "./hours-card"
import { TutoringCard } from "./tutoring-card"
import { WahfCard } from "./wahf-card"
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state"

export function MenteeMonitoringClient({
  mentees,
  activity,
  wahf,
  tutoring,
  currentCampusWeek,
}: MenteeMonitoringClientProps) {
  const yearStarted = currentCampusWeek != null

  const validMentees = useMemo(
    () => mentees.filter((m) => m.scholar_uid != null),
    [mentees],
  )

  const [selectedUid, setSelectedUid] = useState<string>(
    () => validMentees[0]?.scholar_uid ?? "",
  )
  const [selectedWeek, setSelectedWeek] = useState<number>(
    () => currentCampusWeek ?? 0,
  )

  const weekOptions = useMemo(
    () => computeWeekOptions(currentCampusWeek),
    [currentCampusWeek],
  )

  const weekIndex = weekOptions.findIndex((w) => w.weekNum === selectedWeek)

  const selectedMentee = validMentees.find((m) => m.scholar_uid === selectedUid)
  const name = selectedMentee ? menteeName(selectedMentee) : "Unknown"
  const todayLabel = getTodayDayLabel()

  // ---- Derived data -------------------------------------------------------

  const { studySession, frontDesk } = useMemo(
    () =>
      yearStarted && selectedUid
        ? filterActivityForMenteeWeek(activity, selectedUid, selectedWeek)
        : { studySession: [], frontDesk: [] },
    [activity, selectedUid, selectedWeek, yearStarted],
  )

  const ssDailyHours = useMemo(
    () =>
      addComplianceToDailyHours(
        computeDailyHours(studySession),
        selectedMentee?.ssCompliance ?? null,
        selectedWeek,
      ),
    [studySession, selectedMentee?.ssCompliance, selectedWeek],
  )
  const fdDailyHours = useMemo(
    () =>
      addComplianceToDailyHours(
        computeDailyHours(frontDesk),
        selectedMentee?.fdCompliance ?? null,
        selectedWeek,
      ),
    [frontDesk, selectedMentee?.fdCompliance, selectedWeek],
  )

  const ssCompleted = useMemo(() => sumMinutesToHours(studySession), [studySession])
  const fdCompleted = useMemo(() => sumMinutesToHours(frontDesk), [frontDesk])

  const ssRequired = (selectedMentee?.ss_required ?? 0) / 60
  const fdRequired = (selectedMentee?.fd_required ?? 0) / 60

  const wahfStatus = useMemo(
    () =>
      yearStarted
        ? computeWahfStatus(wahf, selectedUid, selectedWeek, currentCampusWeek)
        : null,
    [wahf, selectedUid, selectedWeek, currentCampusWeek, yearStarted],
  )

  const tutoringSessions = useMemo(
    () =>
      yearStarted
        ? computeTutoringSessions(tutoring, selectedUid, selectedWeek)
        : [],
    [tutoring, selectedUid, selectedWeek, yearStarted],
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

  // ---- Week navigation helpers --------------------------------------------

  const canGoBack = weekIndex < weekOptions.length - 1
  const canGoForward = weekIndex > 0

  function goBack() {
    if (canGoBack) setSelectedWeek(weekOptions[weekIndex + 1].weekNum)
  }
  function goForward() {
    if (canGoForward) setSelectedWeek(weekOptions[weekIndex - 1].weekNum)
  }

  const currentWeekOption = weekOptions[weekIndex]

  // ---- Alert banner -------------------------------------------------------

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
                &middot; {currentWeekOption?.label ?? `Week ${selectedWeek}`}
              </>
            ) : null}
          </p>
        </div>

        {/* Width = two h-9 icon buttons + gap-1 + former week dropdown (190px) */}
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-[calc(5rem+190px)] sm:shrink-0">
          {/* Mentee selector — same width as week row below */}
          <Select value={selectedUid} onValueChange={setSelectedUid}>
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
            <div className="flex w-full items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 cursor-pointer"
                disabled={!canGoBack}
                onClick={goBack}
                aria-label="Previous week"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <div className="min-w-0 flex-1">
                <Select
                  value={String(selectedWeek)}
                  onValueChange={(v) => setSelectedWeek(Number(v))}
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
                disabled={!canGoForward}
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
            />
            <HoursCard
              title="Front desk hours"
              completed={fdCompleted}
              total={fdRequired}
              color="sky"
              dailyHours={fdDailyHours}
              todayLabel={todayLabel}
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
