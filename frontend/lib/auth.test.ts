import { describe, expect, it } from "vitest";
import {
  canAccessCoordinatorView,
  canAccessMenteeMonitoring,
  canAccessWeeklyMemo,
  formatUserRoleLabel,
  hasAssignedMentees,
  resolveUserRole,
} from "./auth";

describe("canAccessWeeklyMemo", () => {
  it("allows team_leader and developer app_role", () => {
    expect(canAccessWeeklyMemo({ app_role: "team_leader" })).toBe(true);
    expect(canAccessWeeklyMemo({ app_role: "developer" })).toBe(true);
  });

  it("does not treat coordinator as team_leader until the shared ladder includes it", () => {
    expect(canAccessWeeklyMemo({ app_role: "coordinator" })).toBe(false);
  });

  it("denies null app_role scholars", () => {
    expect(canAccessWeeklyMemo({ program_role: "scholar", app_role: null })).toBe(false);
  });
});

describe("canAccessCoordinatorView", () => {
  it("allows developer while coordinator is off the shared ladder", () => {
    expect(canAccessCoordinatorView({ app_role: "developer" })).toBe(true);
    expect(canAccessCoordinatorView({ app_role: "coordinator" })).toBe(false);
  });

  it("denies team_leader and scholars", () => {
    expect(canAccessCoordinatorView({ app_role: "team_leader" })).toBe(false);
    expect(canAccessCoordinatorView({ program_role: "scholar", app_role: null })).toBe(false);
  });
});

describe("resolveUserRole", () => {
  it("returns scholar when program_role is scholar and app_role is null", () => {
    expect(resolveUserRole({ program_role: "scholar", app_role: null })).toBe("scholar");
  });

  it("returns team-leader when app_role is team_leader", () => {
    expect(resolveUserRole({ program_role: "team_leader", app_role: "team_leader" })).toBe(
      "team-leader",
    );
  });

  it("returns developer when app_role is developer", () => {
    expect(resolveUserRole({ program_role: "developer", app_role: "developer" })).toBe(
      "developer",
    );
  });

  it("maps coordinator to default until the shared ladder includes it", () => {
    expect(resolveUserRole({ app_role: "coordinator" })).toBe("default");
    expect(resolveUserRole({ app_role: "coordinator" })).not.toBe("team-leader");
  });

  it("does not treat null app_role as team-leader", () => {
    expect(resolveUserRole({ program_role: "scholar", app_role: null })).not.toBe("team-leader");
  });

  it("maps unknown app_role values including admin and exec to default", () => {
    expect(resolveUserRole({ app_role: "admin" })).toBe("default");
    expect(resolveUserRole({ app_role: "exec" })).toBe("default");
    expect(resolveUserRole({ app_role: "staff" })).toBe("default");
  });
});

describe("hasAssignedMentees", () => {
  it("is true when mentee_count is positive", () => {
    expect(hasAssignedMentees({ mentee_count: 2 })).toBe(true);
  });

  it("is true when top-level mentee_uids is non-empty", () => {
    expect(hasAssignedMentees({ mentee_count: 0, mentee_uids: ["uid-1"] })).toBe(true);
  });

  it("is true when nested user_roster.mentee_uids is non-empty", () => {
    expect(hasAssignedMentees({ user_roster: { mentee_uids: ["uid-1"] } })).toBe(true);
  });

  it("reads mentee fields from nested user_roster", () => {
    expect(hasAssignedMentees({ user_roster: { mentee_count: 1 } })).toBe(true);
  });

  it("is false when no mentees are assigned", () => {
    expect(hasAssignedMentees({ mentee_count: 0, user_roster: { mentee_uids: [] } })).toBe(false);
    expect(hasAssignedMentees(null)).toBe(false);
  });

  it("does not treat empty top-level mentee_uids as assigned when count is zero", () => {
    expect(
      hasAssignedMentees({
        mentee_count: 0,
        mentee_uids: [],
        user_roster: null,
      }),
    ).toBe(false);
  });
});

describe("canAccessMenteeMonitoring", () => {
  it("allows team leaders with mentees", () => {
    expect(canAccessMenteeMonitoring({ app_role: "team_leader", mentee_count: 1 })).toBe(true);
  });

  it("denies team leaders without mentees", () => {
    expect(canAccessMenteeMonitoring({ app_role: "team_leader", mentee_count: 0 })).toBe(false);
  });

  it("allows team leaders with only top-level mentee_uids (test-profile shape)", () => {
    expect(
      canAccessMenteeMonitoring({
        app_role: "team_leader",
        mentee_count: 0,
        mentee_uids: ["mentee-1"],
        user_roster: null,
      }),
    ).toBe(true);
  });

  it("denies scholars even when mentee_count is set", () => {
    expect(canAccessMenteeMonitoring({ app_role: null, program_role: "scholar", mentee_count: 1 })).toBe(
      false,
    );
  });
});

describe("formatUserRoleLabel", () => {
  it("maps UI roles to display labels", () => {
    expect(formatUserRoleLabel("team-leader")).toBe("Team Leader");
    expect(formatUserRoleLabel("scholar")).toBe("Scholar");
    expect(formatUserRoleLabel("developer")).toBe("Developer");
    expect(formatUserRoleLabel("default")).toBe("Dashboard");
  });
});
