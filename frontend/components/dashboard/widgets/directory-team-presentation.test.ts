import {
  DIRECTORY_TEAM_PRESENTATION,
  directoryTeamFilterOptions,
  directoryTeamPresentationFor,
} from "./directory-team-presentation";
import {
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  ConciergeBell,
  Database,
  Landmark,
  Mail,
  Package,
} from "lucide-react";
import { describe, expect, it } from "vitest";

describe("directory team presentation", () => {
  it("configures every supported team with its approved label and icon", () => {
    expect(Object.entries(DIRECTORY_TEAM_PRESENTATION).map(([team, presentation]) => [team, presentation.label, presentation.icon])).toEqual([
      ["developer", "Database", Database],
      ["front_desk", "Front Desk", ConciergeBell],
      ["study", "Study Session", BookOpen],
      ["eboard", "Executive Board", Landmark],
      ["media", "Media & Photos", Camera],
      ["internships", "Internships", Briefcase],
      ["comms", "Communications", Mail],
      ["inventory", "Inventory", Package],
      ["cal", "Calendar", Calendar],
    ]);
  });

  it("uses a readable fallback for unrecognized identifiers", () => {
    expect(directoryTeamPresentationFor("community_outreach").label).toBe("Community Outreach");
  });

  it("keeps raw team identifiers as filter values while rendering mapped labels", () => {
    expect(directoryTeamFilterOptions(["comms", "media"])).toEqual([
      { value: "comms", label: "Communications" },
      { value: "media", label: "Media & Photos" },
    ]);
  });
});
