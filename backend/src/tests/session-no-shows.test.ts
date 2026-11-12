import { describe, expect, it } from "vitest";
import { findFrontDeskNoShows, findStudyNoShows } from "../services/session-no-shows.logic.js";
import type { ScholarShiftAssignment, SessionLogRow } from "../models/session-log.model.js";

const assignment: ScholarShiftAssignment = {
  scholar_id: "fictional-scholar",
  semester_id: "fictional-semester",
  session_kind: "study_session",
  day_of_week: 1,
  start_time: "14:00",
  end_time: "15:00",
  is_active: true,
};

const at = (time: string) => new Date(`2026-10-26T${time}:00-04:00`);

const entry = (time: string, sessionType = "Study Session"): SessionLogRow => ({
  id: "fictional-entry",
  scholar_uid: assignment.scholar_id,
  created_at: at(time).toISOString(),
  action_type: "Entry",
  session_type: sessionType,
});

function ids(rows: { scholarId: string }[]) {
  return rows.map((row) => row.scholarId);
}

describe("findStudyNoShows", () => {
  it("waits for threshold, includes boundary, excludes ended shifts", () => {
    expect(ids(findStudyNoShows([assignment], [], at("14:14")))).toEqual([]);
    const atThreshold = findStudyNoShows([assignment], [], at("14:15"));
    expect(ids(atThreshold)).toEqual([assignment.scholar_id]);
    expect(atThreshold[0]?.scheduledStart.toISOString()).toBe(at("14:00").toISOString());
    expect(atThreshold[0]?.scheduledEnd.toISOString()).toBe(at("15:00").toISOString());
    expect(ids(findStudyNoShows([assignment], [], at("15:00")))).toEqual([]);
  });

  it("accepts matching sign-ins including early grace window", () => {
    expect(ids(findStudyNoShows([assignment], [entry("13:45")], at("14:20")))).toEqual([]);
    expect(ids(findStudyNoShows([assignment], [entry("14:19")], at("14:20")))).toEqual([]);
  });

  it("ignores other kinds, future entries and out-of-window entries", () => {
    for (const row of [entry("14:00", "Tutoring"), entry("14:30"), entry("13:00")]) {
      expect(ids(findStudyNoShows([assignment], [row], at("14:20")))).toEqual([
        assignment.scholar_id,
      ]);
    }
  });

  it("excludes inactive, other-day and front-desk shifts; deduplicates", () => {
    expect(
      ids(
        findStudyNoShows(
          [
            { ...assignment, is_active: false },
            { ...assignment, day_of_week: 2 },
            { ...assignment, session_kind: "front_desk" },
          ],
          [],
          at("14:20"),
        ),
      ),
    ).toEqual([]);
    expect(ids(findStudyNoShows([assignment, assignment], [], at("14:20")))).toEqual([
      assignment.scholar_id,
    ]);
  });

  it("supports configured threshold", () => {
    expect(ids(findStudyNoShows([assignment], [], at("14:05"), 5))).toEqual([
      assignment.scholar_id,
    ]);
  });

  it("returns one row per missed shift when a scholar has multiple open assignments", () => {
    const overlapping: ScholarShiftAssignment = {
      ...assignment,
      start_time: "14:30",
      end_time: "15:30",
    };
    const missed = findStudyNoShows([assignment, overlapping], [], at("14:45"));
    expect(ids(missed)).toEqual([assignment.scholar_id, assignment.scholar_id]);
    expect(missed.map((row) => row.scheduledStart.toISOString())).toEqual([
      at("14:00").toISOString(),
      at("14:30").toISOString(),
    ]);
  });
});

describe("findFrontDeskNoShows", () => {
  const frontDeskAssignment: ScholarShiftAssignment = {
    ...assignment,
    session_kind: "front_desk",
  };

  it("waits for threshold and excludes ended shifts", () => {
    expect(ids(findFrontDeskNoShows([frontDeskAssignment], [], at("14:14")))).toEqual([]);
    expect(ids(findFrontDeskNoShows([frontDeskAssignment], [], at("14:15")))).toEqual([
      assignment.scholar_id,
    ]);
    expect(ids(findFrontDeskNoShows([frontDeskAssignment], [], at("15:00")))).toEqual([]);
  });

  it("accepts entries without a session-type field", () => {
    const row = entry("13:45");
    delete row.session_type;
    expect(ids(findFrontDeskNoShows([frontDeskAssignment], [row], at("14:20")))).toEqual([]);
    expect(
      ids(findFrontDeskNoShows([frontDeskAssignment], [entry("14:19", "Front Desk")], at("14:20"))),
    ).toEqual([]);
  });

  it("study or future entries cannot satisfy front desk attendance", () => {
    for (const row of [entry("14:00"), entry("14:30", "Front Desk"), entry("13:00", "Front Desk")]) {
      expect(ids(findFrontDeskNoShows([frontDeskAssignment], [row], at("14:20")))).toEqual([
        assignment.scholar_id,
      ]);
    }
  });

  it("excludes other-day, inactive and study assignments; deduplicates", () => {
    expect(
      ids(
        findFrontDeskNoShows(
          [
            assignment,
            { ...frontDeskAssignment, day_of_week: 2 },
            { ...frontDeskAssignment, is_active: false },
          ],
          [],
          at("14:20"),
        ),
      ),
    ).toEqual([]);
    expect(
      ids(findFrontDeskNoShows([frontDeskAssignment, frontDeskAssignment], [], at("14:20"))),
    ).toEqual([assignment.scholar_id]);
    expect(ids(findFrontDeskNoShows([frontDeskAssignment], [], at("14:05"), 5))).toEqual([
      assignment.scholar_id,
    ]);
  });
});
