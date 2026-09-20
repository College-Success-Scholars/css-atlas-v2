import { describe, expect, it } from "vitest";
import {
  menteeTeamLeaderRowsFromAssignments,
  teamLeaderLabelByMenteeUid,
  teamLeaderLabelForScholar,
  UNASSIGNED_TEAM_LEADER,
} from "../services/mentee.service.js";

describe("teamLeaderLabelByMenteeUid", () => {
  it("maps mentee uid to the team-leader name", () => {
    const map = teamLeaderLabelByMenteeUid([
      { mentee_uid: "s-1", team_leader_name: "Ada Lovelace" },
    ]);
    expect(map.get("s-1")).toBe("Ada Lovelace");
  });

  it("joins distinct names when a mentee has more than one mentor", () => {
    const map = teamLeaderLabelByMenteeUid([
      { mentee_uid: "s-1", team_leader_name: "Zoe" },
      { mentee_uid: "s-1", team_leader_name: "Ada" },
      { mentee_uid: "s-1", team_leader_name: "Ada" },
    ]);
    expect(map.get("s-1")).toBe("Ada, Zoe");
  });

  it("skips blank uids and names", () => {
    const map = teamLeaderLabelByMenteeUid([
      { mentee_uid: "  ", team_leader_name: "Ada" },
      { mentee_uid: "s-1", team_leader_name: "  " },
      { mentee_uid: null, team_leader_name: "Ada" },
    ]);
    expect(map.size).toBe(0);
  });
});

describe("teamLeaderLabelForScholar", () => {
  it("returns Unassigned when the scholar has no mentor_mentee row", () => {
    expect(teamLeaderLabelForScholar("s-9", new Map())).toBe(UNASSIGNED_TEAM_LEADER);
  });

  it("returns the mapped name", () => {
    expect(teamLeaderLabelForScholar("s-1", new Map([["s-1", "Ada Lovelace"]]))).toBe(
      "Ada Lovelace",
    );
  });
});

describe("menteeTeamLeaderRowsFromAssignments", () => {
  it("prefers roster names, then profile names", () => {
    const rows = menteeTeamLeaderRowsFromAssignments(
      [
        {
          mentee_uid: "s-1",
          profiles: { student_id: "tl-1", first_name: "Ada", last_name: "Profile" },
        },
        {
          mentee_uid: "s-2",
          profiles: { student_id: "tl-2", first_name: "Alan", last_name: "Turing" },
        },
        { mentee_uid: "s-3", profiles: null },
      ],
      new Map([["tl-1", "Ada Lovelace"]]),
    );
    expect(rows).toEqual([
      { mentee_uid: "s-1", team_leader_name: "Ada Lovelace" },
      { mentee_uid: "s-2", team_leader_name: "Alan Turing" },
      { mentee_uid: "s-3", team_leader_name: null },
    ]);
  });
});
