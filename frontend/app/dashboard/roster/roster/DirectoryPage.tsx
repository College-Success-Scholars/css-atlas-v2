"use client"

import { useEffect, useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UserRole } from "@/lib/auth"
import type { RosterScholarRow, RosterTLRow } from "./type"
import {
  ALL_COHORTS,
  ALL_PROGRAM_ROLES,
  ALL_TEAMS,
  fetchDirectoryRoster,
} from "./mock-user-roster"
import { DirectoryRoster } from "./DirectoryRoster"

const ALL = "all"

type DirectoryPageProps = {
  viewerRole: "scholar" | "team-leader" | "developer"
}

export default function DirectoryPage({
  viewerRole,
}: DirectoryPageProps) {
  const [rows, setRows] = useState<RosterScholarRow[] | RosterTLRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [team, setTeam] = useState<string>(ALL)
  const [programRole, setProgramRole] = useState<string>(ALL)
  const [cohort, setCohort] = useState<string>(ALL)

  useEffect(() => {
    let cancelled = false

    setLoading(true)

    fetchDirectoryRoster(viewerRole).then((data) => {
      if (cancelled) return

      setRows(data)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [viewerRole])

const filtered = useMemo(() => {
  const q = search.trim().toLowerCase()

  return rows.filter((row) => {
    if (team !== ALL && !row.teams.includes(team)) return false

    if (programRole !== ALL && row.programRole !== programRole) {
      return false
    }

    if (
      cohort !== ALL &&
      "cohort" in row &&
      String(row.cohort ?? "") !== cohort
    ) {
      return false
    }

    if (!q) return true

    const haystack = [
      row.scholarName,
      row.email,
      row.programRole,
      row.teams.join(" "),
      "appRole" in row ? row.appRole : null,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return haystack.includes(q)
  })
}, [rows, search, team, programRole, cohort])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Roster</h1>
        <p className="text-muted-foreground text-sm">
          Search scholars and team leaders in the program.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name, email, team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Team" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={ALL}>All teams</SelectItem>

            {ALL_TEAMS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={programRole} onValueChange={setProgramRole}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Program role" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={ALL}>All program roles</SelectItem>

            {ALL_PROGRAM_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {viewerRole !== "scholar" && (
          <Select value={cohort} onValueChange={setCohort}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Cohort" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={ALL}>All cohorts</SelectItem>

              {ALL_COHORTS.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">
          Loading directory…
        </p>
      ) : viewerRole === "scholar" ? (
        <DirectoryRoster
          viewerRole="scholar"
          rows={filtered as RosterScholarRow[]}
        />
      ) : (
        <DirectoryRoster
          viewerRole={viewerRole}
          rows={filtered as RosterTLRow[]}
        />
      )}
    </div>
  )
}