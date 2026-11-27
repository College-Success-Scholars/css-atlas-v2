import { describe, expect, it } from "vitest";
import type { FormStatusResult } from "@/components/personal/utils";
import { formCellFor } from "./team-leader-forms";

function status(overrides: Partial<FormStatusResult>): FormStatusResult {
  return {
    formType: "WAHF",
    status: "done",
    submittedAt: null,
    isLate: false,
    daysOverdue: 0,
    hoursLeft: 0,
    daysLeft: 0,
    submission: null,
    completedCount: 1,
    requiredCount: 1,
    ...overrides,
  };
}

describe("formCellFor", () => {
  it("reads WAHF and WPL as on time, late, missing or not yet due", () => {
    expect(formCellFor(status({})).tone).toBe("on-time");
    expect(formCellFor(status({ isLate: true })).tone).toBe("late");
    expect(formCellFor(status({ status: "missed", completedCount: 0 })).tone).toBe("missing");
    expect(formCellFor(status({ formType: "WPL", status: "overdue", completedCount: 0 })).tone).toBe("missing");
    expect(formCellFor(status({ status: "pending", completedCount: 0 }))).toEqual({
      tone: "not-due",
      label: "Not yet due",
      coverage: null,
      coverageLabel: null,
    });
  });

  it("shows MCF as mentees covered", () => {
    const mcf = (overrides: Partial<FormStatusResult>) => formCellFor(status({ formType: "MCF", requiredCount: 2, ...overrides }));
    expect(mcf({ completedCount: 2 })).toEqual({ tone: "on-time", label: "On time", coverage: "2/2", coverageLabel: "2 of 2 mentees" });
    expect(mcf({ completedCount: 2, isLate: true }).tone).toBe("late");
    expect(mcf({ status: "incomplete", completedCount: 1 })).toEqual({ tone: "partial", label: "Partial", coverage: "1/2", coverageLabel: "1 of 2 mentees" });
    expect(mcf({ status: "missed", completedCount: 0 })).toEqual({ tone: "missing", label: "Missing", coverage: "0/2", coverageLabel: "0 of 2 mentees" });
    expect(mcf({ status: "pending", completedCount: 1 }).tone).toBe("not-due");
  });

  it("owes no MCF when the team leader has no mentees", () => {
    expect(formCellFor(status({ formType: "MCF", requiredCount: 0, completedCount: 0 }))).toEqual({
      tone: "none",
      label: "No mentees",
      coverage: "—",
      coverageLabel: null,
    });
  });
});
