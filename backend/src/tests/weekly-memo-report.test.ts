import { describe, expect, it } from "vitest";
import { createWeeklyMemoReport, weeklyMemoPdfFilename, weeklyMemoPrintedAt, type MemoPageData } from "../services/weekly-memo-report.service.js";
import { freshmanCohortYear, sophomoreCohortYear } from "../services/time.service.js";
import { isMissingBundledChrome, renderWeeklyMemoHtml, weeklyMemoBrowserLaunchOptions, weeklyMemoPdfOptions } from "../services/weekly-memo-pdf.service.js";

function source(weekNumber: number): MemoPageData {
  return {
    selectedWeekNumber: weekNumber,
    weekLabel: `Week ${weekNumber}`,
    scholars: [
      { scholarId: "zero", scholarName: "Zero Scholar", cohort: 2024, teamLeader: "Unassigned", fdTotal: 0, ssTotal: 0, fdRequired: 60, ssRequired: 120, fdExcuseMin: 0, ssExcuseMin: 0, fdPct: 0, ssPct: 0, wahfStatus: "missing", wahfSubmittedAt: null, fdCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] }, ssCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] } },
      { scholarId: "complete", scholarName: "Complete Scholar", cohort: 2025, teamLeader: "TL One", fdTotal: 60, ssTotal: 120, fdRequired: 60, ssRequired: 120, fdExcuseMin: 0, ssExcuseMin: 0, fdPct: 100, ssPct: 100, wahfStatus: "on-time", wahfSubmittedAt: "2026-04-03T12:00:00.000Z", fdCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] }, ssCompliance: { insideMinutes: 0, outsideMinutes: 0, noShowCount: 0, dates: [] } },
    ],
    completedStudy: [], completedFd: [], trafficWeeklyData: [], trafficEntryCountForSelectedWeek: 8, trafficSessions: [],
    tutorReports: [{ id: 1, scholarId: "n/a", scholarName: "EMPTY SESSION", tutorName: "Tutor", courses: ["Math"], startTime: "10:00", endTime: "11:00", dayOfWeek: "Mon" }],
    teamLeaderFormStats: [{ scholarId: "tl", name: "Leader", programRole: "Team Leader", mcfCompleted: 0, mcfRequired: 1, mcfLate: false, mcfPct: 0, mcfLatestAt: "", wahfCompleted: 1, wahfRequired: 1, wahfLate: false, wahfPct: 100, wahfLatestAt: "", wplCompleted: 1, wplRequired: 1, wplLate: false, wplPct: 100, wplLatestAt: "" }],
    gradeBreakdown: { high: [{ scholarName: "Complete Scholar", course: "Math", assessment: "Quiz", grade: "95", percent: 95 }], mid: [{ scholarName: "Complete Scholar", course: "English", assessment: "Essay", grade: "85", percent: 85 }], low: [{ scholarName: "Zero Scholar", course: "History", assessment: "Essay", grade: "77", percent: 77 }] },
    wahfDonut: { total: 2, completeCount: 1, lateCount: 0, percentComplete: 50 }, currentCampusWeek: weekNumber,
    teamLeaders: [], pieData: { cohort2024: { total: 0, fdCompleteCount: 0, ssCompleteCount: 0, fdPercent: 0, ssPercent: 0 }, cohort2025: { total: 0, fdCompleteCount: 0, ssCompleteCount: 0, fdPercent: 0, ssPercent: 0 } },
    formCompletionOverall: { wahfCompleted: 1, wahfRequired: 1, wahfLateCount: 0, mcfCompleted: 0, mcfRequired: 1, mcfLateCount: 0, wplCompleted: 1, wplRequired: 1, wplLateCount: 0 },
  } as MemoPageData;
}

describe("weekly memo print report", () => {
  it("retains cohort data and derives the 60% attention and recognition queues", () => {
    const report = createWeeklyMemoReport(source(7));
    expect(report.weekNumber).toBe(7);
    expect(report.studyRoster.map((row) => row.scholarName)).toEqual(["Complete Scholar", "Zero Scholar"]);
    expect(report.studyRoster[1]).toMatchObject({ cohort: 2024, completionPercent: 0 });
    expect(report.attention.studyCompletion).toHaveLength(1);
    expect(report.attention.lowGrades[0]?.percent).toBe(77);
    expect(report.attention.tutoringNoShows).toHaveLength(1);
    expect(report.overview.traffic).toEqual({
      thisWeek: 8,
      thisSemester: 0,
      weekly: Array.from({ length: 7 }, (_, index) => ({ week: index + 1, visits: 0 })),
      sessions: [],
    });
    expect(report.frontDeskRoster.map((row) => row.completionPercent)).toEqual([100, 0]);
    expect(report.frontDeskRoster.map((row) => row.scholarName)).toEqual(["Complete Scholar", "Zero Scholar"]);
    expect(report.overview.submissions.wahf).toEqual({ onTime: 1, late: 0, missing: 1 });
    expect(report.overview.submissions.tlWahf).toEqual({ onTime: 1, late: 0, missing: 0 });
    expect(report.attention.wahf).toEqual([{ scholarName: "Zero Scholar", cohort: 2024, status: "missing" }]);
    expect(report.attention.tlSubmissions).toEqual([{ leaderName: "Leader", issues: ["MCF missing"] }]);
    expect(report.recognition.high.map((grade) => grade.percent)).toEqual([95]);
    expect(report.recognition.mid.map((grade) => grade.percent)).toEqual([85]);
    expect(report.printedAtSlug).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}$/);
    expect(report.printedAtLabel).toContain("ET");
    const html = renderWeeklyMemoHtml(report);
    expect(html).toContain("1 on-time, 0 late, 1 missing");
    expect(html).toContain(`Printed ${report.printedAtLabel}`);
    expect(html).toContain('<div class="overview-row"><span>Sophomores</span>');
    expect(html).toContain('<div class="overview-row"><span>Freshmen</span>');
    expect(html.indexOf('<div class="overview-row"><span>Sophomores</span>')).toBeLessThan(
      html.indexOf('<div class="overview-row"><span>Freshmen</span>'),
    );
    expect(html).not.toContain('<div class="overview-row"><span>Cohort ');
  });

  it("counts Program Snapshot hours complete at 80% or more, including excused minutes", () => {
    const freshman = freshmanCohortYear();
    const sophomore = sophomoreCohortYear();
    const data = source(7);
    data.pieData = {
      cohort2024: { total: 1, fdCompleteCount: 0, ssCompleteCount: 0, fdPercent: 0, ssPercent: 0 },
      cohort2025: { total: 2, fdCompleteCount: 0, ssCompleteCount: 0, fdPercent: 0, ssPercent: 0 },
    };
    data.scholars = [
      {
        ...data.scholars[0]!,
        scholarId: "at80",
        scholarName: "At Eighty",
        cohort: freshman,
        fdTotal: 48,
        fdRequired: 60,
        ssTotal: 96,
        ssRequired: 120,
        fdExcuseMin: 0,
        ssExcuseMin: 0,
        fdPct: 80,
        ssPct: 80,
      },
      {
        ...data.scholars[0]!,
        scholarId: "below80",
        scholarName: "Below Eighty",
        cohort: freshman,
        fdTotal: 47,
        fdRequired: 60,
        ssTotal: 95,
        ssRequired: 120,
        fdExcuseMin: 0,
        ssExcuseMin: 0,
        fdPct: 78,
        ssPct: 79,
      },
      {
        ...data.scholars[1]!,
        scholarId: "excuse80",
        scholarName: "Excuse Eighty",
        cohort: sophomore,
        fdTotal: 0,
        fdExcuseMin: 48,
        fdRequired: 60,
        ssTotal: 0,
        ssExcuseMin: 96,
        ssRequired: 120,
        fdPct: 0,
        ssPct: 0,
      },
    ];
    const report = createWeeklyMemoReport(data);
    expect(report.snapshotCompletePercent).toBe(80);
    expect(report.overview.frontDesk).toEqual([
      { cohort: sophomore, completed: 1, total: 1 },
      { cohort: freshman, completed: 1, total: 2 },
    ]);
    expect(report.overview.studySession).toEqual([
      { cohort: sophomore, completed: 1, total: 1 },
      { cohort: freshman, completed: 1, total: 2 },
    ]);
    const html = renderWeeklyMemoHtml(report);
    expect(html).toContain("80% or more");
    expect(html).not.toContain("90% or more");
    expect(html).toContain("1&nbsp;/&nbsp;1");
    expect(html).toContain("1&nbsp;/&nbsp;2");
  });

  it("credits excused minutes in roster completion the same way the weekly memo page does", () => {
    const data = source(7);
    data.scholars = [
      {
        ...data.scholars[0]!,
        scholarName: "Excuse Scholar",
        fdTotal: 30,
        fdExcuseMin: 30,
        fdRequired: 60,
        fdPct: 0,
        ssTotal: 0,
        ssExcuseMin: 75,
        ssRequired: 120,
        ssPct: 0,
      },
      {
        ...data.scholars[0]!,
        scholarId: "low",
        scholarName: "Low Scholar",
        fdTotal: 10,
        fdExcuseMin: 5,
        fdRequired: 60,
        fdPct: 17,
        ssTotal: 20,
        ssExcuseMin: 10,
        ssRequired: 120,
        ssPct: 17,
      },
      {
        ...data.scholars[1]!,
        scholarName: "Over Scholar",
        fdTotal: 60,
        fdExcuseMin: 30,
        fdRequired: 60,
        fdPct: 150,
        ssTotal: 70,
        ssExcuseMin: 5,
        ssRequired: 120,
        ssPct: 62.5,
      },
    ];
    const report = createWeeklyMemoReport(data);
    expect(report.frontDeskRoster).toEqual([
      expect.objectContaining({ scholarName: "Over Scholar", completedMinutes: 90, requiredMinutes: 60, completionPercent: 100 }),
      expect.objectContaining({ scholarName: "Excuse Scholar", completedMinutes: 60, requiredMinutes: 60, completionPercent: 100 }),
      expect.objectContaining({ scholarName: "Low Scholar", completedMinutes: 15, requiredMinutes: 60, completionPercent: 25 }),
    ]);
    expect(report.studyRoster).toEqual([
      expect.objectContaining({ scholarName: "Over Scholar", completedMinutes: 75, requiredMinutes: 120, completionPercent: 63 }),
      expect.objectContaining({ scholarName: "Excuse Scholar", completedMinutes: 75, requiredMinutes: 120, completionPercent: 63 }),
      expect.objectContaining({ scholarName: "Low Scholar", completedMinutes: 30, requiredMinutes: 120, completionPercent: 25 }),
    ]);
    expect(report.attention.studyCompletion).toEqual([
      expect.objectContaining({ scholarName: "Low Scholar", completedMinutes: 30, completionPercent: 25 }),
    ]);
    expect(report.attention.frontDeskCompletion).toEqual([
      expect.objectContaining({ scholarName: "Low Scholar", completedMinutes: 15, completionPercent: 25 }),
    ]);
    const html = renderWeeklyMemoHtml(report);
    expect(html).toContain("63%");
    expect(html).toContain("25%");
    expect(html).not.toContain("62.5%");
    expect(html).not.toContain("125.0%");
    expect(html).not.toContain("150.0%");
  });

  it("sorts SS and FD appendix rosters by minutes descending and groups by cohort", () => {
    const freshman = freshmanCohortYear();
    const sophomore = sophomoreCohortYear();
    const data = source(7);
    data.scholars = [
      { ...data.scholars[0]!, scholarId: "ada", scholarName: "Ada Scholar", cohort: freshman, fdRequired: 160, ssRequired: 160, fdPct: 50, ssPct: 50, fdTotal: 80, ssTotal: 80 },
      { ...data.scholars[0]!, scholarId: "zed", scholarName: "Zed Scholar", cohort: freshman, fdRequired: 60, ssRequired: 60, fdPct: 90, ssPct: 90, fdTotal: 54, ssTotal: 54 },
      { ...data.scholars[1]!, scholarId: "bea", scholarName: "Bea Scholar", cohort: sophomore, fdPct: 50, ssPct: 50, fdTotal: 30, ssTotal: 60 },
    ];
    const report = createWeeklyMemoReport(data);
    expect(report.studyRoster.map((row) => [row.scholarName, row.cohort, row.completedMinutes, row.completionPercent])).toEqual([
      ["Ada Scholar", freshman, 80, 50],
      ["Zed Scholar", freshman, 54, 90],
      ["Bea Scholar", sophomore, 60, 50],
    ]);
    expect(report.frontDeskRoster.map((row) => [row.scholarName, row.completedMinutes])).toEqual([
      ["Ada Scholar", 80],
      ["Zed Scholar", 54],
      ["Bea Scholar", 30],
    ]);
    const html = renderWeeklyMemoHtml(report);
    expect(html).toContain("<h4>Freshmen</h4>");
    expect(html).toContain("<h4>Sophomores</h4>");
    expect(html.indexOf("<h4>Freshmen</h4>")).toBeLessThan(html.indexOf("<h4>Sophomores</h4>"));
    expect(html).toContain("Sorted by minutes, highest first, and grouped by cohort.");
    expect(html).not.toContain("Sorted by completion, highest first");
    expect(html).not.toContain("Sorted by first name");
  });

  it("stamps Eastern printed-at for the filename and printout", () => {
    const printed = weeklyMemoPrintedAt(new Date("2026-09-04T23:39:00.000Z"));
    expect(printed.label).toBe("Sep 4, 2026, 7:39 PM ET");
    expect(printed.slug).toBe("2026-09-04-1939");
    expect(weeklyMemoPdfFilename(9, printed.slug)).toBe("weekly-memo-week-9-2026-09-04-1939.pdf");
  });

  it("keeps TL form census tiles separate and folds TL WAHF into Team Leader Submissions", () => {
    const data = source(7);
    data.teamLeaderFormStats = [
      { ...data.teamLeaderFormStats[0]!, name: "On Time TL", wahfCompleted: 1, wahfRequired: 1, wahfLate: false, mcfCompleted: 1, mcfRequired: 1, mcfLate: false },
      { ...data.teamLeaderFormStats[0]!, name: "Missing WAHF TL", wahfCompleted: 0, wahfRequired: 1, wahfLate: false, mcfCompleted: 1, mcfRequired: 1, mcfLate: false },
      { ...data.teamLeaderFormStats[0]!, name: "Late WAHF TL", wahfCompleted: 1, wahfRequired: 1, wahfLate: true, mcfCompleted: 1, mcfRequired: 1, mcfLate: false },
    ];
    data.formCompletionOverall = { ...data.formCompletionOverall, wahfCompleted: 2, wahfRequired: 3, wahfLateCount: 1 };
    const report = createWeeklyMemoReport(data);
    expect(report.overview.submissions.tlWahf).toEqual({ onTime: 1, late: 1, missing: 1 });
    expect(report.attention.tlSubmissions).toEqual([
      { leaderName: "Late WAHF TL", issues: ["WAHF late"] },
      { leaderName: "Missing WAHF TL", issues: ["WAHF missing"] },
    ]);
    const html = renderWeeklyMemoHtml(report);
    expect(html).toContain("TL WAHF");
    expect(html).not.toContain("Missing or Late TL WAHF");
    expect(html).toContain("WAHF missing");
    expect(html).toContain("WAHF late");
    expect(html).toContain("1 on-time, 1 late, 1 missing");
  });

  it("renders the printable reference structure and pagination-safe table rules", () => {
    const data = source(3);
    data.scholars = [];
    data.tutorReports = [];
    data.gradeBreakdown = { high: [], mid: [], low: [] };
    data.teamLeaderFormStats = [];
    const report = createWeeklyMemoReport(data);
    const html = renderWeeklyMemoHtml(report);
    expect(html).toContain("No study-session requirements apply this week.");
    expect(html).toContain("No scholars have a missing or late WAHF.");
    expect(html).toContain("No team leaders have missing or late submissions.");
    expect(html).toContain("Scholar WAHF");
    expect(html).toContain("TL WAHF");
    expect(html).toContain("TL WPL");
    expect(html).toContain("Missing or Late Scholar WAHF");
    expect(html).not.toContain("Missing or Late TL WAHF");
    expect(html).toContain("Team Leader Submissions");
    expect(html).not.toContain("WAHF Submissions");
    expect(html).toContain('data-print-chart="submission-stack"');
    expect(html).toContain('data-print-chart="cohort-bar"');
    expect(html).toContain('data-print-chart-id="wahf"');
    expect(html).toContain('data-print-chart-id="tl-wahf"');
    expect(html).toContain('data-print-chart="traffic-bar-line"');
    expect(html).toContain('data-print-chart="traffic-heatmap"');
    expect(html).toContain("02 &mdash; Room Traffic");
    expect(html).toContain("03 &mdash; Needs Attention");
    expect(html).not.toContain("02 &mdash; Needs Attention");
    expect(html).not.toContain("mock week trend");
    expect(html).toContain("Sorted by minutes, highest first, and grouped by cohort.");
    expect(html).toContain(`Printed ${report.printedAtLabel}`);
    expect(html).toContain("@page{size:letter;margin:.75in}");
    expect(html).toContain("thead{display:table-header-group}");
    expect(html).toContain("tr{break-inside:avoid");
    expect(html).toContain('class="group-kicker">Scholars');
    expect(html).toContain('class="group-kicker">Team Leaders');
    expect(html.indexOf("Scholars")).toBeLessThan(html.indexOf("Team Leaders"));
    expect(html.indexOf("Scholar WAHF")).toBeLessThan(html.indexOf("TL WAHF"));
    expect(html).toContain("grid-template-columns:repeat(4,1fr)");
    expect(html).toContain("grid-template-columns:repeat(3,1fr)");
    expect(html).toContain("aspect-ratio:640/140");
    expect(html).toContain("aspect-ratio:640/300");
    expect(html).toContain("column-count:2");
    expect(html).toContain("section+section{break-before:page}");
    expect(html.match(/class="appendix"/g)).toHaveLength(4);
    expect(html.indexOf("Program Snapshot")).toBeLessThan(html.indexOf("Room Traffic"));
    expect(html.indexOf("Room Traffic")).toBeLessThan(html.indexOf("Needs Attention"));
    const options = weeklyMemoPdfOptions(report);
    expect(options).toMatchObject({ format: "letter", landscape: false, displayHeaderFooter: true, waitForFonts: true });
    expect(options.footerTemplate).toContain("Week 3");
    expect(options.footerTemplate).toContain(`Printed ${report.printedAtLabel}`);
    expect(options.margin).toEqual({ top: "0.75in", right: "0.75in", bottom: "0.75in", left: "0.75in" });
  });

  it("uses PUPPETEER_EXECUTABLE_PATH when set and otherwise relies on Puppeteer's bundled Chrome", () => {
    expect(weeklyMemoBrowserLaunchOptions({ PUPPETEER_EXECUTABLE_PATH: "/usr/bin/chromium-browser" })).toMatchObject({
      headless: true,
      executablePath: "/usr/bin/chromium-browser",
    });
    expect(weeklyMemoBrowserLaunchOptions({})).not.toHaveProperty("executablePath");
    expect(weeklyMemoBrowserLaunchOptions({}).args).toEqual(expect.arrayContaining([
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ]));
  });

  it("recognizes a missing bundled Chrome install", () => {
    expect(isMissingBundledChrome(new Error("Could not find Chrome (ver. 152.0.7977.42)."))).toBe(true);
    expect(isMissingBundledChrome(new Error("Navigation timeout"))).toBe(false);
  });
});
