export type HoursBenchmarkArea = "front_desk" | "study_session";

export type HoursBenchmarkScoredWeeks = {
  fromWeek: number;
  throughWeek: number;
};

export type HoursBenchmarkCell = {
  weekNum: number;
  completionPercent: number | null;
  excuseApplied: boolean;
};

export type HoursBenchmarkScholarRow = {
  scholarId: string;
  scholarName: string;
  isSophomore: boolean;
  classYear: "Freshman" | "Sophomore" | null;
  teamLeader: string;
  atOrBelow50Count: number;
  frontDeskByWeek: HoursBenchmarkCell[];
  studySessionByWeek: HoursBenchmarkCell[];
};

export type HoursBenchmarkTeamLeaderRow = {
  teamLeader: string;
  atOrBelow50Events: number;
  studentCount: number;
};

export type HoursBenchmarkLowEvent = {
  weekNum: number;
  weekDateLabel: string;
  area: HoursBenchmarkArea;
  areaLabel: string;
  scholarName: string;
  classYear: string;
  teamLeader: string;
  completionPercent: number;
  excuseApplied: boolean;
};

export type HoursBenchmarkSummary = {
  studentsAtOrBelow50AtLeastOnce: number;
  atOrBelow50Events: number;
  zeroPercentEvents: number;
  studentsMissed80AtLeastOnce: number;
};

export type HoursBenchmarkHeatmapScope = "low" | "all";

export type HoursBenchmarkReport = {
  currentCampusWeek: number;
  scoredWeeks: HoursBenchmarkScoredWeeks | null;
  weekNumbers: number[];
  weekRangeLabel: string;
  dateRangeLabel: string;
  preparedAtLabel: string;
  printedAtSlug: string;
  summary: HoursBenchmarkSummary;
  heatmapScholars: HoursBenchmarkScholarRow[];
  allHeatmapScholars: HoursBenchmarkScholarRow[];
  byTeamLeader: HoursBenchmarkTeamLeaderRow[];
  lowEvents: HoursBenchmarkLowEvent[];
};

export const HOURS_BENCHMARK_AT_OR_BELOW_PERCENT = 50;
export const HOURS_BENCHMARK_MET_PERCENT = 80;
