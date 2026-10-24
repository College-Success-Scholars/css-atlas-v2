"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MenteeReviewClientProps } from "@/lib/types/mentee-review"

import { buildFollowUpDrafts, type FollowUpReason } from "./follow-up-drafts"
import { HourSummaryCard } from "./hour-summary-card"
import { McfBar } from "./mcf-bar"
import { MenteeDetailsSkeleton } from "./mentee-details-skeleton"
import { RecentGradesSummaryCard } from "./recent-grades-summary-card"
import { SectionError } from "./section-error"
import { SemesterGrid } from "./semester-grid"
import { TutoringSummaryCard } from "./tutoring-summary-card"
import { WahfSummaryCard } from "./wahf-summary-card"
import { formatAsOf, formatWeekTitle, menteeFirstName } from "./utils"
import styles from "./mentee-review.module.css"

function menteeHref(
  basePath: string,
  week: number | null,
  uid: string | null,
) {
  const params = new URLSearchParams()
  if (week != null && week > 0) params.set("week", String(week))
  if (uid) params.set("uid", uid)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function NoMentees() {
  return (
    <div className="mx-auto max-w-2xl py-12 text-center">
      <div className="mb-4 inline-flex rounded-full bg-muted p-6">
        <Users className="size-12 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="mb-2 text-lg font-semibold">No mentees yet</h2>
      <p className="text-muted-foreground">
        When mentees are assigned to you, their weekly review will show here.
      </p>
    </div>
  )
}

function NeutralCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="space-y-1 px-[18px] py-4">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  )
}

export function MenteeMonitoringClient({
  mentees,
  review,
  selectedWeek,
  detailPath,
}: MenteeReviewClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function navigate(week: number | null, uid: string) {
    if (week === selectedWeek && uid === review?.mentee.uid) return
    // The directory detail path already names the scholar, so week navigation
    // stays on it and does not append the uid query param.
    startTransition(() =>
      router.push(
        detailPath
          ? menteeHref(detailPath, week, null)
          : menteeHref("/dashboard/mentee", week, uid),
      ),
    )
  }

  function refresh() {
    startTransition(() => router.refresh())
  }

  if (mentees.length === 0) return <NoMentees />
  if (!review) return <MenteeDetailsSkeleton />

  const { calendar, currentWeek } = review
  const gridWeeks = calendar.weeks
  const showGrid = !calendar.noActiveWeek && gridWeeks.length > 0

  const currentSummary =
    review.semesterGrid.ok && currentWeek != null
      ? review.semesterGrid.data.find((week) => week.weekNumber === currentWeek) ?? null
      : null

  const selectedSummary = review.selectedWeekReview.ok ? review.selectedWeekReview.data : null
  const titleWeek = selectedWeek ?? currentWeek
  const titleDescriptor =
    titleWeek != null ? gridWeeks.find((week) => week.weekNumber === titleWeek) ?? null : null
  const phase = selectedSummary?.phase
    ? selectedSummary.phase
    : titleWeek == null || currentWeek == null
      ? "current"
      : titleWeek === currentWeek
        ? "current"
        : titleWeek < currentWeek
          ? "past"
          : "future"

  const drafts =
    selectedSummary == null
      ? []
      : buildFollowUpDrafts({
          menteeFirstName: menteeFirstName(review.mentee.fullName),
          menteeEmail: review.mentee.email,
          weekNumber: selectedSummary.weekNumber,
          weekStart: selectedSummary.weekStart,
          weekEnd: selectedSummary.weekEnd,
          phase: selectedSummary.phase,
          hours: selectedSummary.hours,
          wahf: selectedSummary.wahf,
        })
  const draftFor = (id: FollowUpReason) => drafts.find((draft) => draft.id === id) ?? null

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="min-w-0 max-w-full break-words text-[28px] font-semibold leading-tight tracking-tight">
            {review.mentee.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">UID {review.mentee.uid}</p>
        </div>
        {detailPath == null && mentees.length > 1 && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <label htmlFor="mentee-switcher" className="text-sm text-muted-foreground">
              Switch mentee
            </label>
            <Select
              value={review.mentee.uid}
              onValueChange={(uid) => navigate(selectedWeek ?? currentWeek ?? null, uid)}
              disabled={isPending}
            >
              <SelectTrigger
                id="mentee-switcher"
                className="min-h-11 w-56 max-w-full cursor-pointer bg-card shadow-none"
                aria-label="Switch mentee"
              >
                <SelectValue placeholder="Switch mentee" />
              </SelectTrigger>
              <SelectContent>
                {mentees.map((mentee) => (
                  <SelectItem key={mentee.uid} value={mentee.uid}>
                    {mentee.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {detailPath == null &&
        (calendar.noActiveWeek ? (
          <NeutralCard
            title="No active semester week"
            body="Weekly review and the check-in form become available once the semester starts."
          />
        ) : (
          <McfBar
            key={review.mentee.uid}
            menteeUid={review.mentee.uid}
            currentWeek={currentWeek}
            currentWeekSummary={currentSummary}
            meetingPreference={review.meetingPreference}
            onPreferenceSaved={refresh}
            disabled={currentWeek == null}
          />
        ))}

      {showGrid ? (
        <SemesterGrid
          result={review.semesterGrid}
          weeks={gridWeeks}
          selectedWeek={selectedWeek}
          currentWeek={currentWeek}
          pending={isPending}
          onSelect={(week) => navigate(week, review.mentee.uid)}
          onRetry={refresh}
        />
      ) : (
        !calendar.noActiveWeek && (
          <NeutralCard title="Semester overview" body="No semester weeks are available yet." />
        )
      )}

      {isPending ? (
        <MenteeDetailsSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold">
              {titleWeek != null && titleDescriptor
                ? formatWeekTitle(titleWeek, titleDescriptor.startDate, titleDescriptor.endDate)
                : titleWeek != null
                  ? `Week ${titleWeek}`
                  : "This week"}
            </h2>
            {phase === "current" && titleWeek != null && (
              <p className="text-[13px] text-info-muted-foreground">
                In progress · as of {formatAsOf(review.asOf)}
              </p>
            )}
            {phase === "past" && currentWeek != null && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => navigate(currentWeek, review.mentee.uid)}
              >
                Back to this week
              </Button>
            )}
          </div>

          <div className={styles.details}>
            <div
              className={styles.requirements}
              role="group"
              aria-label="Weekly requirements"
            >
              {review.selectedWeekReview.ok && selectedSummary ? (
                <>
                  {selectedSummary.hours.map((hours) => (
                    <HourSummaryCard
                      key={hours.kind}
                      summary={hours}
                      followUp={draftFor(hours.kind === "front_desk" ? "front_desk" : "study_session")}
                    />
                  ))}
                  <WahfSummaryCard
                    summary={selectedSummary.wahf}
                    followUp={draftFor("wahf")}
                  />
                  <TutoringSummaryCard summary={selectedSummary.tutoring} />
                </>
              ) : (
                <div className="col-span-full">
                  {review.selectedWeekReview.ok ? (
                    <NeutralCard
                      title="No active week selected"
                      body="Select a week from the semester overview to review it."
                    />
                  ) : (
                    <SectionError
                      title="Week review"
                      message={review.selectedWeekReview.error.message}
                      retriable={review.selectedWeekReview.error.retriable}
                      onRetry={refresh}
                      pending={isPending}
                    />
                  )}
                </div>
              )}
            </div>

            <aside className={styles.grades} aria-label="Recent grades">
              {review.latestGrades.ok ? (
                <RecentGradesSummaryCard summary={review.latestGrades.data} />
              ) : (
                <SectionError
                  title="Recent grades"
                  message={review.latestGrades.error.message}
                  retriable={review.latestGrades.error.retriable}
                  onRetry={refresh}
                  pending={isPending}
                />
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
