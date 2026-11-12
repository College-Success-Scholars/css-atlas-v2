import { EASTERN_TIMEZONE } from "@/lib/format/time"

export function formatEnteredTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/** Eastern clock range for a missed shift, e.g. "2:00 PM – 3:00 PM". */
export function formatMissedShiftRange(scheduledStart: string, scheduledEnd: string): string {
  const start = formatEnteredTime(scheduledStart)
  const end = formatEnteredTime(scheduledEnd)
  return start && end ? `${start} – ${end}` : start || end
}

export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatSnapshotLabel(now: Date): string {
  const datePart = now.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const timePart = now.toLocaleTimeString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  return `${datePart}, ${timePart} ET`
}
