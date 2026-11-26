import { describe, expect, it } from "vitest";
import { toScholarHomeActivityEntries } from "./scholar-home-activity";
import type { RecentFormSubmission } from "@css-atlas/shared/contracts/form-logs";

describe("toScholarHomeActivityEntries", () => {
  it("keeps WAHF/WHAF as type + timestamp only", () => {
    const entries: RecentFormSubmission[] = [
      {
        id: "WHAF-1",
        formType: "WAHF",
        submittedAt: "2026-09-01T12:00:00.000Z",
        assignment_grades: { CMSC: { Exam: "90%" } },
        meeting_notes: "should not leak",
      },
    ];
    expect(toScholarHomeActivityEntries(entries)).toEqual([
      { id: "WHAF-1", formType: "WAHF", submittedAt: "2026-09-01T12:00:00.000Z" },
    ]);
  });

  it("drops WPL and MCF even when they belong to the same uid", () => {
    const entries: RecentFormSubmission[] = [
      { id: "WPL-1", formType: "WPL", submittedAt: "2026-09-01T12:00:00.000Z", hours_worked: 4 },
      { id: "MCF-1", formType: "MCF", submittedAt: "2026-09-01T13:00:00.000Z", mentee_name: "Ada" },
      { id: "WHAF-1", formType: "WHAF" as RecentFormSubmission["formType"], submittedAt: "2026-09-01T14:00:00.000Z" },
    ];
    expect(toScholarHomeActivityEntries(entries)).toEqual([
      { id: "WHAF-1", formType: "WAHF", submittedAt: "2026-09-01T14:00:00.000Z" },
    ]);
  });
});
