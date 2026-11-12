import { describe, expect, it } from "vitest";
import {
  durationHours,
  filterScholarsForKind,
  parseHhMm,
  requiredMinutesForKind,
  sessionKindSurfaceClass,
  sortScholarsByEarliestShift,
} from "./schedule-helpers";
import type { BoardScholar, DayShiftBlock } from "./types";
import { freshmanCohortYear, sophomoreCohortYear } from "@/lib/format/time";

function stubScholar(
  overrides: Partial<BoardScholar> & Pick<BoardScholar, "uid" | "name">,
): BoardScholar {
  return {
    cohort: freshmanCohortYear(),
    classYearLabel: "Freshman",
    fd_required: 180,
    ss_required: 300,
    shifts: [],
    ...overrides,
  };
}

describe("schedule-helpers", () => {
  it("parses HH:MM and duration", () => {
    expect(parseHhMm("09:30")).toBe(9 * 60 + 30);
    expect(durationHours("09:00", "12:00")).toBe(3);
    expect(durationHours("14:00", "15:30")).toBe(1.5);
  });

  it("requiredMinutesForKind reads the matching roster field", () => {
    const s = stubScholar({ uid: "a", name: "A", fd_required: 120, ss_required: 180 });
    expect(requiredMinutesForKind(s, "front_desk")).toBe(120);
    expect(requiredMinutesForKind(s, "study_session")).toBe(180);
  });

  it("filterScholarsForKind keeps hour-eligible scholars with required > 0", () => {
    const frosh = freshmanCohortYear();
    const soph = sophomoreCohortYear();
    const rows = [
      stubScholar({ uid: "f", name: "Frosh", cohort: frosh, fd_required: 180, ss_required: 0 }),
      stubScholar({
        uid: "s",
        name: "Soph",
        cohort: soph,
        classYearLabel: "Sophomore",
        fd_required: 0,
        ss_required: 180,
      }),
      stubScholar({
        uid: "j",
        name: "Junior",
        cohort: frosh - 2,
        classYearLabel: null,
        fd_required: 180,
        ss_required: 300,
      }),
      stubScholar({ uid: "z", name: "Zero", cohort: frosh, fd_required: 0, ss_required: 0 }),
    ];

    const fd = filterScholarsForKind(rows, "front_desk").map((s) => s.uid);
    const ss = filterScholarsForKind(rows, "study_session").map((s) => s.uid);

    expect(fd).toEqual(["f"]);
    expect(ss).toEqual(["s"]);
  });

  it("sortScholarsByEarliestShift orders by first start, then name; empty last", () => {
    const late = stubScholar({ uid: "late", name: "Zoe Late" });
    const early = stubScholar({ uid: "early", name: "Ann Early" });
    const alsoEarly = stubScholar({ uid: "also", name: "Ben Early" });
    const none = stubScholar({ uid: "none", name: "No Shift" });

    const blocks: DayShiftBlock[] = [
      {
        id: "1",
        kind: "front_desk",
        dayOfWeek: 1,
        startTime: "14:00",
        endTime: "16:00",
        scholarUid: "late",
        scholarName: late.name,
        date: "2026-11-09",
        durationHours: 2,
      },
      {
        id: "2",
        kind: "front_desk",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "11:00",
        scholarUid: "early",
        scholarName: early.name,
        date: "2026-11-09",
        durationHours: 2,
      },
      {
        id: "3",
        kind: "front_desk",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
        scholarUid: "also",
        scholarName: alsoEarly.name,
        date: "2026-11-09",
        durationHours: 1,
      },
    ];

    const ordered = sortScholarsByEarliestShift(
      [late, none, alsoEarly, early],
      blocks,
    ).map((s) => s.uid);

    expect(ordered).toEqual(["early", "also", "late", "none"]);
  });

  it("sessionKindSurfaceClass uses FD orange and SS blue tokens", () => {
    expect(sessionKindSurfaceClass("front_desk")).toContain("front-desk");
    expect(sessionKindSurfaceClass("study_session")).toContain("study");
  });

  it("sessionKindSurfaceClass marks sub-hour shifts as destructive on both kinds", () => {
    expect(sessionKindSurfaceClass("front_desk", 0.75)).toContain("destructive");
    expect(sessionKindSurfaceClass("study_session", 0.5)).toContain("destructive");
    expect(sessionKindSurfaceClass("front_desk", 1)).toContain("front-desk");
    expect(sessionKindSurfaceClass("study_session", 1)).toContain("study");
  });
});
