/* eslint-disable @next/next/no-html-link-for-pages -- Isolated Vite browser fixture, not a Next route. */
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import "../../app/globals.css"
import { HourSummaryCard } from "../../components/mentee-monitoring/hour-summary-card"
import { McfBar } from "../../components/mentee-monitoring/mcf-bar"
import { SemesterGrid } from "../../components/mentee-monitoring/semester-grid"
import styles from "../../components/mentee-monitoring/mentee-review.module.css"
import { getHourTier } from "../../lib/tiers"
import type { HourWeekSummary, WeekDescriptor, WeekReviewSummary, WeekTier } from "../../lib/types/mentee-review"

// Synthetic data only. This fixture never calls auth, the API, or a database.
const tiers: WeekTier[] = ["rare", "epic", "legendary"]
const hours = (kind: HourWeekSummary["kind"], tier: WeekTier | null = null): HourWeekSummary => ({
  kind, tier, assignmentAvailable: true, targetMinutes: 180, loggedMinutes: 270,
  excuseMinutes: 0, excuseDescription: null,
  displayHours: 4.5, hasActivity: true, percent: 150, band: "green",
  pending: false, overageMinutes: 90, noShowCount: 0, shifts: [], offShiftLogs: [],
})
const weeks: WeekDescriptor[] = tiers.map((_, index) => ({
  weekNumber: index + 1, startDate: "2026-09-07", endDate: "2026-09-13",
  isBreak: false, isCurrent: index === 2, isFuture: false, isSelectable: true,
}))
const summaries: WeekReviewSummary[] = tiers.map((tier, index) => ({
  weekNumber: index + 1, weekStart: "2026-09-07", weekEnd: "2026-09-13",
  phase: index === 2 ? "current" : "past",
  hours: [hours("front_desk", tier), hours("study_session", tier)],
  wahf: { status: "submitted", dueAt: "2026-09-13T23:59:00Z", submittedAt: null, onTime: true, submissionId: null },
  tutoring: { status: "recorded", recordedAttendance: true, reports: [] },
}))

const independentHours = ([
  ["front_desk", 182.83, 180],
  ["study_session", 502.06, 300],
] as const).map(([kind, loggedMinutes, targetMinutes]): HourWeekSummary => ({
  ...hours(kind), loggedMinutes, targetMinutes,
  displayHours: loggedMinutes / 60, percent: loggedMinutes / targetMinutes * 100,
  overageMinutes: Math.round(loggedMinutes - targetMinutes),
  tier: getHourTier({ loggedMinutes, targetMinutes, classYear: 0 }),
}))

function App() {
  const [path, setPath] = useState(location.pathname)
  const [selectedWeek, setSelectedWeek] = useState(3)
  const [selectionCount, setSelectionCount] = useState(0)
  useEffect(() => {
    const onPopState = () => setPath(location.pathname)
    addEventListener("popstate", onPopState)
    return () => removeEventListener("popstate", onPopState)
  }, [])
  const review = path === "/dashboard/mentee" || path === "/dashboard/directory/scholar"
  const independent = new URLSearchParams(location.search).has("independent")
  const shownWeeks = independent ? [weeks[2]] : weeks
  const shownSummaries = independent ? [{ ...summaries[2], hours: independentHours }] : summaries
  return <div onClick={(event) => {
    const link = (event.target as Element).closest("a")
    if (!link) return
    event.preventDefault()
    history.pushState(null, "", link.pathname)
    setPath(link.pathname)
  }}>
    <nav>
      <a href="/dashboard/mentee">Mentee</a>{" | "}
      <a href="/dashboard/memo">Memo</a>{" | "}
      <a href="/dashboard/directory">Directory</a>
    </nav>
    <main data-view={path} className={styles.surface}>
      {review ? <>
        <div data-testid="mcf-banner">
          <McfBar menteeUid="fixture-scholar" currentWeek={3} currentWeekSummary={summaries[2]}
            meetingPreference={{ ok: true, data: { weekday: 3, meetingTime: "15:00" }, loadedAt: "2026-09-13T12:00:00Z" }}
            onPreferenceSaved={() => {}} disabled={false} />
        </div>
        <output data-selected-week={selectedWeek} data-selection-count={selectionCount} className="sr-only">Week {selectedWeek}</output>
        <SemesterGrid result={{ ok: true, data: shownSummaries, loadedAt: "2026-09-13T12:00:00Z" }} weeks={shownWeeks} selectedWeek={selectedWeek}
          currentWeek={3} pending={false} onSelect={(week) => { setSelectedWeek(week); setSelectionCount((count) => count + 1) }} onRetry={() => {}} />
        {independent ? <section data-testid="hour-cards" className={styles.requirements} style={{ maxWidth: 640 }}>
          {independentHours.map(summary => <HourSummaryCard key={summary.kind} summary={summary} tier={summary.tier} />)}
        </section> : tiers.map(tier => <section key={tier} data-testid="hour-cards" className={styles.requirements} style={{ maxWidth: 640 }}>
          <HourSummaryCard summary={hours("front_desk", tier)} tier={tier} />
          <HourSummaryCard summary={hours("study_session", tier)} tier={tier} />
        </section>)}
      </> : <a href="/dashboard/directory/scholar">Scholar</a>}
    </main>
  </div>
}

createRoot(document.getElementById("root")!).render(<App />)
