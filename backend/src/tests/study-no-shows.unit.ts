import { test } from "node:test";
import assert from "node:assert/strict";
import { findStudyNoShowIds, findFrontDeskNoShowIds } from "../services/study-no-shows.logic.js";
import type { ScholarShiftAssignment, SessionLogRow } from "../models/session-log.model.js";

const assignment: ScholarShiftAssignment = {
  scholar_id: "fictional-scholar", semester_id: "fictional-semester", session_kind: "study_session",
  day_of_week: 1, start_time: "14:00", end_time: "15:00", is_active: true,
};
const at = (time: string) => new Date("2026-10-26T" + time + ":00-04:00");
const entry = (time: string, sessionType = "Study Session"): SessionLogRow => ({
  id: "fictional-entry", scholar_uid: assignment.scholar_id, created_at: at(time).toISOString(), action_type: "Entry", session_type: sessionType,
});
test("waits for threshold, includes boundary, excludes ended shifts", () => {
  assert.deepEqual(findStudyNoShowIds([assignment], [], at("14:14")), []);
  assert.deepEqual(findStudyNoShowIds([assignment], [], at("14:15")), [assignment.scholar_id]);
  assert.deepEqual(findStudyNoShowIds([assignment], [], at("15:00")), []);
});
test("accepts matching sign-ins including early grace window", () => {
  assert.deepEqual(findStudyNoShowIds([assignment], [entry("13:45")], at("14:20")), []);
  assert.deepEqual(findStudyNoShowIds([assignment], [entry("14:19")], at("14:20")), []);
});
test("ignores other kinds, future entries and out-of-window entries", () => {
  for (const row of [entry("14:00", "Tutoring"), entry("14:30"), entry("13:00")]) {
    assert.deepEqual(findStudyNoShowIds([assignment], [row], at("14:20")), [assignment.scholar_id]);
  }
});
test("excludes inactive, other-day and front-desk shifts; deduplicates", () => {
  assert.deepEqual(findStudyNoShowIds([
    { ...assignment, is_active: false }, { ...assignment, day_of_week: 2 },
    { ...assignment, session_kind: "front_desk" },
  ], [], at("14:20")), []);
  assert.deepEqual(findStudyNoShowIds([assignment, assignment], [], at("14:20")), [assignment.scholar_id]);
});
test("supports configured threshold", () => {
  assert.deepEqual(findStudyNoShowIds([assignment], [], at("14:05"), 5), [assignment.scholar_id]);
});

const frontDeskAssignment: ScholarShiftAssignment = { ...assignment, session_kind: "front_desk" };
test("front desk waits for threshold and excludes ended shifts", () => {
  assert.deepEqual(findFrontDeskNoShowIds([frontDeskAssignment], [], at("14:14")), []);
  assert.deepEqual(findFrontDeskNoShowIds([frontDeskAssignment], [], at("14:15")), [assignment.scholar_id]);
  assert.deepEqual(findFrontDeskNoShowIds([frontDeskAssignment], [], at("15:00")), []);
});
test("front desk accepts entries without a session-type field", () => {
  const row = entry("13:45");
  delete row.session_type;
  assert.deepEqual(findFrontDeskNoShowIds([frontDeskAssignment], [row], at("14:20")), []);
  assert.deepEqual(findFrontDeskNoShowIds([frontDeskAssignment], [entry("14:19", "Front Desk")], at("14:20")), []);
});
test("study or future entries cannot satisfy front desk attendance", () => {
  for (const row of [entry("14:00"), entry("14:30", "Front Desk"), entry("13:00", "Front Desk")]) {
    assert.deepEqual(findFrontDeskNoShowIds([frontDeskAssignment], [row], at("14:20")), [assignment.scholar_id]);
  }
});
test("front desk excludes other-day, inactive and study assignments; deduplicates", () => {
  assert.deepEqual(findFrontDeskNoShowIds([assignment, { ...frontDeskAssignment, day_of_week: 2 }, { ...frontDeskAssignment, is_active: false }], [], at("14:20")), []);
  assert.deepEqual(findFrontDeskNoShowIds([frontDeskAssignment, frontDeskAssignment], [], at("14:20")), [assignment.scholar_id]);
  assert.deepEqual(findFrontDeskNoShowIds([frontDeskAssignment], [], at("14:05"), 5), [assignment.scholar_id]);
});
