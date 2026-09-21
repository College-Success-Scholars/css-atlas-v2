import {
  EASTERN_TIMEZONE,
  addEasternCalendarDays,
  getEasternDateParts,
  getStartOfDayEastern,
  parseEasternDate,
} from "@/lib/format/time"

const MAX_STAY_MINUTES = 720

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 min"
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs <= 0) return `${mins} min`
  if (mins <= 0) return `${hrs} hr`
  return `${hrs} hr ${mins} min`
}

export function formatEstimatedExit(
  minutes: number,
  /** Wall clock to project from; pass a ticking value so kiosk UI stays current. */
  now: Date | number = Date.now()
): string {
  if (!minutes || minutes <= 0) return "--:-- --"
  const baseMs = typeof now === "number" ? now : now.getTime()
  const estimated = new Date(baseMs + minutes * 60 * 1000)
  return estimated.toLocaleTimeString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Display leave-at as a 12-hour Eastern wall clock (e.g. "4:30 PM"). */
export function formatLeaveAtClock(leaveAt: Date): string {
  return leaveAt.toLocaleTimeString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Parse a typed wall-clock string to 24h `HH:mm`.
 * Accepts `4:30 PM`, `4:30pm`, `16:30`, `4:30` (24h if hour 0–23).
 */
export function parseTypedLeaveAtClock(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, " ")
  if (!s) return null

  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (m12) {
    let hour = Number(m12[1])
    const minute = Number(m12[2])
    const period = m12[3]
    if (hour < 1 || hour > 12 || minute > 59) return null
    if (period === "AM") {
      if (hour === 12) hour = 0
    } else if (hour !== 12) {
      hour += 12
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  }

  const m24 = s.match(/^(\d{1,2}):(\d{2})$/)
  if (m24) {
    const hour = Number(m24[1])
    const minute = Number(m24[2])
    if (hour > 23 || minute > 59) return null
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  }

  return null
}

/** Digits + period for the leave-at mask (`_:__ AM`). */
export type LeaveAtMaskParts = {
  hour: string
  minute: string
  period: "AM" | "PM"
}

export function leaveAtToMaskParts(leaveAt: Date): LeaveAtMaskParts {
  const formatted = formatLeaveAtClock(leaveAt)
  const m = formatted.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return { hour: "", minute: "", period: "PM" }
  return {
    hour: m[1]!,
    minute: m[2]!,
    period: m[3]!.toUpperCase() as "AM" | "PM",
  }
}

/** Visual mask with fixed colon, e.g. `_:__ PM` → `3:4_ PM` → `3:46 PM`. */
export function formatLeaveAtMask(parts: LeaveAtMaskParts): string {
  const hour = parts.hour === "" ? "_" : parts.hour
  const minute =
    parts.minute.length === 0
      ? "__"
      : parts.minute.length === 1
        ? `${parts.minute}_`
        : parts.minute.slice(0, 2)
  return `${hour}:${minute} ${parts.period}`
}

export function parseLeaveAtMask(parts: LeaveAtMaskParts): string | null {
  if (!parts.hour || parts.minute.length !== 2) return null
  return parseTypedLeaveAtClock(`${parts.hour}:${parts.minute} ${parts.period}`)
}

/** Keep only digits; clamp hour 1–12 and minute 0–59 as they type. */
export function sanitizeLeaveAtMaskHour(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 2)
  if (digits === "") return ""
  if (digits.length === 1) {
    const n = Number(digits)
    return n >= 1 && n <= 9 ? digits : ""
  }
  const n = Number(digits)
  if (n >= 1 && n <= 12) return digits
  // e.g. typed "15" → keep first digit if valid
  const first = digits[0]!
  return Number(first) >= 1 && Number(first) <= 9 ? first : ""
}

export function sanitizeLeaveAtMaskMinute(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 2)
  if (digits === "") return ""
  if (digits.length === 1) {
    return Number(digits) <= 5 ? digits : ""
  }
  const n = Number(digits)
  return n <= 59 ? digits : digits[0]!
}

/** HH:mm value for internal 24h leave-at parsing in Eastern. */
export function leaveAtToTimeInputValue(leaveAt: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(leaveAt)
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
  const h = hour === "24" ? "00" : hour.padStart(2, "0")
  return `${h}:${minute.padStart(2, "0")}`
}

function toEasternDateKey(d: Date): string {
  const { year, month, day } = getEasternDateParts(d)
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Combine YYYY-MM-DD + HH:mm as America/New_York wall clock. */
export function parseEasternDateTime(dayKey: string, timeHm: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || !/^\d{2}:\d{2}$/.test(timeHm)) {
    throw new Error(`Invalid Eastern date/time: ${dayKey} ${timeHm}`)
  }
  const [hours, minutes] = timeHm.split(":").map(Number)
  const dayStart = parseEasternDate(dayKey)
  return new Date(dayStart.getTime() + (hours! * 60 + minutes!) * 60 * 1000)
}

/**
 * Interpret HH:mm as the next Eastern occurrence at/after `now`
 * (today if still ahead; otherwise tomorrow).
 */
export function parseLeaveAtTimeInput(
  timeHm: string,
  now: Date = new Date()
): Date {
  const todayKey = toEasternDateKey(getStartOfDayEastern(now))
  let leaveAt = parseEasternDateTime(todayKey, timeHm)
  if (leaveAt.getTime() <= now.getTime()) {
    const tomorrow = addEasternCalendarDays(getStartOfDayEastern(now), 1)
    leaveAt = parseEasternDateTime(toEasternDateKey(tomorrow), timeHm)
  }
  return leaveAt
}

export function leaveAtFromNowPlusMinutes(
  minutes: number,
  now: Date = new Date()
): Date {
  return new Date(now.getTime() + minutes * 60 * 1000)
}

export function durationMinFromLeaveAt(
  leaveAt: Date,
  now: Date = new Date()
): number {
  return Math.round((leaveAt.getTime() - now.getTime()) / 60_000)
}

export type LeaveAtValidation =
  | { ok: true; durationMin: number }
  | { ok: false; error: string }

export function validateLeaveAt(
  leaveAt: Date,
  now: Date = new Date()
): LeaveAtValidation {
  const durationMin = durationMinFromLeaveAt(leaveAt, now)
  if (leaveAt.getTime() <= now.getTime() || durationMin < 1) {
    return {
      ok: false,
      error: "Leave time must be in the future.",
    }
  }
  if (durationMin > MAX_STAY_MINUTES) {
    return {
      ok: false,
      error: "Leave time must be within 12 hours from now.",
    }
  }
  return { ok: true, durationMin }
}

export const TRAFFIC_MAX_STAY_MINUTES = MAX_STAY_MINUTES
