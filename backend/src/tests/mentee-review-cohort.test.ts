import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MenteeRow } from "../models/mentee.model.js";

const mocks = vi.hoisted(() => ({
  getMenteeByUid: vi.fn(),
  getMenteesByMentorKey: vi.fn(),
  getActiveSemesterRow: vi.fn(),
  getMeetingPreference: vi.fn(),
  fetchMenteeAttendanceEvidence: vi.fn(),
  getWhafFormLogsByUid: vi.fn(),
  getWhafDeadlineForWeek: vi.fn(),
  getTutorReportLogsByUid: vi.fn(),
}));

vi.mock("../services/mentee.service.js", () => ({
  getMenteeByUid: mocks.getMenteeByUid,
  getMenteesByMentorKey: mocks.getMenteesByMentorKey,
}));
vi.mock("../services/semester.service.js", () => ({
  getActiveSemesterRow: mocks.getActiveSemesterRow,
}));
vi.mock("../services/mentee-meeting-preference.service.js", () => ({
  getMeetingPreference: mocks.getMeetingPreference,
}));
vi.mock("../services/mentee-review-attendance.adapter.js", () => ({
  fetchMenteeAttendanceEvidence: mocks.fetchMenteeAttendanceEvidence,
}));
vi.mock("../services/form-log.service.js", () => ({
  getWhafFormLogsByUid: mocks.getWhafFormLogsByUid,
  getWhafDeadlineForWeek: mocks.getWhafDeadlineForWeek,
}));
vi.mock("../services/tutor-report-log.service.js", () => ({
  getTutorReportLogsByUid: mocks.getTutorReportLogsByUid,
  filterTutorReportsForCampusWeek: (rows: unknown[]) => rows,
}));

import {
  getMenteeReviewByMentorKey,
  getMenteeReviewByUid,
} from "../services/mentee-review-activity.service.js";

const asOf = new Date("2026-09-10T16:00:00.000Z");
const params = { menteeUid: "S1", selectedWeek: 1, asOf };
const mentee: MenteeRow = {
  scholar_uid: "S1",
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@umd.edu",
  fd_required: 300,
  ss_required: 300,
};

const entrypoints = [
  { name: "mentor-owned", review: () => getMenteeReviewByMentorKey({ ...params, mentorKey: "mentor-1" }) },
  { name: "directory", review: () => getMenteeReviewByUid(params) },
];

describe.each(entrypoints)("$name review cohort propagation", ({ name, review }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getActiveSemesterRow.mockResolvedValue({ id: 1, start_date: "2026-08-31", end_date: "2026-12-12" });
    mocks.getMeetingPreference.mockResolvedValue(null);
    mocks.fetchMenteeAttendanceEvidence.mockResolvedValue({ shifts: [], logs: [], nonTerminalDates: [] });
    mocks.getWhafFormLogsByUid.mockResolvedValue([]);
    mocks.getTutorReportLogsByUid.mockResolvedValue([]);
  });

  it.each([2026, 2025, null, undefined])("composes the roster cohort %p into the review identity", async (cohort) => {
    const row = cohort === undefined ? mentee : { ...mentee, cohort };
    mocks.getMenteesByMentorKey.mockResolvedValue([row]);
    mocks.getMenteeByUid.mockResolvedValue(row);

    const result = await review();

    expect(result?.mentee).toEqual({
      uid: "S1",
      fullName: "Ada Lovelace",
      email: "ada@umd.edu",
      cohort: cohort ?? null,
    });
    expect(mocks.fetchMenteeAttendanceEvidence).toHaveBeenCalledTimes(1);
    if (name === "mentor-owned") {
      expect(mocks.getMenteesByMentorKey).toHaveBeenCalledWith("mentor-1");
      expect(mocks.getMenteeByUid).not.toHaveBeenCalled();
    } else {
      expect(mocks.getMenteeByUid).toHaveBeenCalledWith("S1");
      expect(mocks.getMenteesByMentorKey).not.toHaveBeenCalled();
      expect(mocks.getMeetingPreference).not.toHaveBeenCalled();
    }
  });

  it("preserves cohort when no semester is active", async () => {
    const row = { ...mentee, cohort: 2025 };
    mocks.getMenteesByMentorKey.mockResolvedValue([row]);
    mocks.getMenteeByUid.mockResolvedValue(row);
    mocks.getActiveSemesterRow.mockResolvedValue(null);

    const result = await review();

    expect(result?.mentee).toHaveProperty("cohort", 2025);
    expect(result?.calendar.noActiveWeek).toBe(true);
    expect(mocks.fetchMenteeAttendanceEvidence).not.toHaveBeenCalled();
  });
});
