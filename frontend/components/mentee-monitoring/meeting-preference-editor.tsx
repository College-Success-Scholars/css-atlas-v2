"use client"

import { useRef, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { backendPut } from "@/lib/client/api-client"
import type { MeetingPreferenceOutput } from "@/lib/types/mentee-review"

import { formatTimeOfDay, formatWeekdayName } from "./utils"

interface MeetingPreferenceEditorProps {
  menteeUid: string
  /** Null means the caller has no saved preference for this mentee. */
  preference: MeetingPreferenceOutput | null
  /** Unreadable preference (section error); editing stays available. */
  unavailable?: boolean
  onSaved: () => void
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

/** Small per-pair weekday + time editor; keeps the previous value on failure. */
export function MeetingPreferenceEditor({
  menteeUid,
  preference,
  unavailable = false,
  onSaved,
}: MeetingPreferenceEditorProps) {
  const [editing, setEditing] = useState(false)
  const [weekday, setWeekday] = useState<number>(preference?.weekday ?? 3)
  const [time, setTime] = useState<string>(preference?.meetingTime ?? "15:00")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toggleRef = useRef<HTMLButtonElement>(null)

  function openEditor() {
    setWeekday(preference?.weekday ?? 3)
    setTime(preference?.meetingTime ?? "15:00")
    setError(null)
    setEditing(true)
  }

  function closeEditor() {
    setEditing(false)
    setError(null)
    toggleRef.current?.focus()
  }

  async function save() {
    setError(null)
    const result = await backendPut<MeetingPreferenceOutput>(
      `/api/auth/mentees/${encodeURIComponent(menteeUid)}/meeting-preference`,
      { weekday, meetingTime: time },
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEditing(false)
    startTransition(() => {
      onSaved()
    })
    toggleRef.current?.focus()
  }

  const summary = preference
    ? `Your meeting: ${formatWeekdayName(preference.weekday)} at ${formatTimeOfDay(preference.meetingTime)}`
    : unavailable
      ? "Your meeting: unavailable"
      : "Your meeting: not set"

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{summary}</span>
        <Button
          ref={toggleRef}
          type="button"
          variant="link"
          size="sm"
          className="h-auto min-h-0 px-0 py-1 text-[13px]"
          disabled={isPending}
          onClick={openEditor}
        >
          {preference ? "Change" : "Set"}
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="meeting-weekday" className="text-xs">
          Weekday
        </Label>
        <Select value={String(weekday)} onValueChange={(value) => setWeekday(Number(value))}>
          <SelectTrigger id="meeting-weekday" size="sm" className="min-h-11 w-36" aria-label="Meeting weekday">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKDAYS.map((day) => (
              <SelectItem key={day} value={String(day)}>
                {formatWeekdayName(day)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="meeting-time" className="text-xs">
          Time
        </Label>
        <Input
          id="meeting-time"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="min-h-11 w-32"
          required
        />
      </div>

      <Button type="submit" variant="outline" className="min-h-11" disabled={isPending}>
        Save
      </Button>
      <Button type="button" variant="outline" className="min-h-11" onClick={closeEditor}>
        Cancel
      </Button>

      <p role="alert" className="w-full text-sm text-destructive">
        {error}
      </p>
    </form>
  )
}
