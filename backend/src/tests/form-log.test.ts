import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import {
  buildTeamLeaderFormStatsForWeek,
  countableFormRequired,
  NO_MENTEE_RELATIONSHIP,
} from "../services/form-log.service.js";
import type { FormLogRowWithLate, McfFormLogRow } from "../models/form-log.model.js";

describe("Form log routes — unauthenticated", () => {
  it("GET /api/form-logs/mcf/week/1/with-late returns 401 without token", async () => {
    const res = await request(app).get("/api/form-logs/mcf/week/1/with-late");
    expect(res.status).toBe(401);
  });

  it("GET /api/form-logs/mcf/uid/12345 returns 401 without token", async () => {
    const res = await request(app).get("/api/form-logs/mcf/uid/12345");
    expect(res.status).toBe(401);
  });

  it("POST /api/form-logs/recent-submissions returns 401 without token", async () => {
    const res = await request(app).post("/api/form-logs/recent-submissions").send({ scholarId: "12345" });
    expect(res.status).toBe(401);
  });
});

describe("assembleRecentFormSubmissions", () => {
  it("omits WPL/MCF and WAHF payloads for scholars", async () => {
    const { assembleRecentFormSubmissions } = await import("../services/form-log.service.js");
    const result = assembleRecentFormSubmissions({
      includeTeamLeaderForms: false,
      whaf: [
        {
          id: "w1",
          created_at: "2026-09-01T12:00:00.000Z",
          assignment_grades: { CMSC: { Exam: "90%" } },
        } as unknown as import("../models/form-log.model.js").WahfFormLogRow,
      ],
      wpl: [
        {
          id: 1,
          created_at: "2026-09-01T13:00:00.000Z",
          hours_worked: 4,
        } as unknown as import("../models/form-log.model.js").WplFormLogRow,
      ],
      mcf: [
        {
          id: "m1",
          created_at: "2026-09-01T14:00:00.000Z",
          mentee_name: "Ada",
          meeting_notes: "private",
        } as unknown as import("../models/form-log.model.js").McfFormLogRow,
      ],
    });
    expect(result).toEqual([
      { id: "WAHF-w1", formType: "WAHF", submittedAt: "2026-09-01T12:00:00.000Z" },
    ]);
    expect(result[0]).not.toHaveProperty("assignment_grades");
  });
});

describe("buildTeamLeaderFormStatsForWeek", () => {
  it("keeps mentee_count -1 as required and treats it as 100% MCF", () => {
    const rows = buildTeamLeaderFormStatsForWeek(
      [
        {
          uid: "tl-1",
          first_name: "Ada",
          last_name: "Lovelace",
          program_role: "Team Leader",
          mentee_count: NO_MENTEE_RELATIONSHIP,
        },
      ],
      [],
      [],
      [],
    );
    expect(rows[0]).toMatchObject({
      scholarId: "tl-1",
      mcfRequired: -1,
      mcfCompleted: 0,
      mcfPct: 100,
      mcfLatestAt: "",
    });
  });

  it("uses mentee_count as MCF required when the TL has assignments", () => {
    const rows = buildTeamLeaderFormStatsForWeek(
      [
        {
          uid: "tl-2",
          first_name: "Grace",
          last_name: "Hopper",
          program_role: "Team Leader",
          mentee_count: 2,
        },
      ],
      [
        {
          mentor_uid: "tl-2",
          mentee_uid: "s-1",
          created_at: "2026-09-01T12:00:00.000Z",
          isLate: false,
        } as FormLogRowWithLate<McfFormLogRow>,
      ],
      [],
      [],
    );
    expect(rows[0]).toMatchObject({
      mcfRequired: 2,
      mcfCompleted: 1,
      mcfPct: 50,
    });
  });
});

describe("countableFormRequired", () => {
  it("treats the no-relationship sentinel as zero owed", () => {
    expect(countableFormRequired(NO_MENTEE_RELATIONSHIP)).toBe(0);
    expect(countableFormRequired(0)).toBe(0);
    expect(countableFormRequired(3)).toBe(3);
  });
});
