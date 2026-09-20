import { describe, expect, it } from "vitest";
import {
  buildScholarProfileInsertRow,
  isEligibleScholar,
  isEnrolled,
  isEnrolledScholar,
  isGraduated,
  isTeamLeaderForPerformance,
  overlayRosterAppRoleFromProfile,
} from "../services/user.service.js";
import type { RosterRow } from "../models/user.model.js";
import { freshmanCohortYear } from "../services/time.service.js";

describe("buildScholarProfileInsertRow", () => {
  it("sets explicit defaults for all writable profile columns (full_name is DB-generated)", () => {
    const row = buildScholarProfileInsertRow({
      userId: "user-uuid",
      email: "student@umd.edu",
      first_name: "Jane",
      last_name: "Doe",
      student_id: "123456789",
      phone_number: "3015550100",
      cohort: 2025,
    });

    expect(row).toEqual({
      id: "user-uuid",
      first_name: "Jane",
      last_name: "Doe",
      student_id: "123456789",
      phone_number: "3015550100",
      cohort: 2025,
      program_role: "Scholar",
      app_role: null,
      emails: ["student@umd.edu"],
      status: null,
      fd_required: null,
      ss_required: null,
      mentee_count: 0,
      majors: [],
      minors: [],
      teams: [],
    });
  });
});

describe("isEligibleScholar", () => {
  const freshman = freshmanCohortYear();

  it("includes enrolled freshman/sophomore scholars with required hours", () => {
    expect(
      isEligibleScholar({
        program_role: "scholar",
        cohort: freshman,
        status: "enrolled",
        fd_required: 120,
        ss_required: 0,
      }),
    ).toBe(true);
  });

  it("excludes inactive scholars", () => {
    expect(isEnrolled("inactive")).toBe(false);
    expect(
      isEligibleScholar({
        program_role: "scholar",
        cohort: freshman,
        status: "inactive",
        fd_required: 120,
        ss_required: 180,
      }),
    ).toBe(false);
  });

  it("excludes graduated scholars", () => {
    expect(
      isEligibleScholar({
        program_role: "scholar",
        cohort: freshman,
        status: "graduated",
        fd_required: 120,
        ss_required: 180,
      }),
    ).toBe(false);
  });

  it("excludes juniors with leftover hours", () => {
    expect(
      isEligibleScholar({
        program_role: "scholar",
        cohort: freshman - 2,
        status: "enrolled",
        fd_required: 120,
        ss_required: 180,
      }),
    ).toBe(false);
  });
});

describe("isEnrolledScholar", () => {
  it("includes enrolled scholar roster rows", () => {
    expect(isEnrolledScholar({ program_role: "Scholar", status: "enrolled" })).toBe(true);
  });

  it("excludes inactive, graduated, and non-scholar rows", () => {
    expect(isEnrolledScholar({ program_role: "scholar", status: "inactive" })).toBe(false);
    expect(isEnrolledScholar({ program_role: "scholar", status: "graduated" })).toBe(false);
    expect(isEnrolledScholar({ program_role: "Team Leader", status: "enrolled" })).toBe(false);
  });
});

describe("isTeamLeaderForPerformance", () => {
  it("includes enrolled team leaders and Program Coordinator", () => {
    expect(
      isTeamLeaderForPerformance({ program_role: "team_leader", status: "enrolled" }),
    ).toBe(true);
    expect(isTeamLeaderForPerformance({ program_role: "Team Leader", status: "ENROLLED" })).toBe(true);
    expect(
      isTeamLeaderForPerformance({ program_role: "Program Coordinator", status: "enrolled" }),
    ).toBe(true);
  });

  it("excludes inactive, graduated, and unset roster status", () => {
    expect(isTeamLeaderForPerformance({ program_role: "GA", status: "inactive" })).toBe(false);
    expect(isTeamLeaderForPerformance({ program_role: "Team Leader", status: null })).toBe(false);
    expect(isGraduated("Graduated")).toBe(true);
    expect(
      isTeamLeaderForPerformance({ program_role: "team_leader", status: "graduated" }),
    ).toBe(false);
  });

  it("excludes scholars and Coordinator", () => {
    expect(
      isTeamLeaderForPerformance({ program_role: "scholar", status: "enrolled" }),
    ).toBe(false);
    expect(
      isTeamLeaderForPerformance({ program_role: "Coordinator", status: "enrolled" }),
    ).toBe(false);
    expect(
      isTeamLeaderForPerformance({ program_role: "coordinator", status: null }),
    ).toBe(false);
  });
});

describe("overlayRosterAppRoleFromProfile", () => {
  const roster = {
    id: 1,
    uid: "1",
    created_at: "2026-01-01",
    first_name: null,
    last_name: null,
    phone_number: null,
    email: null,
    cohort: null,
    status: "enrolled",
    app_role: null,
    program_role: null,
    fd_required: null,
    ss_required: null,
    mentee_count: null,
    majors: null,
    minors: null,
    mentee_uids: null,
    teams: null,
    invite_accepted_at: null,
    invite_sent_at: null,
  } satisfies RosterRow;

  it("fills roster app_role from the linked profile when roster is unset", () => {
    expect(overlayRosterAppRoleFromProfile(roster, "developer").app_role).toBe("developer");
  });

  it("keeps an explicit roster app_role", () => {
    expect(
      overlayRosterAppRoleFromProfile({ ...roster, app_role: "scholar" }, "developer").app_role,
    ).toBe("scholar");
  });
});
