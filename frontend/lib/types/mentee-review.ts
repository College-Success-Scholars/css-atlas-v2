/**
 * View types for the mentee review screens. The wire shapes (everything the
 * API sends, with instants as ISO strings) come from
 * @css-atlas/shared/contracts/mentees; this file holds only what the frontend
 * derives from them.
 */
import type {
  SectionResult,
  HourWeekSummary as WireHourWeekSummary,
  MenteeReview as WireMenteeReview,
  WeekReviewSummary as WireWeekReviewSummary,
} from "@css-atlas/shared/contracts/mentees"

/** Display-only completion tier earned independently by an hourly requirement. */
export type WeekTier = "rare" | "epic" | "legendary"

/** An hourly requirement as the API sends it, plus the tier `applyWeekTiers` derives. */
export type HourWeekSummary = WireHourWeekSummary & {
  /** Derived from this requirement's logged minutes by `applyWeekTiers`; not an API field. */
  readonly tier?: WeekTier | null
}

export type WeekReviewSummary = Omit<WireWeekReviewSummary, "hours"> & {
  readonly hours: ReadonlyArray<HourWeekSummary>
}

/** The loaded review, once `applyWeekTiers` has decorated its weeks. A raw API review fits it too. */
export type MenteeReview = Omit<WireMenteeReview, "semesterGrid" | "selectedWeekReview"> & {
  readonly semesterGrid: SectionResult<ReadonlyArray<WeekReviewSummary>>
  readonly selectedWeekReview: SectionResult<WeekReviewSummary | null>
}

/** Switcher option from GET /api/auth/mentees (no compliance data). */
export interface MenteeOption {
  uid: string
  fullName: string
  email: string | null
}

export interface MenteeReviewClientProps {
  mentees: MenteeOption[];
  /** Null when the caller has no assigned mentees. */
  review: MenteeReview | null;
  /** Selected campus week from the URL `week` param. */
  selectedWeek: number | null;
  /**
   * Directory detail view path. When present, hides the mentee switcher and
   * MCF bar and keeps week navigation on that path.
   */
  detailPath?: string;
  /**
   * Optional in-place week navigation (e.g. modal hosts). When set, used
   * instead of router.push for semester-grid / mentee switches.
   */
  onNavigateWeek?: (week: number | null, uid: string) => void;
}
