/**
 * @file teams-view-tabs.tsx
 * @module frontend/app/dashboard/teams
 *
 * The pill row that switches between the team boards. Shared by every teams
 * board so adding a board means editing this list once.
 *
 * ## What belongs here
 * - The board list and the pill markup
 *
 * ## What does NOT belong here
 * - Board data loading or columns
 * - The sidebar's Teams group (that's components/layout/sidebar-teams.ts)
 */
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type TeamsViewTab = {
  label: string;
  /** Route for this board; also its identity for the active check. */
  href: string;
};

const FRONT_DESK_HREF = "/dashboard/teams/front-desk";
const AM_PM_HREF = "/dashboard/teams/front-desk/am-pm";
const STUDY_HREF = "/dashboard/teams/study";

export const TEAMS_VIEW_TABS: TeamsViewTab[] = [
  { label: "Front desk hours", href: FRONT_DESK_HREF },
  { label: "Front desk AM/PM", href: AM_PM_HREF },
  { label: "Study sessions", href: STUDY_HREF },
];

/** Boards that belong to the Front Desk team. */
const FRONT_DESK_BOARDS = new Set([FRONT_DESK_HREF, AM_PM_HREF]);

/**
 * The AM/PM checklist is Front Desk only — it is deliberately not offered from
 * the Study sessions board, where it would be noise. The other place it appears
 * is the mentee view, per-mentee.
 */
export function visibleTeamsViewTabs(activeHref: string): TeamsViewTab[] {
  const onFrontDesk = FRONT_DESK_BOARDS.has(activeHref);
  return TEAMS_VIEW_TABS.filter((tab) => tab.href !== AM_PM_HREF || onFrontDesk);
}

export type TeamsViewTabsProps = {
  /** The current board's route, matched against each tab's href. */
  activeHref: string;
  weekNum: number;
};

export function TeamsViewTabs({ activeHref, weekNum }: TeamsViewTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/40 p-1 w-fit">
      {visibleTeamsViewTabs(activeHref).map((tab) => (
        <Link
          key={tab.href}
          href={`${tab.href}?week=${weekNum}`}
          aria-current={tab.href === activeHref ? "page" : undefined}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm transition-colors",
            tab.href === activeHref
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
