/**
 * @file app-sidebar.tsx
 * @module frontend/components
 *
 * Main application sidebar component.
 * Renders the full navigation sidebar including nav groups (main, secondary),
 * project selector, and user menu. Composed of NavMain, NavProjects, NavUser,
 * and NavSecondary sub-components.
 *
 * ## What belongs here
 * - Sidebar composition and nav item configuration
 *
 * ## What does NOT belong here
 * - Individual nav item components (NavMain, NavProjects, etc. are separate files)
 * - Route definitions or auth logic
 */
"use client"

import * as React from "react"
import { 
  BookOpen,
  Bot,
  Building,
  Command,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
  Users,
  FileText,
  GraduationCap,
  UserCheck,
  Briefcase,
  Calendar,
  User,
  Home,
} from "lucide-react"

import { NavMain } from "@/components/layout/nav-main"
import { NavProjects } from "@/components/layout/nav-projects"
import { NavSecondary } from "@/components/layout/nav-secondary"
import { NavUser } from "@/components/layout/nav-user"
import { ProfileSwitcher } from "@/components/dev/profile-switcher"
import { DevActingBanner } from "@/components/dev/dev-acting-banner"
import type { DevTestProfileListItem } from "@/lib/server/queries"
import { isDeveloperProfile } from "@/lib/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { UserRole, resolveUserRole, canAccessWeeklyMemo, canAccessMenteeMonitoring, formatUserRoleLabel } from "@/lib/auth"

const defaultData = {
  user: {
    name: "CSS",
    email: "m@example.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Playground",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "History",
          url: "#",
        },
        {
          title: "Starred",
          url: "#",
        },
        {
          title: "Settings",
          url: "#",
        },
      ],
    },
    {
      title: "Models",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Genesis",
          url: "#",
        },
        {
          title: "Explorer",
          url: "#",
        },
        {
          title: "Quantum",
          url: "#",
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Limits",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ],
  projects: [
    {
      name: "Internship Board",
      url: "#",
      icon: Briefcase, // Internship Board: Briefcase icon
    },
    {
      name: "Events",
      url: "#",
      icon: Calendar, // Events: Calendar icon
    },
  ],
}

// Role-specific navigation data
const getRoleBasedNav = (role: UserRole, showMemo: boolean, showMentees: boolean) => {
  switch (role) {
    case 'default':
    case 'scholar':
      return [

        {
          title: "Home",
          url: "/dashboard",
          icon: GraduationCap,
          isActive: true,
        },
                {
          title: "Roster",
          url: "/dashboard/roster",
          icon: UserCheck,
          isActive: true,
        },

        {
          title: "Directory",
          url: "/dashboard/directory",
          icon: User,
          isActive: false,
        },
      ]
    
    case 'team-leader':
    case 'developer':
      return [
        {
          title: "Home",
          url: "/dashboard",
          icon: Home,
          isActive: true,
        },
        {
          title: "Roster",
          url: "/dashboard/roster",
          icon: UserCheck,
        },
        {
          title: "Personal",
          url: "/dashboard/personal",
          icon: User,
        },
        {
          title: "Room",
          url: "/dashboard/room",
          icon: Building,
        },
        ...(showMentees
          ? [
              {
                title: "Mentees",
                url: "/dashboard/mentee",
                icon: Users,
              },
            ]
          : []),
        ...(showMemo
          ? [
              {
                title: "Memo",
                url: "/dashboard/memo",
                icon: FileText,
              },
            ]
          : []),
        {
          title: "Teams",
          url: "/dashboard/teams/front-desk",
          icon: Users,
          items: [
            {
              title: "Front Desk",
              url: "/dashboard/teams/front-desk",
            },
            {
              title: "Study Sessions",
              url: "/dashboard/teams/study",
            },
          ],
        },
      ]
    
    default:
      return defaultData.navMain
  }
}

const getRoleBasedResources = (role: UserRole) => {
  switch (role) {
    case 'scholar':
      return [
        {
          name: "Internship Board",
          url: "/dashboard/internship-board",
          icon: Briefcase,
        },
        {
          name: "Events",
          url: "/dashboard/events",
          icon: Calendar,
        },
      ]
    
    case 'team-leader':
    case 'developer':
      return [
        {
          name: "Internship Board",
          url: "/dashboard/internship-board",
          icon: Briefcase,
        },
        {
          name: "Events",
          url: "/dashboard/events",
          icon: Calendar,
        }
      ]
    
    default:
      return defaultData.projects
  }
}

const getRoleBasedSecondaryNav = (role: UserRole) => {
  switch (role) {
    case 'scholar':
    case 'team-leader':
    case 'developer':
      return [
        {
          title: "Support",
          url: "#",
          icon: LifeBuoy,
        },
      ]
    
    default:
      return defaultData.navSecondary
  }
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  profile: Record<string, unknown>;
  realProfile?: Record<string, unknown> | null;
  isActingAsTestProfile?: boolean;
  activeTestProfileId?: string | null;
  testProfiles?: DevTestProfileListItem[];
  userRole?: UserRole
}

export function AppSidebar({
  profile,
  realProfile,
  isActingAsTestProfile = false,
  activeTestProfileId = null,
  testProfiles = [],
  ...props
}: AppSidebarProps) {
  const roleFields = profile as { app_role?: string | null; program_role?: string | null };
  const isDeveloper = isDeveloperProfile(
    (realProfile ?? profile) as { app_role?: string | null },
  );
  const actingLabel =
    typeof profile._devTestProfileLabel === "string"
      ? profile._devTestProfileLabel
      : "Test profile";
  const userRole = resolveUserRole(roleFields);
  const showMemo = canAccessWeeklyMemo(roleFields);
  const showMentees = canAccessMenteeMonitoring(profile);
  const roleNavMain = getRoleBasedNav(userRole, showMemo, showMentees)
  const roleNavSecondary = getRoleBasedSecondaryNav(userRole)
  const roleNavResources = getRoleBasedResources(userRole)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">CSS Atlas</span>
                  <span className="truncate text-xs">{formatUserRoleLabel(userRole)}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {isActingAsTestProfile && (
          <div className="px-2 pb-2">
            <DevActingBanner label={actingLabel} />
          </div>
        )}
        <NavMain items={roleNavMain} />
        <NavProjects projects={roleNavResources} />
        <NavSecondary items={roleNavSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {isDeveloper && testProfiles.length > 0 && (
          <div className="px-2 pb-2">
            <ProfileSwitcher
              testProfiles={testProfiles}
              activeTestProfileId={activeTestProfileId}
              compact
            />
          </div>
        )}
        <NavUser user={{
          name: profile?.first_name + " " + profile?.last_name,
          email: profile?.email as string,
          avatar: profile?.avatar as string,
        }} />
      </SidebarFooter>
    </Sidebar>
  )
}
