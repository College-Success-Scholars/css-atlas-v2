"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { RoomNoShowsPanel } from "./room-no-shows-panel"
import type { ScholarNoShow } from "@/lib/types/session-log"

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
})

export function RoomNoShowsHeading({ studyNoShows, studyNoShowsError, frontDeskNoShows, frontDeskNoShowsError }: {
  studyNoShows: ScholarNoShow[]
  studyNoShowsError: string | null
  frontDeskNoShows: ScholarNoShow[]
  frontDeskNoShowsError: string | null
}) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section aria-labelledby="scholar-no-shows-heading" className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="scholar-no-shows-heading" className="text-2xl font-semibold tracking-tight">
          Scholar No-Shows
        </h2>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden />
          <time dateTime={now?.toISOString()} className="tabular-nums" aria-label="Current time in Eastern Time">
            {now ? clockFormatter.format(now) : "Loading time…"}
          </time>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RoomNoShowsPanel scholars={studyNoShows} error={studyNoShowsError} />
        <RoomNoShowsPanel variant="front-desk" scholars={frontDeskNoShows} error={frontDeskNoShowsError} />
      </div>
    </section>
  )
}
