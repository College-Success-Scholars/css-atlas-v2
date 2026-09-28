import { BookOpen, ClipboardList, ConciergeBell } from "lucide-react"

import type { UserRole } from "@/lib/auth"

export const getRoleBasedTeams = (role: UserRole) => {
  switch (role) {
    case "team-leader":
    case "developer":
      return [
        {
          name: "Front Desk",
          url: "/dashboard/teams/front-desk",
          icon: ConciergeBell,
        },
        {
          name: "Study Session",
          url: "/dashboard/teams/study",
          icon: BookOpen,
        },
        {
          name: "Tutoring",
          url: "/dashboard/teams/tutoring",
          icon: ClipboardList,
        },
      ]

    default:
      return []
  }
}
