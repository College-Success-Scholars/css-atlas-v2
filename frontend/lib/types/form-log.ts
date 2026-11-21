/** Frontend-only view types for form logs. Wire types live in @css-atlas/shared/contracts/form-logs. */
export type { TeamLeaderFormStatsRow } from "@css-atlas/shared/contracts/form-logs";

export type GradeEntry = {
  scholarName: string;
  /** WAHF submitter UID; absent on legacy/mock rows. */
  scholarId?: string | null;
  /** Entry year attached by the weekly memo so detail-page tiers use the right class. */
  cohort?: number | null;
  /** True when mentor_mentee has at least one row for the submitter. */
  isMentee?: boolean;
  course: string;
  assessment: string;
  grade: string;
  percent: number;
};

export type GradeBreakdown = {
  high: GradeEntry[];
  mid: GradeEntry[];
  low: GradeEntry[];
};
