import { ChartColumn, ClipboardCheck, DoorOpen, GraduationCap, Handshake, Home, SquareTerminal, BookUser, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/auth";

export type SidebarNavItem = { title: string; url: string; icon: LucideIcon; isActive?: boolean };

export function getRoleBasedNav(role: UserRole, showMemo: boolean, showMentees: boolean): SidebarNavItem[] {
  switch (role) {
    case "default":
    case "scholar":
      return [
        { title: "Home", url: "/dashboard", icon: GraduationCap, isActive: true },
        { title: "Directory", url: "/dashboard/directory", icon: BookUser },
      ];
    case "team-leader":
    case "developer":
      return [
        { title: "Home", url: "/dashboard", icon: Home, isActive: true },
        { title: "Directory", url: "/dashboard/directory", icon: BookUser },
        { title: "Personal", url: "/dashboard/personal", icon: ClipboardCheck },
        { title: "Room", url: "/dashboard/room", icon: DoorOpen },
        ...(showMentees ? [{ title: "Mentees", url: "/dashboard/mentee", icon: Handshake }] : []),
        ...(showMemo ? [{ title: "Memo", url: "/dashboard/memo", icon: ChartColumn }] : []),
      ];
    default:
      return [{ title: "Playground", url: "#", icon: SquareTerminal, isActive: true }];
  }
}
