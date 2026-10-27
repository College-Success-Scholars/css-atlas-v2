/**
 * @file hours-benchmark-pdf.service.ts
 * @module backend/services
 *
 * HTML → PDF for the Hours Benchmark Report via Puppeteer.
 * Print layout mirrors idea.pdf (landscape letter, KPI row, heatmap,
 * team-leader bars, detail list).
 */
import {
  HOURS_BENCHMARK_AT_OR_BELOW_PERCENT,
  HOURS_BENCHMARK_MET_PERCENT,
  type HoursBenchmarkCell,
  type HoursBenchmarkHeatmapScope,
  type HoursBenchmarkReport,
  type HoursBenchmarkScholarRow,
} from "./hours-benchmark.service.js";
import {
  isMissingBundledChrome,
  launchWeeklyMemoBrowser,
  weeklyMemoBrowserLaunchOptions,
} from "./weekly-memo-pdf.service.js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Brick red used for KPI numbers, ≤50% cells, TL bars, and low completion. */
const RED = "#ae1800";
const RED_CELL = "#c43a24";
const AMBER_CELL = "#efd3a8";
const AMBER_TEXT = "#5c3d10";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fontFace(): string {
  const font = readFileSync(require.resolve("@fontsource/archivo/files/archivo-latin-400-normal.woff2")).toString("base64");
  const semiboldFont = readFileSync(require.resolve("@fontsource/archivo/files/archivo-latin-600-normal.woff2")).toString("base64");
  const boldFont = readFileSync(require.resolve("@fontsource/archivo/files/archivo-latin-800-normal.woff2")).toString("base64");
  return `@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400}@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${semiboldFont}) format('woff2');font-weight:600}@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${boldFont}) format('woff2');font-weight:800}`;
}

function cellClass(pct: number | null): string {
  if (pct == null || pct >= HOURS_BENCHMARK_MET_PERCENT) return "";
  if (pct <= HOURS_BENCHMARK_AT_OR_BELOW_PERCENT) return "cell-low";
  return "cell-mid";
}

function formatCell(cell: HoursBenchmarkCell): string {
  if (cell.completionPercent == null || cell.completionPercent >= HOURS_BENCHMARK_MET_PERCENT) {
    return "";
  }
  const star = cell.excuseApplied ? "*" : "";
  return `${cell.completionPercent}${star}`;
}

function weekHeaders(weekNumbers: number[]): string {
  return weekNumbers.map((week) => `<th class="week">W${week}</th>`).join("");
}

function scholarCells(cells: HoursBenchmarkCell[]): string {
  return cells
    .map((cell) => {
      const cls = cellClass(cell.completionPercent);
      const label = formatCell(cell);
      if (!cls) return `<td class="heat"></td>`;
      return `<td class="heat"><span class="sq ${cls}">${escapeHtml(label)}</span></td>`;
    })
    .join("");
}

function heatmapRows(scholars: HoursBenchmarkScholarRow[], scope: HoursBenchmarkHeatmapScope): string {
  if (scholars.length === 0) {
    const empty =
      scope === "all"
        ? "No hour-eligible scholars in the scored weeks."
        : `No scholars were at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower in the scored weeks.`;
    return `<tr><td colspan="99" class="empty-row">${empty}</td></tr>`;
  }
  return scholars
    .map((scholar) => {
      const so = scholar.isSophomore ? " (So.)" : "";
      return `<tr>
        <td class="scholar"><div class="name">${escapeHtml(scholar.scholarName)}${escapeHtml(so)}</div><div class="tl">${escapeHtml(scholar.teamLeader)}</div></td>
        ${scholarCells(scholar.frontDeskByWeek)}
        ${scholarCells(scholar.studySessionByWeek)}
        <td class="count">${scholar.atOrBelow50Count}</td>
      </tr>`;
    })
    .join("");
}

/** Opening summary sentence matching the reference paper. */
export function hoursBenchmarkLeadBlurb(report: HoursBenchmarkReport): string {
  const n = report.summary.studentsAtOrBelow50AtLeastOnce;
  const bench = `The benchmark is ${HOURS_BENCHMARK_MET_PERCENT}% of required minutes.`;
  if (n === 0) {
    return `No students fell to ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower in at least one week. ${bench}`;
  }
  const top = report.heatmapScholars.slice(0, 3);
  const studentWord = n === 1 ? "student" : "students";
  if (top.length === 0) {
    return `${n} ${studentWord} fell to ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower in at least one week. ${bench}`;
  }
  if (top.length === 1) {
    return `${n} ${studentWord} fell to ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower in at least one week. ${top[0]!.scholarName} did so ${top[0]!.atOrBelow50Count} times. ${bench}`;
  }
  if (top.length === 2) {
    return `${n} ${studentWord} fell to ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower in at least one week. ${top[0]!.scholarName} did so ${top[0]!.atOrBelow50Count} times, followed by ${top[1]!.scholarName} (${top[1]!.atOrBelow50Count}). ${bench}`;
  }
  return `${n} ${studentWord} fell to ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower in at least one week. ${top[0]!.scholarName} did so ${top[0]!.atOrBelow50Count} times, followed by ${top[1]!.scholarName} (${top[1]!.atOrBelow50Count}) and ${top[2]!.scholarName} (${top[2]!.atOrBelow50Count}). ${bench}`;
}

function subtitleLine(report: HoursBenchmarkReport): string {
  const range =
    report.dateRangeLabel.length > 0
      ? `${report.weekRangeLabel} (${report.dateRangeLabel})`
      : report.weekRangeLabel;
  return `College Success Scholars · Front desk and study session hours · ${range} · Prepared ${report.preparedAtLabel}`;
}

function teamLeaderBars(report: HoursBenchmarkReport): string {
  if (report.byTeamLeader.length === 0) {
    return `<p class="intro">No team-leader rollup for the scored weeks.</p>`;
  }
  const max = Math.max(...report.byTeamLeader.map((row) => row.atOrBelow50Events), 1);
  const rows = report.byTeamLeader
    .map((row) => {
      const pct = Math.max(2, Math.round((row.atOrBelow50Events / max) * 100));
      return `<tr>
        <td class="tl-name">${escapeHtml(row.teamLeader)}</td>
        <td class="tl-bar-cell"><div class="tl-bar" style="width:${pct}%"></div></td>
        <td class="num">${row.atOrBelow50Events}</td>
        <td class="num">${row.studentCount}</td>
      </tr>`;
    })
    .join("");
  return `<table class="tl-table">
    <thead><tr>
      <th>Team leader</th>
      <th colspan="2" class="bar-head">Weeks at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower</th>
      <th class="num">Students</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function detailRows(report: HoursBenchmarkReport): string {
  if (report.lowEvents.length === 0) {
    return `<tr><td colspan="6" class="empty-row">No weeks at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower.</td></tr>`;
  }
  return report.lowEvents
    .map(
      (event) =>
        `<tr>
          <td>${escapeHtml(event.weekDateLabel)}</td>
          <td>${escapeHtml(event.areaLabel)}</td>
          <td>${escapeHtml(event.scholarName)}</td>
          <td>${escapeHtml(event.classYear)}</td>
          <td>${escapeHtml(event.teamLeader)}</td>
          <td class="num completion">${event.completionPercent}%${event.excuseApplied ? "*" : ""}</td>
        </tr>`,
    )
    .join("");
}

export function renderHoursBenchmarkHtml(
  report: HoursBenchmarkReport,
  scope: HoursBenchmarkHeatmapScope = "low",
): string {
  const { summary, weekNumbers } = report;
  const lead = hoursBenchmarkLeadBlurb(report);
  const subtitle = subtitleLine(report);
  const heatmapScholars = scope === "all" ? report.allHeatmapScholars : report.heatmapScholars;
  const heatmapHeading =
    scope === "all"
      ? "All hour-eligible scholars, week by week"
      : `Students at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower, week by week`;
  const heatmapIntro =
    scope === "all"
      ? `Every enrolled hour-eligible scholar, sorted by name. Each cell is that week's completion %. Week 1 is left out because tracking hadn't started.`
      : `Sorted by how many weeks they were at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower. Each cell is that week's completion %. Week 1 is left out because tracking hadn't started.`;

  const kpi = `
    <div class="kpis">
      <article>
        <span>Students at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower at least once</span>
        <strong>${summary.studentsAtOrBelow50AtLeastOnce}</strong>
        <small>Front desk or study session</small>
      </article>
      <article>
        <span>Times a student logged ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower</span>
        <strong>${summary.atOrBelow50Events}</strong>
        <small>One per student, week and area</small>
      </article>
      <article>
        <span>Times at 0%</span>
        <strong>${summary.zeroPercentEvents}</strong>
        <small>No minutes logged that week</small>
      </article>
      <article>
        <span>Students who missed ${HOURS_BENCHMARK_MET_PERCENT}% at least once</span>
        <strong>${summary.studentsMissed80AtLeastOnce}</strong>
        <small>Including 51–79%</small>
      </article>
    </div>`;

  const heatmap = `
    <table class="heatmap">
      <thead>
        <tr class="group">
          <th rowspan="2" class="scholar-h">Student / team leader</th>
          <th colspan="${Math.max(weekNumbers.length, 1)}" class="group-h">Front desk (by week)</th>
          <th colspan="${Math.max(weekNumbers.length, 1)}" class="group-h">Study session (by week)</th>
          <th rowspan="2" class="count-h">50% or<br>lower</th>
        </tr>
        <tr class="weeks">
          ${weekHeaders(weekNumbers)}
          ${weekHeaders(weekNumbers)}
        </tr>
      </thead>
      <tbody>${heatmapRows(heatmapScholars, scope)}</tbody>
    </table>
    <p class="legend">Red = ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower · Amber = 51–${HOURS_BENCHMARK_MET_PERCENT - 1}% · blank = met ${HOURS_BENCHMARK_MET_PERCENT}% · * = had excused minutes that counted toward completion · (So.) = sophomore</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace()}
    @page{size:letter landscape;margin:.45in .5in .55in}
    *{box-sizing:border-box}
    body{margin:0;font-family:Archivo,Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:10.5px;line-height:1.35;background:#fff}
    h1{font-size:28px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px;color:#111}
    .subtitle{font-size:11px;color:#666;margin:0 0 10px}
    .lead{font-size:11.5px;color:#333;margin:0 0 14px;max-width:95%}
    h2{font-size:18px;font-weight:800;margin:0 0 4px;color:#111}
    .intro{font-size:11px;color:#666;margin:0 0 12px}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 18px}
    .kpis article{border:1px solid #d8d8d8;background:#fafafa;padding:10px 12px;min-height:88px}
    .kpis span{display:block;font-size:10px;color:#666;line-height:1.3;margin:0 0 6px;min-height:2.6em}
    .kpis strong{display:block;font-size:32px;font-weight:800;line-height:1;color:${RED};margin:0 0 6px}
    .kpis small{display:block;font-size:9.5px;color:#888}
    table{width:100%;border-collapse:collapse}
    thead{display:table-header-group}
    tr{break-inside:avoid;page-break-inside:avoid}
    .heatmap{font-size:9px;margin:0 0 6px}
    .heatmap th{font-size:8px;font-weight:600;letter-spacing:.02em;text-transform:none;color:#666;text-align:center;padding:3px 2px;border-bottom:1.5px solid #222;vertical-align:bottom}
    .heatmap th.scholar-h,.heatmap th.count-h{text-align:left;text-transform:none}
    .heatmap th.count-h{text-align:right;line-height:1.15}
    .heatmap th.group-h{font-weight:700;color:#444;padding-bottom:2px;border-bottom:none}
    .heatmap tr.weeks th{border-bottom:1.5px solid #222}
    .heatmap td{padding:2px 2px;border-bottom:1px solid #e6e6e6;vertical-align:middle}
    .heatmap td.heat{text-align:center;width:28px}
    .heatmap .sq{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:20px;padding:0 3px;font-variant-numeric:tabular-nums;font-weight:700;font-size:9px;line-height:1}
    .heatmap .sq.cell-low{background:${RED_CELL};color:#fff}
    .heatmap .sq.cell-mid{background:${AMBER_CELL};color:${AMBER_TEXT}}
    .heatmap .scholar .name{font-weight:700;font-size:10px;color:#111}
    .heatmap .scholar .tl{font-size:8.5px;color:#777;margin-top:1px}
    .heatmap .count{text-align:right;font-weight:800;color:${RED};font-variant-numeric:tabular-nums;padding-right:4px;font-size:11px}
    .legend{font-size:9px;color:#777;margin:8px 0 0}
    .tl-table{font-size:11px;margin-top:4px}
    .tl-table th{font-size:10px;font-weight:600;color:#666;text-align:left;padding:0 8px 6px 0;border-bottom:1.5px solid #222}
    .tl-table th.bar-head{text-align:left;padding-left:0}
    .tl-table th.num,.tl-table td.num{text-align:right;font-variant-numeric:tabular-nums;width:64px}
    .tl-table td{padding:5px 8px 5px 0;border-bottom:1px solid #ececec;vertical-align:middle}
    .tl-table td.tl-name{width:220px;font-weight:500}
    .tl-table td.tl-bar-cell{padding-right:10px}
    .tl-bar{height:14px;background:${RED};min-width:4px}
    .detail{font-size:10.5px;margin-top:4px}
    .detail th{font-size:10px;font-weight:600;color:#666;text-align:left;padding:0 8px 6px 0;border-bottom:1.5px solid #222}
    .detail th.num{text-align:right}
    .detail td{padding:5px 8px 5px 0;border-bottom:1px solid #ececec}
    .detail tbody tr:nth-child(even) td{background:#f3f3f3}
    .detail td.num{text-align:right;font-variant-numeric:tabular-nums}
    .detail td.completion{color:${RED};font-weight:600}
    .empty-row{color:#777;padding:12px 0!important;background:transparent!important}
    section.page{break-before:page;page-break-before:always}
    section.page:first-of-type{break-before:auto;page-break-before:auto}
  </style></head><body>
    <header>
      <h1>CSS Hours Benchmark Report</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      <p class="lead">${escapeHtml(lead)}</p>
    </header>
    ${kpi}
    <section>
      <h2>${escapeHtml(heatmapHeading)}</h2>
      <p class="intro">${escapeHtml(heatmapIntro)}</p>
      ${heatmap}
    </section>
    <section class="page">
      <h2>${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}%-or-lower weeks by team leader</h2>
      <p class="intro">Counts every student, week and area at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower, grouped by the scholar's current team leader.</p>
      ${teamLeaderBars(report)}
    </section>
    <section class="page">
      <h2>Every week at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower</h2>
      <p class="intro">Lowest completion first, then by week.</p>
      <table class="detail">
        <thead>
          <tr>
            <th>Week</th>
            <th>Area</th>
            <th>Student</th>
            <th>Class</th>
            <th>Team leader</th>
            <th class="num">Completion</th>
          </tr>
        </thead>
        <tbody>${detailRows(report)}</tbody>
      </table>
      <p class="legend">* had excused minutes that counted toward completion. Source: CSS Atlas attendance, ${escapeHtml(report.weekRangeLabel)}.</p>
    </section>
  </body></html>`;
}

export function hoursBenchmarkPdfOptions(report: HoursBenchmarkReport) {
  const left = escapeHtml(
    `CSS Hours Benchmark Report · ${report.weekRangeLabel} · Confidential student information`,
  );
  return {
    format: "letter" as const,
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="width:100%;font:8px Archivo,Arial,sans-serif;color:#888;padding:0 0.5in;display:flex;justify-content:space-between;box-sizing:border-box"><span>${left}</span><span>Page <span class="pageNumber"></span></span></div>`,
    margin: { top: "0.45in", right: "0.5in", bottom: "0.55in", left: "0.5in" },
    waitForFonts: true,
  };
}

export { weeklyMemoBrowserLaunchOptions as hoursBenchmarkBrowserLaunchOptions, isMissingBundledChrome };

export async function renderHoursBenchmarkPdf(
  report: HoursBenchmarkReport,
  scope: HoursBenchmarkHeatmapScope = "low",
): Promise<Buffer> {
  const browser = await launchWeeklyMemoBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(renderHoursBenchmarkHtml(report, scope), { waitUntil: "load" });
    return Buffer.from(await page.pdf(hoursBenchmarkPdfOptions(report)));
  } finally {
    await browser.close();
  }
}
