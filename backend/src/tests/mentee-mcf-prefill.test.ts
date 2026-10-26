import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getMenteeReviewByMentorKey: vi.fn() }));

vi.mock("../services/mentee-review-activity.service.js", () => ({
  getMenteeReviewByMentorKey: mocks.getMenteeReviewByMentorKey,
}));

import {
  buildMcfPrefill,
  getMenteeMcfPrefill,
  isMcfTaskComplete,
  meetingDateForWeekday,
  programLocalDateString,
} from "../services/mentee-mcf-prefill.service.js";
import { MCF_ENTRY_IDS, MCF_OMITTED_ENTRY_IDS } from "../models/mentee-mcf-prefill.model.js";
import { parseEasternDate } from "../services/time.service.js";
import type {
  HourWeekSummary,
  MenteeReview,
  ShiftSessionKind,
  WeekReviewSummary,
} from "../models/mentee-review.model.js";

const asOf = new Date("2026-09-09T15:00:00.000Z");
const mondayWeek1 = parseEasternDate("2026-09-07");

function hourSummary(kind: ShiftSessionKind, over: Partial<HourWeekSummary> = {}): HourWeekSummary {
  return {
    kind,
    assignmentAvailable: true,
    loggedMinutes: 0,
    targetMinutes: null,
    percent: null,
    band: null,
    displayHours: 0,
    overageMinutes: 0,
    pending: false,
    noShowCount: 0,
    hasActivity: false,
    shifts: [],
    offShiftLogs: [],
    ...over,
  };
}

function weekReview(over: Partial<WeekReviewSummary> = {}): WeekReviewSummary {
  return {
    weekNumber: 1,
    weekStart: mondayWeek1.toISOString(),
    weekEnd: parseEasternDate("2026-09-13").toISOString(),
    phase: "current",
    hours: [
      hourSummary("front_desk", { loggedMinutes: 120, targetMinutes: 120, percent: 100 }),
      hourSummary("study_session", { loggedMinutes: 0, targetMinutes: 60, percent: 0 }),
    ],
    wahf: { status: "submitted", dueAt: asOf, submittedAt: asOf, onTime: true, submissionId: "w1" },
    tutoring: { status: "none", recordedAttendance: false, reports: [] },
    ...over,
  };
}

function review(over: Partial<MenteeReview> = {}): MenteeReview {
  const current = weekReview();
  return {
    asOf: asOf.toISOString(),
    mentee: { uid: "1001", fullName: "Ada Lovelace", email: "ada@umd.edu" },
    calendar: {
      semesterId: "1",
      semesterStart: mondayWeek1.toISOString(),
      semesterEnd: parseEasternDate("2026-12-11").toISOString(),
      currentWeek: 1,
      weeks: [],
      noActiveWeek: false,
    },
    currentWeek: 1,
    selectedWeek: 1,
    semesterGrid: { ok: true, data: [current], loadedAt: asOf.toISOString() },
    selectedWeekReview: { ok: true, data: current, loadedAt: asOf.toISOString() },
    latestGrades: {
      ok: true,
      data: { status: "empty", submissionId: null, submittedAt: null, entries: [] },
      loadedAt: asOf.toISOString(),
    },
    meetingPreference: { ok: true, data: null, loadedAt: asOf.toISOString() },
    ...over,
  };
}

function paramValues(url: string, key: string): string[] {
  return new URL(url).searchParams.getAll(key);
}

describe("buildMcfPrefill", () => {
  const base = {
    mentor: { fullName: "Grace Hopper", uid: "9001" },
    mentee: { fullName: "Ada Lovelace", uid: "1001" },
    weekStartMonday: mondayWeek1,
    asOf,
  };

  it("maps identities and appends to the fixed host", () => {
    const prefill = buildMcfPrefill({ ...base, currentWeek: weekReview(), meetingPreference: null });
    expect(prefill.url).toContain("/viewform?usp=pp_url&");
    expect(paramValues(prefill.url, MCF_ENTRY_IDS.mentorName)).toEqual(["Grace Hopper"]);
    expect(paramValues(prefill.url, MCF_ENTRY_IDS.mentorUid)).toEqual(["9001"]);
    expect(paramValues(prefill.url, MCF_ENTRY_IDS.menteeName)).toEqual(["Ada Lovelace"]);
    expect(paramValues(prefill.url, MCF_ENTRY_IDS.menteeUid)).toEqual(["1001"]);
    expect(prefill.weekStart).toBe("2026-09-07");
    expect(prefill.generatedAt).toBe(asOf.toISOString());
  });

  it("repeats the Tasks completed key once per completed task in fixed order", () => {
    const prefill = buildMcfPrefill({
      ...base,
      currentWeek: weekReview({
        hours: [
          hourSummary("front_desk", { loggedMinutes: 120, targetMinutes: 120 }),
          hourSummary("study_session", { loggedMinutes: 90, targetMinutes: 90 }),
        ],
        wahf: { status: "submitted", dueAt: asOf, submittedAt: asOf, onTime: true, submissionId: "w" },
      }),
      meetingPreference: null,
    });
    expect(paramValues(prefill.url, MCF_ENTRY_IDS.tasksCompleted)).toEqual([
      "Front Desk",
      "Study Sessions",
      "WAHF",
    ]);
  });

  it("includes a task at exactly 90% of an unrounded total and excludes below", () => {
    expect(isMcfTaskComplete(hourSummary("front_desk", { loggedMinutes: 90, targetMinutes: 100 }))).toBe(true);
    expect(isMcfTaskComplete(hourSummary("front_desk", { loggedMinutes: 899, targetMinutes: 1000 }))).toBe(false);
  });

  it("still includes a met task even when a no-show occurred", () => {
    const prefill = buildMcfPrefill({
      ...base,
      currentWeek: weekReview({
        hours: [
          hourSummary("front_desk", { loggedMinutes: 120, targetMinutes: 120, noShowCount: 1 }),
          hourSummary("study_session", { loggedMinutes: 0, targetMinutes: 60 }),
        ],
        wahf: { status: "pending", dueAt: asOf, submittedAt: null, onTime: null, submissionId: null },
      }),
      meetingPreference: null,
    });
    expect(paramValues(prefill.url, MCF_ENTRY_IDS.tasksCompleted)).toEqual(["Front Desk"]);
  });

  it("excludes tasks without a positive target and leaves GA/None unset", () => {
    const prefill = buildMcfPrefill({
      ...base,
      currentWeek: weekReview({
        hours: [
          hourSummary("front_desk", { loggedMinutes: 300, targetMinutes: null }),
          hourSummary("study_session", { loggedMinutes: 300, targetMinutes: 0 }),
        ],
        wahf: { status: "missing", dueAt: asOf, submittedAt: null, onTime: null, submissionId: null },
      }),
      meetingPreference: null,
    });
    expect(paramValues(prefill.url, MCF_ENTRY_IDS.tasksCompleted)).toEqual([]);
    expect(prefill.url).not.toContain("GA Check-in");
    expect(prefill.url).not.toContain("None");
  });

  it("sets tutoring Yes/No from recorded attendance only", () => {
    const yes = buildMcfPrefill({
      ...base,
      currentWeek: weekReview({ tutoring: { status: "recorded", recordedAttendance: true, reports: [] } }),
      meetingPreference: null,
    });
    expect(paramValues(yes.url, MCF_ENTRY_IDS.tutoringAttendance)).toEqual(["Yes"]);

    const no = buildMcfPrefill({
      ...base,
      currentWeek: weekReview({ tutoring: { status: "none", recordedAttendance: false, reports: [] } }),
      meetingPreference: null,
    });
    expect(paramValues(no.url, MCF_ENTRY_IDS.tutoringAttendance)).toEqual(["No"]);
  });

  it("omits both meeting fields when no preference is saved", () => {
    const prefill = buildMcfPrefill({ ...base, currentWeek: weekReview(), meetingPreference: null });
    expect(prefill.url).not.toContain(MCF_ENTRY_IDS.meetingDay);
    expect(prefill.url).not.toContain(MCF_ENTRY_IDS.meetingTime);
  });

  it("writes the saved weekday's date within the week and 24-hour time", () => {
    const wed = buildMcfPrefill({
      ...base,
      currentWeek: weekReview(),
      meetingPreference: { weekday: 3, meetingTime: "14:30" },
    });
    expect(paramValues(wed.url, MCF_ENTRY_IDS.meetingDay)).toEqual(["2026-09-09"]);
    expect(paramValues(wed.url, MCF_ENTRY_IDS.meetingTime)).toEqual(["14:30"]);
  });

  it("never appends the blank attestation entries", () => {
    const prefill = buildMcfPrefill({ ...base, currentWeek: weekReview(), meetingPreference: null });
    for (const key of Object.values(MCF_OMITTED_ENTRY_IDS)) {
      expect(prefill.url).not.toContain(key);
    }
  });

  it("maps Sunday to the last day of the week", () => {
    expect(meetingDateForWeekday(mondayWeek1, 7)).toBe("2026-09-13");
    expect(programLocalDateString(mondayWeek1)).toBe("2026-09-07");
  });
});

describe("getMenteeMcfPrefill", () => {
  beforeEach(() => vi.clearAllMocks());

  const params = {
    mentorId: "mentor-1",
    mentorFullName: "Grace Hopper",
    mentorUid: "9001",
    menteeUid: "1001",
    asOf,
  };

  it("recomposes the current week fresh (no explicit selected week) and returns a prefill", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(review());
    const result = await getMenteeMcfPrefill(params);
    expect(mocks.getMenteeReviewByMentorKey).toHaveBeenCalledWith({
      mentorKey: "mentor-1",
      menteeUid: "1001",
      selectedWeek: null,
      asOf,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data).sort()).toEqual(["generatedAt", "url", "weekStart"]);
      expect(result.data.weekStart).toBe("2026-08-31"); // campus week 1 Monday
    }
  });

  it("uses the week that is current at activation (rollover), not a stale constant", async () => {
    const week2Monday = parseEasternDate("2026-09-07");
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(
      review({
        currentWeek: 2,
        calendar: {
          semesterId: "1",
          semesterStart: mondayWeek1.toISOString(),
          semesterEnd: parseEasternDate("2026-12-11").toISOString(),
          currentWeek: 2,
          weeks: [],
          noActiveWeek: false,
        },
      })
    );
    const result = await getMenteeMcfPrefill(params);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.weekStart).toBe(programLocalDateString(week2Monday));
  });

  it("blocks on a missing mentor UID without reading the review", async () => {
    const result = await getMenteeMcfPrefill({ ...params, mentorUid: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("mentor_uid_unavailable");
    expect(mocks.getMenteeReviewByMentorKey).not.toHaveBeenCalled();
  });

  it("blocks an unassigned mentee", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(null);
    const result = await getMenteeMcfPrefill(params);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("mentee_not_found");
  });

  it("blocks when there is no active week", async () => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(
      review({
        currentWeek: null,
        calendar: { semesterId: null, semesterStart: null, semesterEnd: null, currentWeek: null, weeks: [], noActiveWeek: true },
        selectedWeek: null,
        selectedWeekReview: { ok: true, data: null, loadedAt: asOf.toISOString() },
      })
    );
    const result = await getMenteeMcfPrefill(params);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_active_week");
  });

  it.each([
    ["attendance", { selectedWeekReview: { ok: false, error: { code: "x", message: "y", retriable: true } } }, "attendance_unavailable"],
    ["null current week", { selectedWeekReview: { ok: true, data: null, loadedAt: asOf.toISOString() } }, "no_current_week"],
    ["wahf unknown", { selectedWeekReview: { ok: true, data: weekReview({ wahf: { status: "unknown", dueAt: asOf, submittedAt: null, onTime: null, submissionId: null } }), loadedAt: asOf.toISOString() } }, "wahf_unavailable"],
    ["tutoring unknown", { selectedWeekReview: { ok: true, data: weekReview({ tutoring: { status: "unknown", recordedAttendance: false, reports: [] } }), loadedAt: asOf.toISOString() } }, "tutoring_unavailable"],
    ["preference error", { meetingPreference: { ok: false, error: { code: "x", message: "y", retriable: true } } }, "meeting_preference_unavailable"],
  ] as const)("blocks on %s rather than fabricating a No/completion", async (_label, over, expected) => {
    mocks.getMenteeReviewByMentorKey.mockResolvedValue(review(over as Partial<MenteeReview>));
    const result = await getMenteeMcfPrefill(params);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(expected);
  });
});
