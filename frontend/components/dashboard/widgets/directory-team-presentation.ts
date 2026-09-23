import {
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  CircleHelp,
  ConciergeBell,
  Database,
  Landmark,
  Mail,
  Package,
  type LucideIcon,
} from "lucide-react";

type DirectoryTeam =
  | "developer"
  | "front_desk"
  | "study"
  | "eboard"
  | "media"
  | "internships"
  | "comms"
  | "inventory"
  | "cal";

export type DirectoryTeamPresentation = {
  label: string;
  description: string;
  icon: LucideIcon;
};

export const DIRECTORY_TEAM_PRESENTATION: Record<DirectoryTeam, DirectoryTeamPresentation> = {
  developer: {
    label: "Database",
    description: "Builds the CSS Atlas platform.",
    icon: Database,
  },
  front_desk: {
    label: "Front Desk",
    description: "Ensures scholars complete front-desk sessions and follows up with scholar team leaders.",
    icon: ConciergeBell,
  },
  study: {
    label: "Study Session",
    description: "Ensures scholars complete study sessions and follows up with scholar team leaders.",
    icon: BookOpen,
  },
  eboard: {
    label: "Executive Board",
    description: "Runs academic, professional, and engagement-events committees.",
    icon: Landmark,
  },
  media: {
    label: "Media & Photos",
    description: "Photographs events and maintains social presence.",
    icon: Camera,
  },
  internships: {
    label: "Internships",
    description: "Gathers promising opportunities.",
    icon: Briefcase,
  },
  comms: {
    label: "Communications",
    description: "Sends scholar event emails.",
    icon: Mail,
  },
  inventory: {
    label: "Inventory",
    description: "Tracks snacks, office supplies, and technology for budgeting.",
    icon: Package,
  },
  cal: {
    label: "Calendar",
    description: "Maintains the event calendar.",
    icon: Calendar,
  },
};

function fallbackLabel(team: string): string {
  return team
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ") || "Unassigned";
}

export function directoryTeamPresentationFor(team: string): DirectoryTeamPresentation {
  if (Object.hasOwn(DIRECTORY_TEAM_PRESENTATION, team)) {
    return DIRECTORY_TEAM_PRESENTATION[team as DirectoryTeam];
  }

  return {
    label: fallbackLabel(team),
    description: "Directory team.",
    icon: CircleHelp,
  };
}

export function directoryTeamFilterOptions(teams: string[]) {
  return teams.map((value) => ({ value, label: directoryTeamPresentationFor(value).label }));
}
