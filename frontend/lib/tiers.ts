/**
 * @file tiers.ts
 * @module frontend/lib
 *
 * Pure completion-tier rules for the mentee weekly review.
 *
 * Each hourly requirement earns its own tier against its class-year cutoff.
 * Front desk never suppresses study-session tiers (or vice versa). Tiers use
 * logged minutes only (excused minutes still affect the existing green/amber/red
 * bands, but never earn a tier). Rules stay free of Supabase, React, and ambient
 * state so they can run on the server or in tests unchanged.
 *
 * ## What belongs here
 * - Cutoffs, class-year derivation, per-requirement tier calculation
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
 * Compatibility fallback for older review payloads without a roster cohort.
 */
export const DEFAULT_CLASS_YEAR = 0

export interface HourTierInput {
  loggedMinutes: number
  targetMinutes: number | null
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

/** Highest tier earned by this requirement's actual logged minutes. */
export function getHourTier({
  loggedMinutes,
  targetMinutes,
  classYear,
}: HourTierInput): WeekTier | null {
  if (
    !Number.isFinite(loggedMinutes) ||
    targetMinutes == null ||
    !Number.isFinite(targetMinutes) ||
    !Number.isFinite(classYear)
  ) {
    return null
  }
  if (targetMinutes <= 0 || loggedMinutes < 0) return null

  const cutoffs =
    classYear === 0 ? TIER_CUTOFFS[0] : classYear === 1 ? TIER_CUTOFFS[1] : null
  if (!cutoffs) return null

  const completion = (loggedMinutes / targetMinutes) * 100
  // Binary floating point makes exact cutoffs such as 1.15 * 100 land at
  // 114.99999999999999; a tiny epsilon keeps "exactly at the cutoff" honest.
  const atOrAbove = (cutoff: number) => completion + 1e-9 >= cutoff
  if (atOrAbove(cutoffs.legendary)) return "legendary"
  if (atOrAbove(cutoffs.epic)) return "epic"
  if (atOrAbove(cutoffs.rare)) return "rare"
  return null
}

/**
 * Attach display-only tiers to each hourly requirement in the loaded weeks.
 * The grid and detail cards share this data path so their tiers cannot disagree.
 */
export function applyWeekTiers(
  review: MenteeReview,
  cohortOverride: number | null = null,
): MenteeReview {
  const semesterStart = review.calendar.semesterStart
  const cohort = review.mentee.cohort ?? cohortOverride ?? null
  const classYear =
    semesterStart == null
      ? null
      : cohort != null
        ? getClassYear(cohort, new Date(semesterStart))
        : DEFAULT_CLASS_YEAR

  const decorate = (week: WeekReviewSummary): WeekReviewSummary => ({
    ...week,
    hours: week.hours.map((hours) => ({
      ...hours,
      tier: classYear == null || week.phase === "future"
        ? null
        : getHourTier({
            loggedMinutes: hours.loggedMinutes,
            targetMinutes: hours.targetMinutes,
            classYear,
          }),
    })),
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
