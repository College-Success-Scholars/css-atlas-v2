import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../app.js";
import { resolveMemoDefaultWeek } from "../services/memo-default-week.js";

import {
  aggregateTeamLeaderMcfStats,
  buildGradeBreakdown,
  buildMemoScholarAttendanceRows,
} from "../services/memo-page.service.js";
import { EMPTY_WEEKLY_MINUTES } from "../models/weekly-minutes.model.js";
import type { CampusWeekAttendanceTotals } from "../models/attendance-week.model.js";
import type { MemoUserRow } from "../models/user.model.js";
import type { FormLogRowWithLate, McfFormLogRow, WahfFormLogRow } from "../models/form-log.model.js";
import type { ScholarShiftCompliance } from "../models/session-log.model.js";
import { freshmanCohortYear } from "../services/time.service.js";

describe("Memo routes — auth gating", () => {
  it("allows the local dashboard origin to request a memo PDF", async () => {
    const res = await request(app)
      .options("/api/memo/pdf?weekNumber=5")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("GET /api/memo/weekly returns 401 without token", async () => {
    const res = await request(app).get("/api/memo/weekly");
    expect(res.status).toBe(401);
  });

  it("GET /api/memo/page-data returns 401 without token", async () => {
    const res = await request(app).get("/api/memo/page-data");
    expect(res.status).toBe(401);
  });

  it("GET /api/memo/pdf returns 401 without token", async () => {
    const res = await request(app).get("/api/memo/pdf?weekNumber=5");
    expect(res.status).toBe(401);
  });

  it("POST /api/memo/sync returns 401 without token", async () => {
    const res = await request(app).post("/api/memo/sync");
    expect(res.status).toBe(401);
  });

  it("GET /api/memo/traffic-count returns 401 without token", async () => {
    const res = await request(app).get("/api/memo/traffic-count");
    expect(res.status).toBe(401);
  });
});

describe("resolveMemoDefaultWeek", () => {
  it("returns year_not_started when current campus week is null", () => {
    expect(resolveMemoDefaultWeek(null)).toEqual({ status: "year_not_started" });
  });

  it("returns the current week without falling back to 1", () => {
    expect(resolveMemoDefaultWeek(6)).toEqual({ status: "ok", weekNumber: 6 });
  });
});

describe("buildMemoScholarAttendanceRows", () => {
  const scholar: MemoUserRow = {
    uid: "1001",
    first_name: "Ada",
    last_name: "Lovelace",
    cohort: freshmanCohortYear(),
    program_role: "scholar",
    app_role: "authenticated",
    fd_required: 120,
    ss_required: 180,
    status: "enrolled",
  };

  const zero: CampusWeekAttendanceTotals = {
    minutes: EMPTY_WEEKLY_MINUTES,
    loggedMin: 0,
    excuseMin: 0,
    description: null,
  };

  it("empty tickets and no excuse → zero logged and 0% completion", () => {
    const { scholars } = buildMemoScholarAttendanceRows([scholar], new Map(), new Map());
    expect(scholars).toHaveLength(1);
    expect(scholars[0]).toMatchObject({
      fdTotal: 0,
      ssTotal: 0,
      fdExcuseMin: 0,
      ssExcuseMin: 0,
      fdPct: 0,
      ssPct: 0,
      teamLeader: "Unassigned",
    });
  });

  it("excuse-only scholar gets completion from scholar_week_excuses", () => {
    const fdByUid = new Map<string, CampusWeekAttendanceTotals>([
      ["1001", { ...zero, excuseMin: 120, description: "Sick" }],
    ]);
    const { scholars, cohort2025 } = buildMemoScholarAttendanceRows(
      [scholar],
      fdByUid,
      new Map()
    );
    expect(scholars[0]?.fdTotal).toBe(0);
    expect(scholars[0]?.fdExcuseMin).toBe(120);
    expect(scholars[0]?.fdPct).toBe(100);
    expect(cohort2025.fdCompleteCount).toBe(1);
  });

  it("enriches compliance without changing attendance, excuse, or completion values", () => {
    const fdByUid = new Map<string, CampusWeekAttendanceTotals>([
      ["1001", { ...zero, loggedMin: 90, excuseMin: 30 }],
    ]);
    const compliance: ScholarShiftCompliance = {
      fdCompliance: { insideMinutes: 75, outsideMinutes: 15, noShowCount: 0, dates: [] },
      ssCompliance: { insideMinutes: 30, outsideMinutes: 0, noShowCount: 1, dates: [] },
    };

    const { scholars } = buildMemoScholarAttendanceRows(
      [scholar],
      fdByUid,
      new Map(),
      [],
      new Map([["1001", compliance]])
    );

    expect(scholars[0]).toMatchObject({
      fdTotal: 90,
      fdExcuseMin: 30,
      fdPct: 100,
      ssTotal: 0,
      ssExcuseMin: 0,
      ssPct: 0,
      fdCompliance: { insideMinutes: 75, outsideMinutes: 15 },
      ssCompliance: { insideMinutes: 30, outsideMinutes: 0, noShowCount: 1 },
    });
  });

  it("sets WAHF status from latest form-log row for that scholar", () => {
    const wahfRows = [
      {
        id: "1",
        created_at: "2026-04-02T12:00:00.000Z",
        scholar_uid: "1001",
        scholar_name: "Ada Lovelace",
        team_leader_contact: null,
        tl_meeting_in_person: null,
        course_changes: null,
        assignment_grades: null,
        missed_classes: null,
        missed_assignments: null,
        submitted_by_email: null,
        course_change_details: null,
        isLate: true,
      },
      {
        id: "2",
        created_at: "2026-04-03T12:00:00.000Z",
        scholar_uid: "1001",
        scholar_name: "Ada Lovelace",
        team_leader_contact: null,
        tl_meeting_in_person: null,
        course_changes: null,
        assignment_grades: null,
        missed_classes: null,
        missed_assignments: null,
        submitted_by_email: null,
        course_change_details: null,
        isLate: false,
      },
    ];
    const { scholars } = buildMemoScholarAttendanceRows([scholar], new Map(), new Map(), wahfRows);
    expect(scholars[0]?.wahfStatus).toBe("on-time");
    expect(scholars[0]?.wahfSubmittedAt).toBe("2026-04-03T12:00:00.000Z");
  });

  it("marks WAHF missing when the scholar has no form log", () => {
    const { scholars } = buildMemoScholarAttendanceRows([scholar], new Map(), new Map(), []);
    expect(scholars[0]?.wahfStatus).toBe("missing");
    expect(scholars[0]?.wahfSubmittedAt).toBeNull();
  });

  it("marks WAHF late when the latest submission is late", () => {
    const wahfRows = [
      {
        id: "1",
        created_at: "2026-04-04T12:00:00.000Z",
        scholar_uid: "1001",
        scholar_name: "Ada Lovelace",
        team_leader_contact: null,
        tl_meeting_in_person: null,
        course_changes: null,
        assignment_grades: null,
        missed_classes: null,
        missed_assignments: null,
        submitted_by_email: null,
        course_change_details: null,
        isLate: true,
      },
    ];
    const { scholars } = buildMemoScholarAttendanceRows([scholar], new Map(), new Map(), wahfRows);
    expect(scholars[0]?.wahfStatus).toBe("late");
    expect(scholars[0]?.wahfSubmittedAt).toBe("2026-04-04T12:00:00.000Z");
  });

  it("excludes inactive scholars", () => {
    const { scholars } = buildMemoScholarAttendanceRows(
      [{ ...scholar, status: "inactive" }],
      new Map(),
      new Map(),
    );
    expect(scholars).toHaveLength(0);
  });

  it("excludes graduated scholars", () => {
    const { scholars } = buildMemoScholarAttendanceRows(
      [{ ...scholar, status: "graduated" }],
      new Map(),
      new Map(),
    );
    expect(scholars).toHaveLength(0);
  });

  it("excludes juniors even when hours are set", () => {
    const { scholars } = buildMemoScholarAttendanceRows(
      [{ ...scholar, cohort: freshmanCohortYear() - 2 }],
      new Map(),
      new Map(),
    );
    expect(scholars).toHaveLength(0);
  });

  it("excludes enrolled frosh/soph without required hours", () => {
    const { scholars } = buildMemoScholarAttendanceRows(
      [{ ...scholar, fd_required: 0, ss_required: 0 }],
      new Map(),
      new Map(),
    );
    expect(scholars).toHaveLength(0);
  });

  it("attaches the mentor_mentee team-leader name", () => {
    const { scholars } = buildMemoScholarAttendanceRows(
      [scholar],
      new Map(),
      new Map(),
      [],
      new Map(),
      new Map([["1001", "Ada Mentor"]]),
    );
    expect(scholars[0]?.teamLeader).toBe("Ada Mentor");
  });
});

const mcfRow = (
  overrides: Partial<FormLogRowWithLate<McfFormLogRow>>
): FormLogRowWithLate<McfFormLogRow> => ({
  id: "mcf-1",
  created_at: "2026-04-02T12:00:00.000Z",
  mentor_name: null,
  mentor_uid: null,
  mentee_name: null,
  mentee_uid: null,
  meeting_date: null,
  meeting_time: null,
  met_in_person: null,
  reason_no_meeting: null,
  tasks_completed: null,
  meeting_notes: null,
  tutoring_status: null,
  needs_tutor: null,
  support_rank: null,
  submitted_by_email: null,
  isLate: false,
  ...overrides,
});

describe("aggregateTeamLeaderMcfStats", () => {
  it("uses fetched weekly MCF rows with the legacy mentor-or-mentee match semantics", () => {
    const stats = aggregateTeamLeaderMcfStats(
      ["tl-mentor", "tl-mentee"],
      [
        mcfRow({
          id: "one",
          mentor_uid: "tl-mentor",
          mentee_uid: "tl-mentee",
          created_at: "2026-04-02T12:00:00.000Z",
        }),
        mcfRow({
          id: "two",
          mentor_uid: "tl-mentor",
          mentee_uid: "tl-mentor",
          created_at: "2026-04-04T12:00:00.000Z",
          isLate: true,
        }),
        mcfRow({ id: "three", mentor_uid: "other", mentee_uid: "another" }),
      ]
    );

    expect(stats.get("tl-mentor")).toEqual({
      count: 2,
      hasLate: true,
      latestAt: "2026-04-04T12:00:00.000Z",
    });
    expect(stats.get("tl-mentee")).toEqual({
      count: 1,
      hasLate: false,
      latestAt: "2026-04-02T12:00:00.000Z",
    });
  });
});

const wahfRow = (
  overrides: Partial<FormLogRowWithLate<WahfFormLogRow>>
): FormLogRowWithLate<WahfFormLogRow> => ({
  id: "1",
  created_at: "2026-04-02T12:00:00.000Z",
  scholar_uid: "1001",
  scholar_name: "Ada Lovelace",
  team_leader_contact: null,
  tl_meeting_in_person: null,
  course_changes: null,
  assignment_grades: null,
  missed_classes: null,
  missed_assignments: null,
  submitted_by_email: null,
  course_change_details: null,
  isLate: false,
  ...overrides,
});

describe("buildGradeBreakdown", () => {
  it("buckets parsed assignment grades into high, mid, and low bands", () => {
    const breakdown = buildGradeBreakdown([
      wahfRow({
        assignment_grades: {
          CMSC131: { Midterm: "95%", Quiz: "80%" },
          MATH140: { Exam: "60" },
        },
      }),
    ]);

    expect(breakdown.high).toEqual([
      expect.objectContaining({
        scholarName: "Ada Lovelace",
        course: "CMSC131",
        assessment: "Midterm",
        grade: "95%",
        percent: 95,
      }),
    ]);
    expect(breakdown.mid).toEqual([
      expect.objectContaining({ course: "CMSC131", assessment: "Quiz", grade: "80%", percent: 80 }),
    ]);
    expect(breakdown.low).toEqual([
      expect.objectContaining({ course: "MATH140", assessment: "Exam", grade: "60", percent: 60 }),
    ]);
  });

  it("uses only the latest WAHF per scholar so resubmits do not duplicate", () => {
    const breakdown = buildGradeBreakdown([
      wahfRow({
        id: "1",
        created_at: "2026-04-02T12:00:00.000Z",
        assignment_grades: { CMSC131: { Midterm: "50%" } },
      }),
      wahfRow({
        id: "2",
        created_at: "2026-04-03T12:00:00.000Z",
        assignment_grades: { CMSC131: { Midterm: "92%" } },
      }),
    ]);

    expect(breakdown.high).toHaveLength(1);
    expect(breakdown.high[0]).toMatchObject({ grade: "92%", percent: 92 });
    expect(breakdown.mid).toHaveLength(0);
    expect(breakdown.low).toHaveLength(0);
  });

  it("sorts each band descending by percent", () => {
    const breakdown = buildGradeBreakdown([
      wahfRow({
        scholar_uid: "1001",
        scholar_name: "Zed Scholar",
        assignment_grades: { CMSC131: { Quiz: "91%", Exam: "100%" } },
      }),
      wahfRow({
        id: "2",
        scholar_uid: "1002",
        scholar_name: "Ann Scholar",
        assignment_grades: { MATH140: { HW: "88%", Lab: "71%" }, PHYS161: { Quiz: "40" } },
      }),
    ]);

    expect(breakdown.high.map((entry) => entry.percent)).toEqual([100, 91]);
    expect(breakdown.mid.map((entry) => entry.percent)).toEqual([88, 71]);
    expect(breakdown.low.map((entry) => entry.percent)).toEqual([40]);
  });

  it("parses grades independently per scholar", () => {
    const breakdown = buildGradeBreakdown([
      wahfRow({
        scholar_uid: "1001",
        scholar_name: "Ada Lovelace",
        assignment_grades: { CMSC131: { Quiz: "91%" } },
      }),
      wahfRow({
        id: "2",
        scholar_uid: "1002",
        scholar_name: "Alan Turing",
        assignment_grades: { PHYS161: { Lab: "65%" } },
      }),
    ]);

    expect(breakdown.high).toEqual([
      expect.objectContaining({ scholarName: "Ada Lovelace", course: "CMSC131", percent: 91 }),
    ]);
    expect(breakdown.low).toEqual([
      expect.objectContaining({ scholarName: "Alan Turing", course: "PHYS161", percent: 65 }),
    ]);
  });

  it("includes team-leader and other WAHF submitters when no roster set is provided", () => {
    const breakdown = buildGradeBreakdown([
      wahfRow({
        scholar_uid: "1001",
        scholar_name: "Ada Lovelace",
        assignment_grades: { CMSC131: { Quiz: "91%" } },
      }),
      wahfRow({
        id: "2",
        scholar_uid: "tl-1",
        scholar_name: "Team Leader",
        assignment_grades: { ENGL101: { Essay: "94%" } },
      }),
      wahfRow({
        id: "3",
        scholar_uid: "junior-1",
        scholar_name: "Junior Scholar",
        assignment_grades: { PHYS161: { Lab: "65%" } },
      }),
    ]);

    expect(breakdown.high.map((entry) => entry.scholarName).sort()).toEqual([
      "Ada Lovelace",
      "Team Leader",
    ]);
    expect(breakdown.low).toEqual([
      expect.objectContaining({ scholarName: "Junior Scholar", course: "PHYS161", percent: 65 }),
    ]);
  });

  it("keeps grades only for the provided UIDs when a roster set is passed", () => {
    const breakdown = buildGradeBreakdown(
      [
        wahfRow({
          scholar_uid: "1001",
          scholar_name: "Ada Lovelace",
          assignment_grades: { CMSC131: { Quiz: "91%" } },
        }),
        wahfRow({
          id: "2",
          scholar_uid: "inactive-1",
          scholar_name: "Inactive Scholar",
          assignment_grades: { PHYS161: { Lab: "65%" } },
        }),
        wahfRow({
          id: "3",
          scholar_uid: "tl-1",
          scholar_name: "Team Leader",
          assignment_grades: { ENGL101: { Essay: "94%" } },
        }),
      ],
      new Set(["1001"]),
    );

    expect(breakdown.high).toEqual([
      expect.objectContaining({ scholarName: "Ada Lovelace", course: "CMSC131", percent: 91 }),
    ]);
    expect(breakdown.mid).toHaveLength(0);
    expect(breakdown.low).toHaveLength(0);
  });
});
