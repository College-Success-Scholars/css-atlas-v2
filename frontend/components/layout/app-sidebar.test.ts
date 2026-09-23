import { describe, expect, it } from "vitest"
import { BookOpen, ConciergeBell } from "lucide-react"
import { getRoleBasedNav } from "./sidebar-nav"
import { getRoleBasedTeams } from "./sidebar-teams"

describe("sidebar role navigation", () => {
  it("shows only the relocated Teams destinations to team leaders and developers", () => {
    for (const role of ["team-leader", "developer"] as const) {
      expect(getRoleBasedTeams(role)).toEqual([
        { name: "Front Desk", url: "/dashboard/teams/front-desk", icon: ConciergeBell },
        { name: "Study Session", url: "/dashboard/teams/study", icon: BookOpen },
      ])
    }
  })

  it("does not show Teams or incomplete navigation to scholars", () => {
    expect(getRoleBasedTeams("scholar")).toEqual([])
  })

  it("uses Directory rather than the legacy Roster route for eligible roles", () => {
    for (const role of ["scholar", "team-leader", "developer"] as const) {
      const items = getRoleBasedNav(role, false, false)
      expect(items).toContainEqual(expect.objectContaining({ title: "Directory", url: "/dashboard/directory" }))
      expect(items).not.toContainEqual(expect.objectContaining({ url: "/dashboard/roster" }))
    }
  })
})
