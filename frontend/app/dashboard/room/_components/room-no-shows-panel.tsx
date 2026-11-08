"use client"

import { useState } from "react"
import { BookOpen, Search, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ScholarNoShow } from "@/lib/types/session-log"

export function RoomNoShowsPanel({ scholars, error, variant = "study" }: {
  scholars: ScholarNoShow[]
  error: string | null
  variant?: "study" | "front-desk"
}) {
  const title = variant === "study" ? "Study Session No-Shows" : "Front Desk No-Shows"
  const Icon = variant === "study" ? BookOpen : UserCheck
  const [query, setQuery] = useState("")
  const filtered = scholars.filter((scholar) => scholar.scholarName.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5" aria-hidden />
          {title}
        </CardTitle>
        <div className="relative w-full max-w-xs sm:w-56">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scholars..." className="pl-8 h-9" aria-label={`Search ${title.toLowerCase()}`} />
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {scholars.length ? "No scholars match your search" : `No ${variant === "study" ? "study session" : "front desk"} no-shows at this time`}
          </p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Scholar</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((scholar) => (
                <TableRow key={scholar.scholarId}>
                  <TableCell className="font-medium">{scholar.scholarName}</TableCell>
                  <TableCell className="tabular-nums">{scholar.phoneNumber ?? "Not provided"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
