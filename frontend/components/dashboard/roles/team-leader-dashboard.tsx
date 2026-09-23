/**
 * @file team-leader-dashboard.tsx
 * @module frontend/components/dashboard
 *
 * Dashboard view for users with the team_leader role.
 * Shows a summary of mentee activity, form completion rates, session hours,
 * and other team leader-relevant KPIs. Rendered by app/dashboard/page.tsx.
 *
 * ## What belongs here
 * - Team leader-specific dashboard layout and data aggregation
 *
 * ## What does NOT belong here
 * - Scholar-only content (that's scholar-dashboard.tsx)
 */
import Link from "next/link"
import { FileText, Monitor, User, Users } from "lucide-react"

const baseOverviewLinks = [
  {
    title: "Personal",
    href: "/dashboard/personal",
    icon: User,
    description:
      "Track your WPL, MCF, and WAHF submission status.",
  },
  {
    title: "Room Monitoring",
    href: "/dashboard/room",
    icon: Monitor,
    description:
      "View real-time room occupancy and scholar presence for study sessions and front desk duty.",
  },
  {
    title: "Weekly Memo",
    href: "/dashboard/memo",
    icon: FileText,
    description:
      "Review the weekly memo: scholar follow-up, team leader form compliance, and attendance.",
  },
] as const

const menteesOverviewLink = {
  title: "Mentees",
  href: "/dashboard/mentee",
  icon: Users,
  description:
    "Monitor your mentees' study sessions, front desk hours, tutoring, and WAHF status.",
} as const

type TeamLeaderDashboardProps = {
  firstName?: string | null;
  /** When false, hide the Mentees quick link (same gate as sidebar / mentee page). */
  showMentees?: boolean;
};

export function TeamLeaderDashboard({ firstName, showMentees = false }: TeamLeaderDashboardProps) {
  const overviewLinks = showMentees
    ? [baseOverviewLinks[0], menteesOverviewLink, ...baseOverviewLinks.slice(1)]
    : [...baseOverviewLinks];
  const trimmedFirstName = firstName?.trim()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {trimmedFirstName ? `Welcome back, ${trimmedFirstName}` : "Home"}
        </h1>
      </div>

      <section className="space-y-4" aria-labelledby="quick-overview-heading">
        <div>
          <h2 id="quick-overview-heading" className="text-lg font-medium">Quick Overview</h2>
          <p className="text-sm text-muted-foreground">
            Get started with monitoring your team and personal progress
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {overviewLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block cursor-pointer rounded-lg border p-4 transition-colors hover:bg-accent hover:text-accent-foreground active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="mb-2 flex items-center gap-2">
                <item.icon className="size-5 shrink-0 text-muted-foreground" />
                <h3 className="font-medium">{item.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
