import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsTo, fakeQuery, type RecordedCall } from "./helpers/fake-query.js";

const mocks = vi.hoisted(() => ({ client: { from: vi.fn() } }));

vi.mock("../supabase/client.js", () => ({
  getSupabaseServiceRoleClient: () => mocks.client,
  getSupabaseClient: () => mocks.client,
}));

import { fetchAssignmentsForDate } from "../domains/notifications/detectors/detector-data.js";

type Tables = Record<string, { data: unknown }>;

function useTables(tables: Tables) {
  const recorded: Record<string, RecordedCall[]> = {};
  mocks.client.from.mockImplementation((table: string) => {
    const entry = tables[table];
    if (!entry) throw new Error(`unexpected table ${table}`);
    const { query, calls } = fakeQuery(entry);
    recorded[table] = calls;
    return { select: () => query };
  });
  return recorded;
}

const assignment = {
  id: "a1",
  scholar_id: "S1",
  semester_id: 3,
  session_kind: "front_desk",
  day_of_week: 1,
  start_time: "09:00:00",
  end_time: "10:00:00",
  effective_from: "2026-01-20",
  effective_until: "2026-05-16",
};

describe("fetchAssignmentsForDate", () => {
  beforeEach(() => {
    mocks.client.from.mockReset();
  });

  it("resolves the semester containing the requested historical date, not the active one", async () => {
    const recorded = useTables({
      semesters: { data: [{ id: 3, start_date: "2026-01-20", end_date: "2026-05-15" }] },
      semester_breaks: { data: [] },
      scholar_shift_assignments: { data: [assignment] },
    });

    const rows = await fetchAssignmentsForDate(new Date("2026-03-02T12:00:00-05:00"));

    expect(rows.map((r) => r.id)).toEqual(["a1"]);
    expect(callsTo(recorded.semesters!, "lte")).toEqual([["start_date", "2026-03-02"]]);
    expect(callsTo(recorded.semesters!, "gte")).toEqual([["end_date", "2026-03-02"]]);
    expect(callsTo(recorded.semesters!, "eq")).toEqual([]);
    expect(callsTo(recorded.scholar_shift_assignments!, "eq")).toEqual([["semester_id", 3], ["day_of_week", 1]]);
    expect(callsTo(recorded.scholar_shift_assignments!, "lte")).toEqual([["effective_from", "2026-03-02"]]);
    expect(callsTo(recorded.scholar_shift_assignments!, "gt")).toEqual([["effective_until", "2026-03-02"]]);
  });

  it("returns nothing between semesters and reads no assignments", async () => {
    useTables({ semesters: { data: [] } });
    await expect(fetchAssignmentsForDate(new Date("2026-06-30T12:00:00-04:00"))).resolves.toEqual([]);
    expect(mocks.client.from).toHaveBeenCalledTimes(1);
  });

  it("returns nothing on a semester break", async () => {
    useTables({
      semesters: { data: [{ id: 3, start_date: "2026-01-20", end_date: "2026-05-15" }] },
      semester_breaks: { data: [{ id: 1 }] },
    });
    await expect(fetchAssignmentsForDate(new Date("2026-03-02T12:00:00-05:00"))).resolves.toEqual([]);
  });

  it("drops rows whose effective window does not include the date", async () => {
    useTables({
      semesters: { data: [{ id: 3, start_date: "2026-01-20", end_date: "2026-05-15" }] },
      semester_breaks: { data: [] },
      scholar_shift_assignments: { data: [{ ...assignment, effective_until: "2026-03-02" }] },
    });
    await expect(fetchAssignmentsForDate(new Date("2026-03-02T12:00:00-05:00"))).resolves.toEqual([]);
  });
});
