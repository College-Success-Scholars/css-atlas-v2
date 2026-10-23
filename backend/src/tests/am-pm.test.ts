import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import {
  buildAmPmChecklistRows,
  summarizeTaskCompletion,
} from "../services/am-pm.service.js";
import {
  SHIFT_CLOSING,
  SHIFT_MAIN,
  SHIFT_OPENING,
} from "../../../shared/dist/front-desk-ampm-config.js";
import type { AmPmChecklistDto, AmPmFormLogRow } from "../models/am-pm.model.js";
import type { TeamLeaderNameRecord } from "../models/form-log.model.js";

const TEAM_LEADERS: TeamLeaderNameRecord[] = [
  { uid: "tl-1", first_name: "Ben", last_name: "Sandoval" },
  { uid: "tl-2", first_name: "Miguel", last_name: "Reyes" },
];

const NAMES = new Map([
  ["uid-1", "Amara Osei"],
  ["uid-2", "Devin Park"],
]);

// A Wednesday in EDT, well clear of either DST transition.
const at = (clock: string) => `2026-10-14T${clock}:00-04:00`;

function row(overrides: Partial<AmPmFormLogRow> = {}): AmPmFormLogRow {
  return {
    id: 1,
    uid: "uid-1",
    shift: SHIFT_MAIN,
    created_at: at("17:52"),
    leader_name: "Ben Sandoval",
    task_completion: { a: true, b: true, c: false },
    ...overrides,
  };
}

/** Build a single row and narrow it — the suite always passes exactly one. */
function buildOne(overrides: Partial<AmPmFormLogRow> = {}): AmPmChecklistDto {
  const dtos = buildAmPmChecklistRows([row(overrides)], TEAM_LEADERS, NAMES);
  const dto = dtos[0];
  if (!dto) throw new Error("expected buildAmPmChecklistRows to return one row");
  return dto;
}

describe("summarizeTaskCompletion", () => {
  it("counts truthy values of an object", () => {
    expect(summarizeTaskCompletion({ a: true, b: false, c: true })).toEqual({
      completed: 2,
      total: 3,
    });
  });

  it("counts truthy entries of an array", () => {
    expect(summarizeTaskCompletion([true, true, false, true])).toEqual({
      completed: 3,
      total: 4,
    });
  });

  it("reports 0/0 for shapes it cannot read, rather than throwing", () => {
    expect(summarizeTaskCompletion(null)).toEqual({ completed: 0, total: 0 });
    expect(summarizeTaskCompletion(undefined)).toEqual({ completed: 0, total: 0 });
    expect(summarizeTaskCompletion("done")).toEqual({ completed: 0, total: 0 });
    expect(summarizeTaskCompletion(7)).toEqual({ completed: 0, total: 0 });
  });
});

describe("buildAmPmChecklistRows — shift validity", () => {
  it("accepts a submission inside the claimed shift", () => {
    const dto = buildOne();
    expect(dto.shiftValid).toBe(true);
    expect(dto.reminderOwed).toBe(false);
  });

  it("accepts a submission inside the trailing grace hour", () => {
    // Opening runs 8-10 AM; grace extends the window to 11 AM.
    const dto = buildOne({ shift: SHIFT_OPENING, created_at: at("10:45") });
    expect(dto.shiftValid).toBe(true);
  });

  it("rejects a submission past the grace window and owes a reminder", () => {
    const dto = buildOne({ created_at: at("22:15") });
    expect(dto.shiftValid).toBe(false);
    expect(dto.reminderOwed).toBe(true);
  });

  it("rejects a submission before the claimed shift started", () => {
    const dto = buildOne({ shift: SHIFT_CLOSING, created_at: at("13:00") });
    expect(dto.shiftValid).toBe(false);
  });

  it("rejects an unrecognised shift label", () => {
    const dto = buildOne({ shift: "9:00 AM - 5:00 PM" });
    expect(dto.shiftValid).toBe(false);
  });
});

describe("buildAmPmChecklistRows — nullable columns", () => {
  it("handles a null shift without throwing", () => {
    const dto = buildOne({ shift: null });
    expect(dto.shiftValid).toBe(false);
    expect(dto.shift).toBeNull();
  });

  it("handles a null timestamp without throwing", () => {
    const dto = buildOne({ created_at: null });
    expect(dto.shiftValid).toBe(false);
    expect(dto.submittedAt).toBeNull();
  });

  it("handles a null uid and an unknown name", () => {
    const dto = buildOne({ uid: null });
    expect(dto.scholarUid).toBeNull();
    expect(dto.scholarName).toBeNull();
  });

  it("leaves scholarName null when the uid is not in the name map", () => {
    const dto = buildOne({ uid: "uid-999" });
    expect(dto.scholarUid).toBe("uid-999");
    expect(dto.scholarName).toBeNull();
  });
});

describe("buildAmPmChecklistRows — leader matching", () => {
  it("resolves an exact leader name to a roster uid", () => {
    const dto = buildOne();
    expect(dto.leaderMatch).toEqual({ uid: "tl-1", displayName: "Ben Sandoval" });
  });

  it("resolves a lowercase, partial leader name", () => {
    const dto = buildOne({ leader_name: "miguel reyes" });
    expect(dto.leaderMatch?.uid).toBe("tl-2");
  });

  it("returns no match for a name nobody on the roster shares", () => {
    const dto = buildOne({ leader_name: "Zebadiah Quilsworth" });
    expect(dto.leaderMatch).toBeNull();
    expect(dto.leaderName).toBe("Zebadiah Quilsworth");
  });

  it("returns no match for a null or blank leader name", () => {
    expect(buildOne({ leader_name: null }).leaderMatch).toBeNull();
    expect(buildOne({ leader_name: "   " }).leaderMatch).toBeNull();
  });
});

describe("AM/PM checklist routes — auth gating", () => {
  it("GET /api/form-logs/am-pm/week/:weekNum returns 401 without a token", async () => {
    const res = await request(app).get("/api/form-logs/am-pm/week/3");
    expect(res.status).toBe(401);
  });

  it("POST /api/form-logs/am-pm/by-uids returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/form-logs/am-pm/by-uids")
      .send({ uids: ["uid-1"] });
    expect(res.status).toBe(401);
  });

  it("does not fall through to the generic /:formType/:formId handler", async () => {
    // Without the dedicated route registered first, "am-pm"/"week" would be
    // read as a formType/formId pair.
    const res = await request(app).get("/api/form-logs/am-pm/week/3");
    expect(res.status).not.toBe(404);
  });
});
