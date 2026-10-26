/**
 * @file tiers.ts
 * @module frontend/lib
 *
 * Pure completion-tier rules for the mentee weekly review.
 *
 * A tier applies to a whole week only when BOTH the front desk and study
 * session requirements are above their class-year cutoff. Tiers use logged
 * minutes only (excused minutes still affect the existing green/amber/red
 * bands, but never earn a tier). Rules stay free of Supabase, React, and
 * ambient state so they can run on the server or in tests unchanged.
 *
 * ## What belongs here
 * - Cutoffs, class-year derivation, weekly tier calculation
 * - Attaching derived tiers to an already-loaded review payload
 *
 * ## What does NOT belong here
 * - Database reads or writes
 * - Grid/card styling
 */
import type {
  MenteeReview,
  WeekReviewSummary,
  WeekTier,
} from "@/lib/types/mentee-review"

export const TIER_CUTOFFS = {
  0: { rare: 105, epic: 115, legendary: 125 },
  1: { rare: 115, epic: 135, legendary: 155 },
} as const
// Recalibrate each semester from last semester's data. Targets: roughly
// 15% / 5% / 1–2% of a cohort's weeks.

/**
 * Temporary frontend-only fallback. The review payload does not carry cohort
 * yet, so use the freshman cutoffs until that data is available.
 */
export const DEFAULT_CLASS_YEAR = 0

export interface WeekTierInput {
  fdMinutes: number
  ssMinutes: number
  fdRequired: number
  ssRequired: number
  classYear: number
}

/**
 * Academic class year: 0 = freshman, 1 = sophomore, 2 = junior, etc.
 * The academic year starts in August; a spring semester belongs to the
 * academic year that began the previous August.
 *
 * Uses UTC parts because semester bounds are program-local midnights stored
 * as ISO instants (04:00/05:00Z), so the UTC calendar date always matches the
 * Eastern start date.
 */
export function getClassYear(cohort: number, semesterStart: Date): number {
  const year = semesterStart.getUTCFullYear()
  const month = semesterStart.getUTCMonth()
  const academicStartYear = month >= 7 ? year : year - 1
  return academicStartYear - cohort
}

/** Highest tier met, or null when either requirement is missing or not both are met. */
export function getWeekTier({
  fdMinutes,
  ssMinutes,
  fdRequired,
  ssRequired,
  classYear,
}: WeekTierInput): WeekTier | null {
  if (
    !Number.isFinite(fdMinutes) ||
    !Number.isFinite(ssMinutes) ||
    !Number.isFinite(fdRequired) ||
    !Number.isFinite(ssRequired) ||
    !Number.isFinite(classYear)
  ) {
    return null
  }
  if (fdRequired <= 0 || ssRequired <= 0) return null

  const cutoffs =
    classYear === 0 ? TIER_CUTOFFS[0] : classYear === 1 ? TIER_CUTOFFS[1] : null
  if (!cutoffs) return null

  const completion = Math.min(fdMinutes / fdRequired, ssMinutes / ssRequired) * 100
  // Binary floating point makes exact cutoffs such as 1.15 * 100 land at
  // 114.99999999999999; a tiny epsilon keeps "exactly at the cutoff" honest.
  const atOrAbove = (cutoff: number) => completion + 1e-9 >= cutoff
  if (atOrAbove(cutoffs.legendary)) return "legendary"
  if (atOrAbove(cutoffs.epic)) return "epic"
  if (atOrAbove(cutoffs.rare)) return "rare"
  return null
}

/** Tier for one assembled week summary, using the evaluator's logged minutes and targets. */
export function getSummaryTier(
  week: WeekReviewSummary,
  classYear: number,
): WeekTier | null {
  const frontDesk = week.hours.find((entry) => entry.kind === "front_desk")
  const study = week.hours.find((entry) => entry.kind === "study_session")
  if (!frontDesk || !study) return null

  return getWeekTier({
    fdMinutes: frontDesk.loggedMinutes,
    ssMinutes: study.loggedMinutes,
    fdRequired: frontDesk.targetMinutes ?? 0,
    ssRequired: study.targetMinutes ?? 0,
    classYear,
  })
}

/**
 * Attach the display-only tier to every already-loaded week. This is the one
 * place the grid and detail cards get their tier from, so they cannot disagree.
 */
export function applyWeekTiers(
  review: MenteeReview,
  cohortOverride: number | null = null,
): MenteeReview {
  const semesterStart = review.calendar.semesterStart
  const cohort = cohortOverride ?? review.mentee.cohort ?? null
  const classYear =
    semesterStart == null
      ? null
      : cohort != null
        ? getClassYear(cohort, new Date(semesterStart))
        : DEFAULT_CLASS_YEAR

  const decorate = (week: WeekReviewSummary): WeekReviewSummary => ({
    ...week,
    tier: classYear == null ? null : getSummaryTier(week, classYear),
  })

  return {
    ...review,
    semesterGrid: review.semesterGrid.ok
      ? { ...review.semesterGrid, data: review.semesterGrid.data.map(decorate) }
      : review.semesterGrid,
    selectedWeekReview:
      review.selectedWeekReview.ok && review.selectedWeekReview.data
        ? { ...review.selectedWeekReview, data: decorate(review.selectedWeekReview.data) }
        : review.selectedWeekReview,
  }
}
