import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { RosterScholarRow, RosterTLRow } from "./type"

type DirectoryViewerRole = "scholar" | "team-leader" | "developer"

type UserRosterRow = {
  id: number
  uid: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_number: string | null
  cohort: number | null
  program_role: string | null
  teams: string[] | null
  app_role: string | null
}

const displayName = (row: UserRosterRow) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
  row.uid ||
  `Roster member ${row.id}`

const teamsFor = (row: UserRosterRow) =>
  Array.isArray(row.teams) ? row.teams.filter(Boolean) : []

/** Load live roster data and remove elevated-only fields for scholars. */
export async function fetchDirectoryRoster(
  viewerRole: "scholar",
): Promise<RosterScholarRow[]>
export async function fetchDirectoryRoster(
  viewerRole: "team-leader" | "developer",
): Promise<RosterTLRow[]>
export async function fetchDirectoryRoster(
  viewerRole: DirectoryViewerRole,
): Promise<RosterScholarRow[] | RosterTLRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("user_roster")
    .select(
      "id, uid, first_name, last_name, email, phone_number, cohort, program_role, teams, app_role",
    )
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (error) throw new Error(`Failed to load roster: ${error.message}`)

  const rows = (data ?? []) as UserRosterRow[]

  if (viewerRole === "scholar") {
    return rows.map((row) => ({
      scholarName: displayName(row),
      email: row.email,
      programRole: row.program_role ?? "Unassigned",
      teams: teamsFor(row),
    }))
  }

  return rows.map((row) => ({
    uid: row.uid || String(row.id),
    scholarName: displayName(row),
    cohort: row.cohort == null ? null : Number(row.cohort),
    email: row.email,
    phone: row.phone_number,
    programRole: row.program_role ?? "Unassigned",
    teams: teamsFor(row),
    appRole: row.app_role,
  }))
}
