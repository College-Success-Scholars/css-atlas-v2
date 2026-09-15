// components/roster/mock-user-roster.ts
//
// Stand-in for a real `/api/user-roster` endpoint. The important thing to
// preserve when this gets wired to the real API: fetchDirectoryRoster
// returns a *different, narrower object shape* for scholars — not the full
// record with fields hidden in the UI. Swap the body of this function for a
// real fetch and keep that contract (server decides the shape per role).

import type { RosterScholarRow, RosterTLRow} from "./type"
import type { UserRole } from "@/lib/auth"

type UserRosterRecord = {
  uid: string
  scholarName: string
  email: string | null
  phone: string | null
  cohort: number | null
  programRole: string
  teams: string[]
  appRole: string | null
}

const USER_ROSTER: UserRosterRecord[] = [
  { uid: "120777189", scholarName: "David Morejon", email: "dmorejon@umd.edu", phone: "240-715-8664", cohort: 2024, programRole: "Vice-President", teams: ["Study Session", "Database", "Inventory"], appRole: "developer" },
]

function toScholarRow(r: UserRosterRecord): RosterScholarRow {
  return {
    scholarName: r.scholarName,
    email: r.email,
    programRole: r.programRole,
    teams: Array.isArray(r.teams) ? r.teams : r.teams ? [r.teams] : [],
  }
}

function toTLRow(r: UserRosterRecord): RosterTLRow {
  return {
    uid: r.uid,
    scholarName: r.scholarName,
    cohort: r.cohort,
    email: r.email,
    phone: r.phone,
    programRole: r.programRole,
    teams: r.teams,
    appRole: r.appRole,
  }
}

// Simulates a role-scoped API call. A "scholar" viewer never receives
// phone/uid/cohort/appRole in the payload at all.
export async function fetchDirectoryRoster(viewerRole: UserRole):
 Promise<RosterScholarRow[] | RosterTLRow[]> {
  if (viewerRole === "scholar") return USER_ROSTER.map(toScholarRow)
  return USER_ROSTER.map(toTLRow)
}

export const ALL_TEAMS = Array.from(
  new Set(
    USER_ROSTER.flatMap((r) => r.teams)
  )
).sort()

export const ALL_PROGRAM_ROLES = Array.from(new Set(USER_ROSTER.map((r) => r.programRole))).sort()

export const ALL_COHORTS = Array.from(
  new Set(USER_ROSTER.map((r) => r.cohort).filter((c): c is number => c != null))
).sort((a, b) => b - a)
