// components/roster/DirectoryRoster.tsx
import type { RosterScholarRow, RosterTLRow } from "./type"
import { RosterAccordionSection } from "./personal_info_table"
import { ScholarRosterTable } from "./ScholarRosterTable"
import { TeamLeaderRosterTable } from "./TeamLeaderRosterTable"

// A discriminated union, not a single `rows: RosterScholarRow[] | RosterTLRow[]`
// prop, so TypeScript ties the row shape to the role at the call site instead
// of needing a runtime cast here.
type DirectoryRosterProps =
  | { viewerRole: "scholar"; rows: RosterScholarRow[] }
  | { viewerRole: "team-leader" | "developer"; rows: RosterTLRow[] }

function groupByTeam<T extends { teams: string[] }>(
  rows: T[]
): [string, T[]][] {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    if (row.teams.length === 0) {
      const bucket = grouped.get("Unassigned")

      if (bucket) {
        bucket.push(row)
      } else {
        grouped.set("Unassigned", [row])
      }

      continue
    }

    for (const team of row.teams) {
      const bucket = grouped.get(team)

      if (bucket) {
        bucket.push(row)
      } else {
        grouped.set(team, [row])
      }
    }
  }

  return Array.from(grouped.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )
}

export function DirectoryRoster(props: DirectoryRosterProps) {
  if (props.rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No one matches these filters.
      </p>
    )
  }

  if (props.viewerRole === "scholar") {
    const groups = groupByTeam(props.rows)
    return (
      <div className="space-y-3">
        {groups.map(([team, teamRows]) => (
          <RosterAccordionSection
            key={team}
            title={team}
            rightLabel={`${teamRows.length} ${teamRows.length === 1 ? "person" : "people"}`}
            defaultOpen
          >
            <ScholarRosterTable data={teamRows} />
          </RosterAccordionSection>
        ))}
      </div>
    )
  }

  const groups = groupByTeam(props.rows)
  return (
    <div className="space-y-3">
      {groups.map(([team, teamRows]) => (
        <RosterAccordionSection
          key={team}
          title={team}
          rightLabel={`${teamRows.length} ${teamRows.length === 1 ? "person" : "people"}`}
          defaultOpen
        >
          <TeamLeaderRosterTable data={teamRows} />
        </RosterAccordionSection>
      ))}
    </div>
  )
}
