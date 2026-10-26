"use client"

import { useState } from "react"

import { AlertCircle, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { backendGet } from "@/lib/client/api-client"
import type {
  McfPrefill,
  MeetingPreferenceOutput,
  SectionResult,
  WeekReviewSummary,
} from "@/lib/types/mentee-review"

import { MeetingPreferenceEditor } from "./meeting-preference-editor"
import { formatWeekFriday } from "./utils"

interface McfBarProps {
  menteeUid: string
  currentWeek: number | null
  currentWeekSummary: WeekReviewSummary | null
  meetingPreference: SectionResult<MeetingPreferenceOutput | null> | null
  onPreferenceSaved: () => void
  disabled: boolean
}

/** Current-week MCF bar; always the current program-local week, independent of selection. */
export function McfBar({
  menteeUid,
  currentWeek,
  currentWeekSummary,
  meetingPreference,
  onPreferenceSaved,
  disabled,
}: McfBarProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preference = meetingPreference?.ok ? meetingPreference.data : null
  const preferenceUnavailable = meetingPreference != null && !meetingPreference.ok

  const dueText = currentWeekSummary
    ? `Due ${formatWeekFriday(currentWeekSummary.weekStart)} at 5:00pm`
    : "Due Friday at 5:00pm"

  async function fillMcf() {
    setError(null)
    // Open the tab during the gesture so the async fetch cannot be popup-blocked.
    const preopened = typeof window === "undefined" ? null : window.open("about:blank", "_blank")
    if (preopened) preopened.opener = null

    setLoading(true)
    const result = await backendGet<McfPrefill>(
      `/api/auth/mentees/${encodeURIComponent(menteeUid)}/mcf-prefill`,
    )
    setLoading(false)

    if (!result.ok) {
      preopened?.close()
      setError(result.error)
      return
    }
    if (preopened) {
      preopened.location.href = result.data.url
      return
    }
    const opened = window.open(result.data.url, "_blank", "noopener,noreferrer")
    if (!opened) {
      setError("Your browser blocked the new tab. Allow pop-ups for this site and try again.")
    }
  }

  return (
    <Card className="min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[15px] font-semibold">
            {currentWeek != null ? `Week ${currentWeek} check-in form` : "Check-in form"}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <span>{dueText}</span>
            <span aria-hidden>·</span>
          <MeetingPreferenceEditor
            menteeUid={menteeUid}
            preference={preference}
            unavailable={preferenceUnavailable}
            onSaved={onPreferenceSaved}
          />
          </div>
        </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 cursor-pointer px-5 shadow-none"
            disabled={disabled || loading}
            onClick={() => void fillMcf()}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {loading ? "Preparing…" : "Fill MCF"}
          </Button>

        {error && (
          <p role="alert" className="flex w-full items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
