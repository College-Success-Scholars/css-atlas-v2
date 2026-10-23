import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log";
import { EASTERN_TIMEZONE, parseEasternDate } from "@/lib/format/time";

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIMEZONE, weekday: "short", month: "short", day: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EASTERN_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function dateKey(date: Date): string {
  const parts = dateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Only timestamps with an explicit zone are instants, never browser-local dates. */
function timestamp(value: string | null): Date | null {
  const text = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text) || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return null;
  if (!validDay(text.slice(0, 10))) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

function clockSeconds(value: string): number | null {
  const text = value?.trim() ?? "";
  const instant = timestamp(text);
  if (instant) {
    const parts = clockFormatter.formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
    return part("hour") * 3600 + part("minute") * 60 + part("second");
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i.exec(text);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (minute > 59 || second > 59) return null;
  if (match[4]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (match[4].toUpperCase() === "PM" ? 12 : 0);
  } else if (hour > 23) return null;
  return hour * 3600 + minute * 60 + second;
}

export function normalizeCourses(courses: string[]): string[] {
  return [...new Set(courses.map((course) => course.toUpperCase().replace(/\s/g, "")).filter(Boolean))];
}

export function scholarStatus(row: TutorReportWeekRow): "none" | "matched" | "unmatched" {
  const uid = row.scholar_uid?.trim() ?? "";
  const name = row.scholar_name?.trim() ?? "";
  if (!uid || /^(?:n\/a|111111111)$/i.test(uid) || /^EMPTY SESSION$/i.test(name)) return "none";
  return !name || name === uid ? "unmatched" : "matched";
}

export function scholarLabel(row: TutorReportWeekRow): string {
  const status = scholarStatus(row);
  return status === "none" ? "—" : status === "unmatched" ? "Unmatched ID" : row.scholar_name.trim();
}

export function getSessionDay(row: TutorReportWeekRow): { key: string; label: string } {
  const value = row.date?.trim() ?? "";
  // Noon UTC stays on the supplied Eastern calendar day, even on DST Sundays.
  const instant = validDay(value) ? new Date(`${value}T12:00:00Z`) : timestamp(value) ?? timestamp(row.start_time);
  return instant ? { key: dateKey(instant), label: dayFormatter.format(instant) } : { key: "unknown", label: "Unknown day" };
}

export function sessionStartMinutes(row: TutorReportWeekRow): number | null {
  const seconds = clockSeconds(row.start_time);
  return seconds === null ? null : seconds / 60;
}

/** Scheduled clock duration, not elapsed DST hours or receipt-to-start time. */
export function sessionDurationMinutes(row: TutorReportWeekRow): number | null {
  const start = clockSeconds(row.start_time);
  const end = clockSeconds(row.end_time);
  if (start === null || end === null) return null;
  return (end - start + (end < start ? 86400 : 0)) / 60;
}

export function normalizedTutor(row: TutorReportWeekRow): string {
  return row.tutor_name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function sessionBlockKey(row: TutorReportWeekRow): string {
  const day = getSessionDay(row).key;
  const start = clockSeconds(row.start_time);
  const end = clockSeconds(row.end_time);
  // Incomplete evidence must not merge separate receipts into a claimed session.
  const incomplete = day === "unknown" || start === null || end === null || !normalizedTutor(row);
  return JSON.stringify([normalizedTutor(row), day, start, end, ...(incomplete ? [row.id] : [])]);
}

export function compareSessions(a: TutorReportWeekRow, b: TutorReportWeekRow): number {
  return getSessionDay(a).key.localeCompare(getSessionDay(b).key)
    || (sessionStartMinutes(a) ?? Infinity) - (sessionStartMinutes(b) ?? Infinity)
    || normalizedTutor(a).localeCompare(normalizedTutor(b))
    || a.id - b.id;
}

export function formatTutorMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return [hours ? `${hours} hr` : "", remainder || !hours ? `${remainder} min` : ""].filter(Boolean).join(" ");
}

function clockLabel(seconds: number): { time: string; period: string } {
  const hour = Math.floor(seconds / 3600);
  return { time: `${hour % 12 || 12}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}`, period: hour >= 12 ? "PM" : "AM" };
}

export function tutoringSessionTimeLabel(row: TutorReportWeekRow): string {
  const start = clockSeconds(row.start_time);
  const end = clockSeconds(row.end_time);
  if (start === null || end === null) return "Time unavailable";
  const a = clockLabel(start);
  const b = clockLabel(end);
  return `${a.time}${a.period === b.period ? "" : ` ${a.period}`}–${b.time} ${b.period}`;
}

export function tutoringSessionSummary(row: TutorReportWeekRow): string {
  const duration = sessionDurationMinutes(row);
  return `${getSessionDay(row).label} · ${tutoringSessionTimeLabel(row)}${duration === null ? "" : ` (${formatTutorMinutes(duration)})`}`;
}

/** Resolve a wall clock using shared Eastern dates and Intl, without fixed EST/EDT offsets. */
function easternClockInstant(day: string, seconds: number): Date | null {
  const seed = parseEasternDate(day).getTime() + seconds * 1000;
  // Shared midnight arithmetic can straddle a DST change. Verify candidates
  // against their actual Eastern wall clock; reject nonexistent spring times.
  const matches: Date[] = [];
  for (const hours of [-2, -1, 0, 1, 2]) {
    const candidate = new Date(seed + hours * 3600000);
    if (dateKey(candidate) === day && clockSeconds(candidate.toISOString()) === seconds) matches.push(candidate);
  }
  // A repeated fall clock has no offset in the source: use the first occurrence.
  return matches[0] ?? null;
}

function nextDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function receiptTimingLabel(row: TutorReportWeekRow): string {
  const receipt = timestamp(row.created_at);
  const day = getSessionDay(row).key;
  const start = clockSeconds(row.start_time);
  const end = clockSeconds(row.end_time);
  if (!receipt || day === "unknown" || start === null || end === null) return "Receipt timing unavailable";
  const ended = timestamp(row.end_time) ?? easternClockInstant(end < start ? nextDay(day) : day, end);
  if (!ended) return "Receipt timing unavailable";
  const delta = receipt.getTime() - ended.getTime();
  if (delta === 0) return "Received when session ended";
  return `Received ${formatTutorMinutes(Math.abs(delta) / 60000)} ${delta < 0 ? "before" : "after"} session ended`;
}
