/**
 * @file front-desk-ampm-config.ts
 * @module shared
 *
 * Configuration and pure helpers for Front Desk AM/PM checklist accountability.
 * Answers exactly one question about a checklist row: did the scholar submit it
 * during the shift they claimed?
 *
 * ## Responsibilities
 * - Declare the three valid Front Desk shift labels (must match the Google Form exactly)
 * - Declare the submission grace windows around a shift
 * - Parse a shift label into a wall-clock window
 * - Decide whether a submission timestamp falls inside that window
 *
 * ## What belongs here
 * - Shift labels, grace constants, and pure functions over them
 *
 * ## What does NOT belong here
 * - HTTP routes, Supabase reads, or UI (see backend form-log routes / dashboard)
 * - Academic calendar dates (that's time-config.ts — do not edit that file)
 * - Front desk Entry/Exit session pairing (deliberately not a dependency; see below)
 *
 * @remarks
 * Grace is **asymmetric**: none before the shift starts, 60 minutes after it ends.
 * A scholar cannot have completed the shift's tasks before the shift began, but
 * filing shortly after finishing is normal.
 *
 * An earlier design compared the submission against the paired front-desk Exit
 * ticket and against "session end" with +/-10 minute windows, producing a
 * four-state verdict. That was dropped as too strict and underspecified; shift
 * validity is the only timing rule. Do not reintroduce it without a product decision.
 *
 * @update Update SHIFT_* labels if the Google Form's shift options change.
 */
import { EASTERN_TIMEZONE, type EasternTimeZone } from "./eastern-time.js";

// ---------------------------------------------------------------------------
// Shift labels — must match the Google Form option strings byte for byte
// ---------------------------------------------------------------------------

export const SHIFT_OPENING = "8:00 AM - 10:00 AM (Opening)";
export const SHIFT_MAIN = "10:00 AM - 6:00 PM";
export const SHIFT_CLOSING = "6:00 PM - 8:00 PM (Closing)";

export const FRONT_DESK_SHIFT_LABELS = [SHIFT_OPENING, SHIFT_MAIN, SHIFT_CLOSING] as const;

export type FrontDeskShiftLabel = (typeof FRONT_DESK_SHIFT_LABELS)[number];

// ---------------------------------------------------------------------------
// Grace windows (minutes). Overridable per call via isCreatedAtWithinShift.
// ---------------------------------------------------------------------------

export const GRACE_BEFORE_START_MINUTES = 0;
export const GRACE_AFTER_END_MINUTES = 60;

/** A shift's wall-clock window, as minutes since Eastern midnight. */
export type ShiftWindow = {
  label: FrontDeskShiftLabel;
  startMinute: number;
  endMinute: number;
};

export type ShiftGraceOptions = {
  graceBeforeStartMinutes?: number;
  graceAfterEndMinutes?: number;
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHIFT_TIME_PATTERN =
  /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i;

function to24Hour(hour12: number, meridiem: string): number {
  return (hour12 % 12) + (meridiem.toUpperCase() === "PM" ? 12 : 0);
}

function isKnownShiftLabel(value: string): value is FrontDeskShiftLabel {
  return (FRONT_DESK_SHIFT_LABELS as readonly string[]).includes(value);
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Minutes since Eastern midnight for an instant, read as **wall-clock** time.
 *
 * Deliberately not `startOfDayEastern + offset`: on the spring-forward day that
 * arithmetic shifts by an hour, so 10:00 AM would read as 11:00 AM.
 */
function easternMinutesSinceMidnight(
  date: Date,
  timeZone: EasternTimeZone = EASTERN_TIMEZONE
): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  // hour12:false can render midnight as "24" in some ICU builds.
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Parse a shift label into its wall-clock window.
 *
 * Returns `null` for anything that is not one of {@link FRONT_DESK_SHIFT_LABELS} —
 * an unrecognised shift means the row cannot be judged, never a thrown error.
 * Times are read out of the label itself so they cannot drift from the string
 * the Google Form shows.
 */
export function parseShiftWindow(shift: string | null | undefined): ShiftWindow | null {
  if (shift == null) return null;
  const label = shift.trim();
  if (!isKnownShiftLabel(label)) return null;

  const match = SHIFT_TIME_PATTERN.exec(label);
  if (!match) return null;

  const [, startHour, startMinute, startMeridiem, endHour, endMinute, endMeridiem] = match;
  return {
    label,
    startMinute: to24Hour(Number(startHour), startMeridiem) * 60 + Number(startMinute),
    endMinute: to24Hour(Number(endHour), endMeridiem) * 60 + Number(endMinute),
  };
}

/**
 * Did this submission land inside the claimed shift (plus grace)?
 *
 * Every `am_pm_form_logs` column is nullable, so null/unparseable input is
 * simply `false` — the caller renders "shift not valid", not a 500.
 */
export function isCreatedAtWithinShift(
  createdAt: string | Date | null | undefined,
  shift: string | null | undefined,
  options: ShiftGraceOptions = {}
): boolean {
  const window = parseShiftWindow(shift);
  if (!window) return false;

  const submittedAt = toDate(createdAt);
  if (!submittedAt) return false;

  const graceBefore = options.graceBeforeStartMinutes ?? GRACE_BEFORE_START_MINUTES;
  const graceAfter = options.graceAfterEndMinutes ?? GRACE_AFTER_END_MINUTES;
  const submittedMinute = easternMinutesSinceMidnight(submittedAt);

  return (
    submittedMinute >= window.startMinute - graceBefore &&
    submittedMinute <= window.endMinute + graceAfter
  );
}

/**
 * Whether someone owes this scholar a follow-up.
 *
 * Trivial today, but kept as the single definition so the deferred reminder
 * mailer imports the rule instead of re-deriving it.
 */
export function computeReminderOwed(shiftValid: boolean): boolean {
  return !shiftValid;
}
