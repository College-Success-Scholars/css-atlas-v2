import { describe, expect, it } from "vitest";
import {
  assignmentOccurrenceRef,
  assignmentOverlapsWindow,
  assignmentsOccurringOn,
  expandAssignmentOccurrences,
  fetchEffectiveAssignments,
  findSemesterForDate,
  isAssignmentEffectiveOn,
} from "../services/shift-assignment.service.js";
import type { ScholarShiftAssignment } from "../models/session-log.model.js";
import type { ServiceSupabaseClient } from "../supabase/client.js";
import { callsTo, fakeQuery } from "./helpers/fake-query.js";

function row(overrides: Partial<ScholarShiftAssignment> = {}): ScholarShiftAssignment {
  return {
    id: "a1",
    scholar_id: "S1",
    semester_id: 7,
    session_kind: "front_desk",
    day_of_week: 1,
    start_time: "09:00:00",
    end_time: "11:00:00",
    effective_from: "2026-09-01",
    effective_until: "2026-12-20",
    ...overrides,
  };
}

function clientFor(table: string, query: unknown) {
  return { from: (name: string) => (name === table ? { select: () => query } : (() => { throw new Error(`unexpected table ${name}`); })()) } as unknown as ServiceSupabaseClient;
}

const eastern = (date: string) => new Date(`${date}T12:00:00-04:00`);

describe("isAssignmentEffectiveOn", () => {
  it("includes effective_from and excludes effective_until", () => {
    const a = row({ effective_from: "2026-10-05", effective_until: "2026-10-12" });
    expect(isAssignmentEffectiveOn(a, "2026-10-04")).toBe(false);
    expect(isAssignmentEffectiveOn(a, "2026-10-05")).toBe(true);
    expect(isAssignmentEffectiveOn(a, "2026-10-11")).toBe(true);
    expect(isAssignmentEffectiveOn(a, "2026-10-12")).toBe(false);
  });

  it("treats a window as overlapping only when a date inside it is effective", () => {
    const a = row({ effective_from: "2026-10-05", effective_until: "2026-10-12" });
    expect(assignmentOverlapsWindow(a, "2026-09-28", "2026-10-04")).toBe(false);
    expect(assignmentOverlapsWindow(a, "2026-09-28", "2026-10-05")).toBe(true);
    expect(assignmentOverlapsWindow(a, "2026-10-11", "2026-10-18")).toBe(true);
    expect(assignmentOverlapsWindow(a, "2026-10-12", "2026-10-18")).toBe(false);
  });
});

describe("expandAssignmentOccurrences", () => {
  it("keeps past occurrences on the truncated row and future ones on the replacement", () => {
    const oldRow = row({ id: "old", effective_until: "2026-10-12", start_time: "09:00:00" });
    const moved = row({ id: "new", effective_from: "2026-10-12", start_time: "10:00:00" });
    const occurrences = expandAssignmentOccurrences([oldRow, moved], eastern("2026-10-05"), eastern("2026-10-19"));
    expect(occurrences.map((o) => `${o.dateKey}:${o.assignment.id}`)).toEqual([
      "2026-10-05:old",
      "2026-10-12:new",
      "2026-10-19:new",
    ]);
  });

  it("gives an unchanged assignment the same occurrence ref regardless of the window", () => {
    const unchanged = row({ id: "same" });
    const a = expandAssignmentOccurrences([unchanged], eastern("2026-10-05"), eastern("2026-10-12"));
    const b = expandAssignmentOccurrences([unchanged], eastern("2026-10-12"), eastern("2026-10-19"));
    expect(a[1]!.occurrenceRef).toBe("same:2026-10-12");
    expect(b[0]!.occurrenceRef).toBe(a[1]!.occurrenceRef);
    expect(assignmentOccurrenceRef(unchanged, "2026-10-12")).toBe("same:2026-10-12");
  });

  it("changes the ref for a moved shift because it is a new row", () => {
    const before = assignmentOccurrenceRef(row({ id: "old" }), "2026-10-19");
    const after = assignmentOccurrenceRef(row({ id: "new" }), "2026-10-19");
    expect(after).not.toBe(before);
  });

  it("stays on the Eastern calendar across the fall-back DST change", () => {
    const sunday = row({ day_of_week: 0, effective_from: "2026-10-01", effective_until: "2026-12-01" });
    const dates = expandAssignmentOccurrences([sunday], eastern("2026-10-25"), eastern("2026-11-08")).map((o) => o.dateKey);
    expect(dates).toEqual(["2026-10-25", "2026-11-01", "2026-11-08"]);
  });

  it("filters to assignments occurring on one day", () => {
    const rows = [row({ id: "mon" }), row({ id: "tue", day_of_week: 2 }), row({ id: "gone", effective_until: "2026-10-05" })];
    expect(assignmentsOccurringOn(rows, eastern("2026-10-05")).map((a) => a.id)).toEqual(["mon"]);
  });
});

describe("fetchEffectiveAssignments", () => {
  it("bounds the read by the effective window and the requested filters", async () => {
    const { query, calls } = fakeQuery({ data: [row()] });
    const rows = await fetchEffectiveAssignments(clientFor("scholar_shift_assignments", query), {
      startKey: "2026-10-05",
      endKey: "2026-10-11",
      scholarIds: ["S1"],
      semesterId: "7",
      kind: "front_desk",
      dayOfWeek: 1,
    });
    expect(rows).toHaveLength(1);
    expect(callsTo(calls, "lte")).toEqual([["effective_from", "2026-10-11"]]);
    expect(callsTo(calls, "gt")).toEqual([["effective_until", "2026-10-05"]]);
    expect(callsTo(calls, "in")).toEqual([["scholar_id", ["S1"]]]);
    expect(callsTo(calls, "eq")).toEqual([["semester_id", 7], ["session_kind", "front_desk"], ["day_of_week", 1]]);
  });

  it("does not query when given an empty scholar list", async () => {
    const { query, calls } = fakeQuery({ data: [row()] });
    await expect(
      fetchEffectiveAssignments(clientFor("scholar_shift_assignments", query), { startKey: "a", endKey: "b", scholarIds: [] }),
    ).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it("pages through every row past the Data API limit", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row({ id: `a${i}` }));
    const { query, calls } = fakeQuery((range) => ({ data: range?.from === 0 ? full : [row({ id: "last" })] }));
    const rows = await fetchEffectiveAssignments(clientFor("scholar_shift_assignments", query), {
      startKey: "2026-10-05",
      endKey: "2026-10-05",
    });
    expect(rows).toHaveLength(1001);
    expect(callsTo(calls, "range")).toEqual([[0, 999], [1000, 1999]]);
  });

  it("drops rows outside the window even if the database returned them", async () => {
    const { query } = fakeQuery({ data: [row({ id: "late", effective_from: "2026-12-01" })] });
    await expect(
      fetchEffectiveAssignments(clientFor("scholar_shift_assignments", query), { startKey: "2026-10-05", endKey: "2026-10-11" }),
    ).resolves.toEqual([]);
  });

  it("surfaces database errors", async () => {
    const { query } = fakeQuery({ data: null, error: { message: "boom" } });
    await expect(
      fetchEffectiveAssignments(clientFor("scholar_shift_assignments", query), { startKey: "a", endKey: "b" }),
    ).rejects.toEqual({ message: "boom" });
  });
});

describe("findSemesterForDate", () => {
  it("looks up the semester containing the date without requiring it to be active", async () => {
    const { query, calls } = fakeQuery({ data: [{ id: 3, start_date: "2026-01-20", end_date: "2026-05-15" }] });
    const semester = await findSemesterForDate(clientFor("semesters", query), "2026-03-02");
    expect(semester?.id).toBe(3);
    expect(callsTo(calls, "lte")).toEqual([["start_date", "2026-03-02"]]);
    expect(callsTo(calls, "gte")).toEqual([["end_date", "2026-03-02"]]);
    expect(callsTo(calls, "eq")).toEqual([]);
  });

  it("returns null between semesters", async () => {
    const { query } = fakeQuery({ data: [] });
    await expect(findSemesterForDate(clientFor("semesters", query), "2026-06-30")).resolves.toBeNull();
  });
});
