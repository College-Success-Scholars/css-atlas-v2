import { requireTeamLeaderOrAbove } from "@/lib/supabase/server"
import {
  getStudySessionScholarsInRoom,
  getFrontDeskScholarsInRoom,
} from "@/lib/server/data"
import { getStartOfDayEastern } from "@/lib/format/time"
import type { ScholarInRoom } from "@/lib/types/session-log"
import { RoomPageToolbar } from "./_components/room-page-toolbar"
import { RoomSummaryCards } from "./_components/room-summary-cards"
import { RoomSessionPanel } from "./_components/room-session-panel"
import { formatSnapshotLabel } from "./_lib/room-format"

export const dynamic = "force-dynamic"

export default async function RoomMonitoringPage() {
  await requireTeamLeaderOrAbove()

  const now = new Date()
  const dateRangeOpts = {
    startDate: getStartOfDayEastern(now),
    endDate: now,
    asOf: now,
  }

  const [studySessionRaw, frontDeskRaw] = await Promise.all([
    getStudySessionScholarsInRoom(dateRangeOpts),
    getFrontDeskScholarsInRoom(dateRangeOpts),
  ])

  // Pass only serializable fields to client components (omit entryTicket).
  const toRow = (s: ScholarInRoom) => ({
    scholarId: s.scholarId,
    scholarName: s.scholarName,
    entryAt: s.entryAt,
    timeInRoomMs: s.timeInRoomMs,
  })
  const studySession = studySessionRaw.map(toRow)
  const frontDesk = frontDeskRaw.map(toRow)

  const uniquePresent = new Set([
    ...studySession.map((s) => s.scholarId),
    ...frontDesk.map((s) => s.scholarId),
  ]).size

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Room Monitoring</h1>
          <p className="text-muted-foreground">
            Current occupancy for study sessions and front desk duty
          </p>
        </div>

        <RoomPageToolbar lastUpdatedLabel={formatSnapshotLabel(now)} />
      </div>

      <RoomSummaryCards
        totalPresent={uniquePresent}
        studyCount={studySession.length}
        frontDeskCount={frontDesk.length}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <RoomSessionPanel
          title="Study Session"
          variant="study"
          scholars={studySession}
          emptyMessage="No scholars in a study session at this time"
        />
        <RoomSessionPanel
          title="Front Desk"
          variant="front-desk"
          scholars={frontDesk}
          emptyMessage="No scholars at front desk at this time"
        />
      </div>
    </div>
  )
}
