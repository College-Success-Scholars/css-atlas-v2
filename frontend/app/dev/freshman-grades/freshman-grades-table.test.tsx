// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FreshmanGradesTable,
  freshmanGradesCsv,
  freshmanGradesCsvFilename,
  hoursDetail,
  type FreshmanGradesReport,
  type FreshmanGradeRow,
} from "./freshman-grades-table";

const report: FreshmanGradesReport = {
  throughWeek: 2,
  scoredWeeks: { fromWeek: 2, throughWeek: 2 },
  weights: { fd: 10, ss: 10, wahf: 10, outOfApp: 70 },
  scholars: [
    {
      scholarId: "f-1",
      scholarName: "Ada Lovelace",
      mentor: "Jordan Kim",
      cohort: 2026,
      fdPct: 50,
      ssPct: 100,
      wahfPct: 50,
      weeks: [
        {
          weekNum: 1,
          fd: {
            loggedMinutes: 0,
            excuseMinutes: 0,
            effectiveMinutes: 0,
            requiredMinutes: 100,
            rawPct: 0,
            cappedPct: 0,
          },
          ss: {
            loggedMinutes: 100,
            excuseMinutes: 0,
            effectiveMinutes: 100,
            requiredMinutes: 100,
            rawPct: 100,
            cappedPct: 100,
          },
          wahfStatus: "missing",
          wahfPct: 0,
        },
        {
          weekNum: 2,
          fd: {
            loggedMinutes: 180,
            excuseMinutes: 20,
            effectiveMinutes: 200,
            requiredMinutes: 100,
            rawPct: 200,
            cappedPct: 100,
          },
          ss: {
            loggedMinutes: 100,
            excuseMinutes: 0,
            effectiveMinutes: 100,
            requiredMinutes: 100,
            rawPct: 100,
            cappedPct: 100,
          },
          wahfStatus: "late",
          wahfPct: 100,
        },
      ],
    },
  ],
};

describe("FreshmanGradesTable", () => {
  it("shows uid and mentor, then the weekly cap when a scholar is selected", () => {
    expect(hoursDetail(report.scholars[0]!.weeks[1]!.fd)).toBe(
      "180 logged · 20 excuse · 200 of 100 min",
    );

    render(<FreshmanGradesTable report={report} />);
    expect(screen.getByRole("columnheader", { name: "UID" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Mentor" })).toBeTruthy();
    expect(screen.getByText("f-1")).toBeTruthy();
    expect(screen.getByText("Jordan Kim")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("UID f-1 · Mentor Jordan Kim")).toBeTruthy();
    expect(screen.getByText("180 logged · 20 excuse · 200 of 100 min")).toBeTruthy();
    expect(screen.getByText("Capped from 200%")).toBeTruthy();
    expect(screen.getByText("Missing")).toBeTruthy();
    expect(screen.getByText("Submitted late")).toBeTruthy();
    expect(screen.getByText("Front desk averages 0%, 100%.")).toBeTruthy();
  });

  it("prints overall like the table, and blanks repeated in-depth cells", () => {
    const second: FreshmanGradeRow = {
      ...report.scholars[0]!,
      scholarId: "f-2",
      scholarName: "Grace Hopper",
      mentor: "Jordan Kim",
      fdPct: 80,
    };
    const withTwo = { ...report, scholars: [report.scholars[0]!, second] };

    const overall = freshmanGradesCsv(withTwo, "overall");
    expect(overall.startsWith("\uFEFF2\nScholar,UID,Mentor,FD %,SS %,WAHF %\n")).toBe(true);
    expect(overall).toContain("Ada Lovelace,f-1,Jordan Kim,50,100,50\n");
    const ranged = freshmanGradesCsv(
      { ...withTwo, throughWeek: 6, scoredWeeks: { fromWeek: 2, throughWeek: 5 } },
      "in-depth",
    );
    expect(ranged.startsWith("\uFEFF2-5\n")).toBe(true);
    expect(overall).toContain("Grace Hopper,f-2,Jordan Kim,80,100,50\n");
    expect(overall.split("\n")[1]).toBe("Scholar,UID,Mentor,FD %,SS %,WAHF %");

    const indepth = freshmanGradesCsv(withTwo, "in-depth");
    expect(indepth).toContain(
      "Scholar,UID,Mentor,Week,FD %,FD recorded min,FD excused min,FD total min,FD expected min,SS %,SS recorded min,SS excused min,SS total min,SS expected min,WAHF %\n",
    );
    expect(indepth).toContain("Ada Lovelace,f-1,Jordan Kim,1,0%,0,0,0,100,100%,100,0,100,100,0%\n");
    expect(indepth).toContain(",,,2,100%,180,20,200,100,100%,100,0,100,100,100%");
    expect(indepth).toContain("Grace Hopper,f-2,Jordan Kim,1,0%,0,0,0,100,100%,100,0,100,100,0%\n");
    expect(indepth).not.toContain("raw");

    render(<FreshmanGradesTable report={report} />);
    expect(screen.getByLabelText("Printout")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("overall");
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeTruthy();
  });

  it("gives sophomores the same table and a sophomore CSV name", () => {
    expect(freshmanGradesCsvFilename(report, "overall", "sophomore")).toBe(
      "sophomore-grades-overall-weeks-2-2.csv",
    );
    expect(freshmanGradesCsvFilename(report, "in-depth", "freshman")).toBe(
      "freshman-grades-in-depth-weeks-2-2.csv",
    );

    render(<FreshmanGradesTable report={report} audience="sophomore" />);
    expect(screen.getByText("Sophomores")).toBeTruthy();
    expect(screen.getByText(/1 sophomore\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ada Lovelace" })).toBeTruthy();

    render(<FreshmanGradesTable report={{ ...report, scholars: [] }} audience="sophomore" />);
    expect(screen.getByText("No enrolled sophomores with required hours.")).toBeTruthy();
  });
});
