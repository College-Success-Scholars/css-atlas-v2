"use client"

import { useMemo, useState } from "react"
import { BookOpen, Search, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ScholarInRoom } from "@/lib/types/session-log"
import { filterRoomScholarsByName } from "../_lib/filter-room-scholars"
import { formatDurationShort, formatEnteredTime } from "../_lib/room-format"

/** Serializable subset of ScholarInRoom for client tables. */
export type RoomScholarRow = Pick<
  ScholarInRoom,
  "scholarId" | "scholarName" | "entryAt" | "timeInRoomMs"
>

const PANEL_ICONS = {
  study: BookOpen,
  "front-desk": UserCheck,
} as const

export type RoomSessionPanelVariant = keyof typeof PANEL_ICONS

export function RoomSessionPanel({
  title,
  variant,
  scholars,
  emptyMessage,
}: {
  title: string
  variant: RoomSessionPanelVariant
  scholars: RoomScholarRow[]
  emptyMessage: string
}) {
  const Icon = PANEL_ICONS[variant]
  const [query, setQuery] = useState("")

  const filtered = useMemo(
    () => filterRoomScholarsByName(scholars, query),
    [scholars, query],
  )

  const noRowsMessage =
    scholars.length === 0
      ? emptyMessage
      : `No scholars matching “${query.trim()}”`

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <div className="relative w-full max-w-xs sm:w-56">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scholars..."
            className="pl-8 h-9"
            aria-label={`Search ${title} scholars`}
          />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {noRowsMessage}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scholar</TableHead>
                <TableHead>Entered</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((scholar) => (
                <TableRow key={scholar.scholarId}>
                  <TableCell className="font-medium">
                    {scholar.scholarName ?? scholar.scholarId}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatEnteredTime(scholar.entryAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDurationShort(scholar.timeInRoomMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
