import { describe, expect, it } from "vitest";
import {
  STUDY_FOLLOW_UP_CC,
  FRONT_DESK_FOLLOW_UP_CC,
  buildFollowUpDrafts,
  type BuildFollowUpDraftsInput,
} from "./follow-up-drafts";
import type { HourWeekSummary, ShiftEvidence, ShiftSessionKind, ShiftStatus } from "@/lib/types/mentee-review";

const weekStart = "2026-09-07T04:00:00.000Z";
const weekEnd = "2026-09-13T04:00:00.000Z";

function shift(status: ShiftStatus, kind: ShiftSessionKind): ShiftEvidence {
  return {
    sourceId: "s1",
    kind,
    date: "2026-09-08",
    scheduledStart: "2026-09-08T19:00:00.000Z",
    scheduledEnd: "2026-09-08T21:00:00.000Z",
    scheduledMinutes: 120,
    overlapMinutes: status === "no_show" ? 0 : 120,
    status,
  };
}

function hours(kind: ShiftSessionKind, over: Partial<HourWeekSummary> = {}): HourWeekSummary {
  return {
    kind,
    assignmentAvailable: true,
    loggedMinutes: 120,
    targetMinutes: 120,
    percent: 100,
    band: "green",
    displayHours: 2,
    overageMinutes: 0,
    pending: false,
    noShowCount: 0,
    hasActivity: true,
    shifts: [shift("attended", kind)],
    offShiftLogs: [],
    ...over,
  };
}

function input(over: Partial<BuildFollowUpDraftsInput> = {}): BuildFollowUpDraftsInput {
  return {
    menteeFirstName: "Ada",
    menteeEmail: "ada@umd.edu",
    weekNumber: 1,
    weekStart,
    weekEnd,
    phase: "current",
    hours: [hours("front_desk"), hours("study_session")],
    wahf: { status: "submitted", dueAt: "2026-09-10T23:59:59.000Z", submittedAt: "2026-09-09T12:00:00.000Z", onTime: true, submissionId: "w1" },
    ...over,
  };
}

describe("buildFollowUpDrafts", () => {
  it("returns nothing for a clean week", () => {
    expect(buildFollowUpDrafts(input())).toEqual([]);
  });

  it("drafts a front desk no-show with the front desk CC and specific shift", () => {
    const drafts = buildFollowUpDrafts(
      input({
        hours: [
          hours("front_desk", { noShowCount: 1, shifts: [shift("no_show", "front_desk")], loggedMinutes: 0, percent: 0 }),
          hours("study_session"),
        ],
      })
    );
    expect(drafts).toHaveLength(1);
    const draft = drafts[0]!;
    expect(draft.id).toBe("front_desk");
    expect(draft.cc).toBe(FRONT_DESK_FOLLOW_UP_CC);
    expect(draft.label).toBe("Email Ada about this");
    expect(draft.body).toContain("Checking in about Week 1");
    expect(draft.body).toContain("Tuesday, Sep 8, 3:00pm–5:00pm");
    expect(draft.body).toContain("no hours were logged");
  });

  it("uses the study CC for study-session no-shows", () => {
    const drafts = buildFollowUpDrafts(
      input({
        hours: [
          hours("front_desk"),
          hours("study_session", { noShowCount: 1, shifts: [shift("no_show", "study_session")] }),
        ],
      })
    );
    expect(drafts.map((d) => d.id)).toEqual(["study_session"]);
    expect(drafts[0]!.cc).toBe(STUDY_FOLLOW_UP_CC);
  });

  it("drafts an ended week below 90% even without a no-show", () => {
    const drafts = buildFollowUpDrafts(
      input({
        phase: "past",
        hours: [hours("front_desk", { percent: 50, loggedMinutes: 60, targetMinutes: 120 }), hours("study_session")],
      })
    );
    expect(drafts.map((d) => d.id)).toEqual(["front_desk"]);
    expect(drafts[0]!.body).toContain("Logged 1.0 of 2.0 required front desk hours");
  });

  it("does not draft a still-open (current) week that is merely below target", () => {
    const drafts = buildFollowUpDrafts(
      input({
        phase: "current",
        hours: [hours("front_desk", { percent: 40, pending: true }), hours("study_session")],
      })
    );
    expect(drafts).toEqual([]);
  });

  it("does not treat an unconfirmed shift as a no-show", () => {
    const drafts = buildFollowUpDrafts(
      input({
        hours: [
          hours("front_desk", { noShowCount: 0, shifts: [shift("unconfirmed", "front_desk")] }),
          hours("study_session"),
        ],
      })
    );
    expect(drafts).toEqual([]);
  });

  it("drafts a missing overdue WAHF with no CC", () => {
    const drafts = buildFollowUpDrafts(
      input({
        wahf: { status: "missing", dueAt: "2026-09-10T23:59:59.000Z", submittedAt: null, onTime: null, submissionId: null },
      })
    );
    expect(drafts.map((d) => d.id)).toEqual(["wahf"]);
    expect(drafts[0]!.cc).toBeNull();
    expect(drafts[0]!.subject).toContain("WAHF");
    expect(drafts[0]!.body).toContain("has not been submitted");
  });

  it.each(["pending", "submitted", "unknown"] as const)("never drafts for a %s WAHF", (status) => {
    const drafts = buildFollowUpDrafts(
      input({ wahf: { status, dueAt: "2026-09-10T23:59:59.000Z", submittedAt: null, onTime: null, submissionId: null } })
    );
    expect(drafts).toEqual([]);
  });

  it("orders drafts front desk, study, then WAHF", () => {
    const drafts = buildFollowUpDrafts(
      input({
        hours: [
          hours("front_desk", { noShowCount: 1, shifts: [shift("no_show", "front_desk")] }),
          hours("study_session", { noShowCount: 1, shifts: [shift("no_show", "study_session")] }),
        ],
        wahf: { status: "missing", dueAt: "2026-09-10T23:59:59.000Z", submittedAt: null, onTime: null, submissionId: null },
      })
    );
    expect(drafts.map((d) => d.id)).toEqual(["front_desk", "study_session", "wahf"]);
  });

  it("builds an encoded mailto href when the scholar has an email", () => {
    const drafts = buildFollowUpDrafts(
      input({ hours: [hours("front_desk", { noShowCount: 1, shifts: [shift("no_show", "front_desk")] }), hours("study_session")] })
    );
    const href = drafts[0]!.href!;
    expect(href.startsWith("mailto:ada@umd.edu?")).toBe(true);
    expect(href).toContain(`cc=${encodeURIComponent(FRONT_DESK_FOLLOW_UP_CC)}`);
    expect(href).toContain(`subject=${encodeURIComponent(drafts[0]!.subject)}`);
    expect(href).toContain(`body=${encodeURIComponent(drafts[0]!.body)}`);
    expect(href).not.toContain("\n");
  });

  it("disables launch (href null) when the scholar has no email, keeping the draft content", () => {
    const drafts = buildFollowUpDrafts(
      input({
        menteeEmail: null,
        hours: [hours("front_desk", { noShowCount: 1, shifts: [shift("no_show", "front_desk")] }), hours("study_session")],
      })
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.href).toBeNull();
    expect(drafts[0]!.body).toContain("Week 1");
  });
});
