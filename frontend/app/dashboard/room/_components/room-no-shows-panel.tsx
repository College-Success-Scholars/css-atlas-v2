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
import type { ScholarNoShow } from "@/lib/types/session-log"
import { filterRoomScholarsByName } from "../_lib/filter-room-scholars"
import { formatMissedShiftRange } from "../_lib/room-format"

const PANEL_ICONS = {
  study: BookOpen,
  "front-desk": UserCheck,
} as const

export type RoomNoShowsPanelVariant = keyof typeof PANEL_ICONS

export function RoomNoShowsPanel({
  title,
  variant,
  scholars,
  error,
  emptyMessage,
}: {
  title: string
  variant: RoomNoShowsPanelVariant
  scholars: ScholarNoShow[]
  error: string | null
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
          <Icon className="h-5 w-5" aria-hidden />
          {title}
        </CardTitle>
        <div className="relative w-full max-w-xs sm:w-56">
          <Search
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scholars..."
            className="pl-8 h-9"
            aria-label={`Search ${title}`}
          />
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="py-6 text-center text-sm text-destructive">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {noRowsMessage}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scholar</TableHead>
                <TableHead>Missed shift</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((scholar) => (
                <TableRow key={`${scholar.scholarId}-${scholar.scheduledStart}`}>
                  <TableCell className="font-medium">
                    {scholar.scholarName}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatMissedShiftRange(
                      scholar.scheduledStart,
                      scholar.scheduledEnd,
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {scholar.phoneNumber ?? "Not provided"}
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
