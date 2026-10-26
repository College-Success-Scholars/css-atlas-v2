"use client"

import { useId, useRef, useState, useTransition } from "react"

import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

/** Compact per-pair trigger; editing stays outside the check-in banner's flow. */
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
  const [isSaving, setIsSaving] = useState(false)
  const [isPending, startTransition] = useTransition()
  const saveInFlight = useRef(false)
  const id = useId()

  function handleOpenChange(open: boolean) {
    if (saveInFlight.current) return
    if (open) {
      setWeekday(preference?.weekday ?? 3)
      setTime(preference?.meetingTime ?? "15:00")
    }
    setError(null)
    setEditing(open)
  }

  async function save() {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setIsSaving(true)
    setError(null)
    try {
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
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  const summary = preference
    ? `Your meeting: ${formatWeekdayName(preference.weekday)} at ${formatTimeOfDay(preference.meetingTime)}`
    : unavailable
      ? "Your meeting: unavailable"
      : "Your meeting: not set"

  return (
    <Dialog open={editing} onOpenChange={handleOpenChange}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{summary}</span>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 min-h-0 gap-1 rounded-full border-border/70 bg-background/70 px-2 py-0 text-xs text-muted-foreground shadow-none hover:text-foreground has-[>svg]:px-2"
            aria-label="Change meeting time"
            disabled={isSaving || isPending}
          >
            <Pencil className="size-3" aria-hidden />
            {preference ? "Change" : "Set"}
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change meeting time</DialogTitle>
          <DialogDescription>
            Choose your usual meeting day and time to prefill the check-in form.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          aria-busy={isSaving}
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${id}-weekday`}>Weekday</Label>
              <Select value={String(weekday)} onValueChange={(value) => setWeekday(Number(value))} disabled={isSaving}>
                <SelectTrigger id={`${id}-weekday`} className="min-h-11 w-full" aria-label="Meeting weekday">
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
            <div className="space-y-2">
              <Label htmlFor={`${id}-time`}>Time</Label>
              <Input
                id={`${id}-time`}
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="min-h-11"
                disabled={isSaving}
                required
              />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-11" disabled={isSaving}>Cancel</Button>
            </DialogClose>
            <Button type="submit" className="min-h-11" disabled={isSaving || isPending}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
