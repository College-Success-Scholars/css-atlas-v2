"use client"

import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RosterScholarRow, RosterTLRow } from "./type"
import { DirectoryRoster } from "./DirectoryRoster"

const ALL = "all"

type DirectoryPageProps = {
  viewerRole: "scholar" | "team-leader" | "developer"
  initialRows: RosterScholarRow[] | RosterTLRow[]
}

export default function DirectoryPage({
  viewerRole,
  initialRows,
}: DirectoryPageProps) {
  const [search, setSearch] = useState("")
  const [team, setTeam] = useState<string>(ALL)
  const [programRole, setProgramRole] = useState<string>(ALL)
  const [cohort, setCohort] = useState<string>(ALL)

  const allTeams = useMemo(
    () => Array.from(new Set(initialRows.flatMap((row) => row.teams))).sort(),
    [initialRows],
  )

  const allProgramRoles = useMemo(
    () => Array.from(new Set(initialRows.map((row) => row.programRole))).sort(),
    [initialRows],
  )

  const allCohorts = useMemo(
    () =>
      Array.from(
        new Set(
          initialRows.flatMap((row) =>
            "cohort" in row && row.cohort != null ? [row.cohort] : [],
          ),
        ),
      ).sort((a, b) => b - a),
    [initialRows],
  )

const filtered = useMemo(() => {
  const q = search.trim().toLowerCase()

  return initialRows.filter((row) => {
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
}, [initialRows, search, team, programRole, cohort])
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

            {allTeams.map((t) => (
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

            {allProgramRoles.map((r) => (
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

              {allCohorts.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {viewerRole === "scholar" ? (
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
