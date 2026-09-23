"use client"

import { type LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { NavSidebarIcon } from "@/components/layout/nav-sidebar-icon"
import { isLinkActive } from "@/lib/nav-active"

export function NavTeams({
  teams,
}: {
  teams: {
    name: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Teams</SidebarGroupLabel>
      <SidebarMenu>
        {teams.map((item) => {
          const active = isLinkActive(pathname, item.url)
          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={active}>
                <a href={item.url}>
                  <NavSidebarIcon icon={item.icon} active={active} />
                  <span>{item.name}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
