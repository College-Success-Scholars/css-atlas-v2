import {
  EASTERN_TIMEZONE,
  addEasternCalendarDays,
  campusWeekToDateRange,
  getEasternDayOfWeek,
  isHourEligibleCohort,
  parseEasternDate,
} from "@/lib/format/time";
import type { BoardScholar, DayShiftBlock, SessionKind, StandingShift } from "./types";

/** Minutes required for the selected kind on a board roster row. */
export function requiredMinutesForKind(
  scholar: Pick<BoardScholar, "fd_required" | "ss_required">,
  kind: SessionKind,
): number {
  return kind === "front_desk" ? scholar.fd_required : scholar.ss_required;
}

/**
 * Who appears on a board for kind K — same rule as backend
 * isEligibleScholar filtered by required minutes for that kind.
 * Server already returns hour-eligible enrolled scholars; this narrows by kind.
 */
export function filterScholarsForKind(
  scholars: BoardScholar[],
  kind: SessionKind,
): BoardScholar[] {
  return scholars.filter(
    (s) => isHourEligibleCohort(s.cohort) && requiredMinutesForKind(s, kind) > 0,
  );
}

export function parseHhMm(time: string): number {
  const [h, m] = time.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function durationHours(startTime: string, endTime: string): number {
  const mins = Math.max(0, parseHhMm(endTime) - parseHhMm(startTime));
  return Math.round((mins / 60) * 100) / 100;
}

export function formatDurationLabel(hours: number): string {
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours}h`;
}

export function easternDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: EASTERN_TIMEZONE });
}

/** Mon–Fri YYYY-MM-DD keys for a campus week (CSSAtlas attendance week). */
export function weekdayDatesForCampusWeek(weekNum: number): string[] {
  const range = campusWeekToDateRange(weekNum);
  if (!range) return [];
  const dates: string[] = [];
  for (let offset = 0; offset < 5; offset++) {
    dates.push(easternDateKey(addEasternCalendarDays(range.startDate, offset)));
  }
  return dates;
}

export function addCalendarDaysToDateKey(dateKey: string, days: number): string {
  const base = parseEasternDate(dateKey);
  return easternDateKey(addEasternCalendarDays(base, days));
}

export function formatDateHeading(dateKey: string): string {
  const d = parseEasternDate(dateKey);
  return d.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatWeekdayColumn(dateKey: string): { weekday: string; dayNum: string } {
  const d = parseEasternDate(dateKey);
  return {
    weekday: d.toLocaleDateString("en-US", {
      timeZone: EASTERN_TIMEZONE,
      weekday: "short",
    }),
    dayNum: d.toLocaleDateString("en-US", {
      timeZone: EASTERN_TIMEZONE,
      day: "numeric",
    }),
  };
}

function expandStandingForDate(
  scholar: BoardScholar,
  dateKey: string,
  kind: SessionKind,
): DayShiftBlock[] {
  const date = parseEasternDate(dateKey);
  const dow = getEasternDayOfWeek(date);
  return scholar.shifts
    .filter((shift) => shift.kind === kind && shift.dayOfWeek === dow)
    .map((shift) => toDayBlock(scholar, shift, dateKey));
}

function toDayBlock(
  scholar: BoardScholar,
  shift: StandingShift,
  dateKey: string,
): DayShiftBlock {
  return {
    ...shift,
    scholarUid: scholar.uid,
    scholarName: scholar.name,
    date: dateKey,
    durationHours: durationHours(shift.startTime, shift.endTime),
  };
}

/** Expand standing templates onto one calendar day for the selected kind. */
export function expandDayShifts(
  scholars: BoardScholar[],
  dateKey: string,
  kind: SessionKind,
): DayShiftBlock[] {
  const eligible = filterScholarsForKind(scholars, kind);
  return eligible.flatMap((scholar) => expandStandingForDate(scholar, dateKey, kind));
}

/**
 * Day board row order: earliest shift start first, then name.
 * Scholars with no shifts that day sink to the bottom (still name-sorted).
 */
export function sortScholarsByEarliestShift(
  scholars: BoardScholar[],
  blocks: DayShiftBlock[],
): BoardScholar[] {
  const earliest = new Map<string, number>();
  for (const block of blocks) {
    const mins = parseHhMm(block.startTime);
    const prev = earliest.get(block.scholarUid);
    if (prev == null || mins < prev) earliest.set(block.scholarUid, mins);
  }

  return [...scholars].sort((a, b) => {
    const aStart = earliest.get(a.uid);
    const bStart = earliest.get(b.uid);
    if (aStart == null && bStart == null) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    if (aStart == null) return 1;
    if (bStart == null) return -1;
    if (aStart !== bStart) return aStart - bStart;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function shiftsForScholarOnDate(
  scholar: BoardScholar,
  dateKey: string,
  kind: SessionKind,
): DayShiftBlock[] {
  if (requiredMinutesForKind(scholar, kind) <= 0) return [];
  if (!isHourEligibleCohort(scholar.cohort)) return [];
  return expandStandingForDate(scholar, dateKey, kind);
}

export function weeklyScheduledHours(
  scholar: BoardScholar,
  weekDates: string[],
  kind: SessionKind,
): number {
  let total = 0;
  for (const dateKey of weekDates) {
    for (const block of shiftsForScholarOnDate(scholar, dateKey, kind)) {
      total += block.durationHours;
    }
  }
  return Math.round(total * 100) / 100;
}

export function kindLabel(kind: SessionKind): string {
  return kind === "front_desk" ? "Front Desk" : "Study Session";
}

/**
 * Domain surface classes for FD (orange `--front-desk`) and SS (blue `--study`).
 * Shifts shorter than 1 hour use destructive red on both kinds.
 */
export function sessionKindSurfaceClass(
  kind: SessionKind,
  durationHours?: number,
): string {
  if (durationHours != null && durationHours < 1) {
    return "border-destructive/60 bg-destructive/25 text-destructive";
  }
  return kind === "front_desk"
    ? "border-front-desk/55 bg-front-desk/30 text-foreground"
    : "border-study/55 bg-study/30 text-foreground";
}
