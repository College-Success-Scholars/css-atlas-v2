import { EASTERN_TIMEZONE, getEasternDateParts } from "./time.service.js";
import { SHIFT_GRACE_MINUTES } from "../models/session-log.model.js";
import type { ScholarShiftAssignment, SessionLogRow } from "../models/session-log.model.js";

const MS_PER_MINUTE = 60 * 1000;

export interface ShiftOccurrenceMatch {
  entry: SessionLogRow | null;
  exit: SessionLogRow | null;
  scheduledStart: Date;
  scheduledEnd: Date;
}

export function easternTimestamp(date: Date, time: string): Date {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) throw new Error(`Invalid shift time: ${time}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) throw new Error(`Invalid shift time: ${time}`);

  const { year, month, day } = getEasternDateParts(date);
  const targetWallTime = Date.UTC(year, month, day, hour, minute, second);
  let timestamp = targetWallTime;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(timestamp));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const observedWallTime = Date.UTC(
      value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second")
    );
    const adjustment = targetWallTime - observedWallTime;
    if (adjustment === 0) break;
    timestamp += adjustment;
  }
  return new Date(timestamp);
}

export function findShiftOccurrenceMatch(
  assignment: ScholarShiftAssignment,
  occurrenceDate: Date,
  rows: SessionLogRow[]
): ShiftOccurrenceMatch {
  const scheduledStart = easternTimestamp(occurrenceDate, assignment.start_time);
  const scheduledEnd = easternTimestamp(occurrenceDate, assignment.end_time);
  const graceStart = scheduledStart.getTime() - SHIFT_GRACE_MINUTES * MS_PER_MINUTE;
  const graceEnd = scheduledEnd.getTime() + SHIFT_GRACE_MINUTES * MS_PER_MINUTE;
  const scholarRows = rows
    .filter((row) => row.scholar_uid === assignment.scholar_id)
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  const entry = scholarRows.find(
    (row) => row.action_type?.trim() === "Entry" && new Date(row.created_at).getTime() >= graceStart && new Date(row.created_at).getTime() <= graceEnd
  ) ?? null;
  if (!entry) return { entry: null, exit: null, scheduledStart, scheduledEnd };

  const exit = scholarRows.find(
    (row) => row.action_type?.trim() === "Exit" && new Date(row.created_at).getTime() > new Date(entry.created_at).getTime()
  ) ?? null;
  return { entry, exit, scheduledStart, scheduledEnd };
}
