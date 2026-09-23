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
import { Command, Compass } from "lucide-react"

import { NavMain } from "@/components/layout/nav-main"
import { NavTeams } from "@/components/layout/nav-teams"
import { NavUser } from "@/components/layout/nav-user"
import { getRoleBasedTeams } from "@/components/layout/sidebar-teams"
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
import { resolveUserRole, canAccessWeeklyMemo, canAccessMenteeMonitoring, formatUserRoleLabel, type UserRole } from "@/lib/auth"
import { getRoleBasedNav } from "@/components/layout/sidebar-nav"

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
  const roleNavTeams = getRoleBasedTeams(userRole)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Compass className="size-6" />
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
        {roleNavTeams.length > 0 && <NavTeams teams={roleNavTeams} />}
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
