import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import puppeteer from "puppeteer";
import { groupRosterByCohort, type WeeklyMemoReport, type WeeklyMemoRosterRow } from "./weekly-memo-report.service.js";
import { scholarYearGroupLabel } from "./time.service.js";
import { cohortBarSvg, submissionStackSvg, trafficBarLineSvg, trafficHeatmapSvg } from "./weekly-memo-pdf-charts.js";

const require = createRequire(import.meta.url);

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function percentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function statusClass(value: number): string {
  return value >= 90 ? "good" : value >= 60 ? "warning" : "bad";
}

function table(headers: string[], rows: string, empty: string, className = ""): string {
  if (!rows) return `<p class="empty">${escapeHtml(empty)}</p>`;
  const heading = headers.length === 0 ? "" : `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`;
  return `<table class="${className}">${heading}<tbody>${rows}</tbody></table>`;
}

function rosterPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

function rosterRows(rows: WeeklyMemoRosterRow[]): string {
  return rows.map((row) => `<tr><td>${escapeHtml(row.scholarName)}</td><td>${escapeHtml(row.cohort ?? "-")}</td><td class="number">${row.completedMinutes}</td><td class="number ${statusClass(row.completionPercent)}">${rosterPercentage(row.completionPercent)}</td></tr>`).join("");
}

function cohortClassYearLabel(cohort: number | null): string {
  if (cohort == null) return "Cohort unknown";
  return scholarYearGroupLabel(cohort) ?? `Cohort ${cohort}`;
}

function twoColumnRoster(rows: WeeklyMemoRosterRow[], empty: string): string {
  const left = rows.filter((_, index) => index % 2 === 0);
  const right = rows.filter((_, index) => index % 2 === 1);
  const headers = ["Scholar", "Cohort", "Min", "Compl."];
  return `<div class="two-column-roster">${table(headers, rosterRows(left), empty, "roster compact-roster")}${table(headers, rosterRows(right), empty, "roster compact-roster")}</div>`;
}

function rosterTables(rows: WeeklyMemoRosterRow[], empty: string): string {
  if (rows.length === 0) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return groupRosterByCohort(rows).map((group) =>
    `<div class="roster-cohort"><h4>${escapeHtml(cohortClassYearLabel(group.cohort))}</h4>${twoColumnRoster(group.rows, empty)}</div>`
  ).join("");
}

function fontFace(): string {
  const font = readFileSync(require.resolve("@fontsource/archivo/files/archivo-latin-400-normal.woff2")).toString("base64");
  const semiboldFont = readFileSync(require.resolve("@fontsource/archivo/files/archivo-latin-600-normal.woff2")).toString("base64");
  const boldFont = readFileSync(require.resolve("@fontsource/archivo/files/archivo-latin-800-normal.woff2")).toString("base64");
  return `@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400}@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${semiboldFont}) format('woff2');font-weight:600}@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${boldFont}) format('woff2');font-weight:800}`;
}

export function renderWeeklyMemoHtml(report: WeeklyMemoReport): string {
  const attention = report.attention;
  const overviewRows = (items: typeof report.overview.frontDesk, chartId: string) => items.map((item) => {
    const completion = item.total === 0 ? 0 : (item.completed / item.total) * 100;
    return `<div class="cohort-figure"><div class="overview-row"><span>${escapeHtml(cohortClassYearLabel(item.cohort))}</span><b>${item.completed}&nbsp;/&nbsp;${item.total} <em class="${statusClass(completion)}">(${Math.round(completion)}%)</em></b></div>${cohortBarSvg(item, `${chartId}-${item.cohort}`)}</div>`;
  }).join("");
  const submissionTile = (label: string, submission: typeof report.overview.submissions.wahf, id: string) => `<article class="stat-tile submission"><span>${label}</span>${submissionStackSvg(submission, id)}<div>On-time <b>${submission.onTime}</b></div><div>Late <b>${submission.late}</b></div><div class="${submission.missing > 0 ? "missing" : ""}">Missing <b>${submission.missing}</b></div></article>`;
  const snapshot = `<div class="snapshot">
    <div class="snapshot-group"><div class="group-kicker">Scholars</div><div class="snapshot-grid cols-4">
    <article class="stat-tile overview"><span>Front Desk Hours</span><small>${report.snapshotCompletePercent}% or more</small>${overviewRows(report.overview.frontDesk, "fd")}</article>
    <article class="stat-tile overview"><span>Study Session Hours</span><small>${report.snapshotCompletePercent}% or more</small>${overviewRows(report.overview.studySession, "ss")}</article>
    <article class="stat-tile"><span>Tutoring Sessions</span><strong>${report.overview.tutoring.sessionsLogged}</strong><p>sessions logged</p><small class="accent">${report.overview.tutoring.noShowCount} no-show${report.overview.tutoring.noShowCount === 1 ? "" : "s"}</small></article>
    ${submissionTile("Scholar WAHF", report.overview.submissions.wahf, "wahf")}
    </div></div>
    <div class="snapshot-group"><div class="group-kicker">Team Leaders</div><div class="snapshot-grid cols-3">
    ${submissionTile("TL WAHF", report.overview.submissions.tlWahf, "tl-wahf")}
    ${submissionTile("TL WPL", report.overview.submissions.wpl, "wpl")}
    ${submissionTile("TL MCF", report.overview.submissions.mcf, "mcf")}
    </div></div>
  </div>`;
  const trafficBody = `<div class="traffic-kpis">
    <article class="stat-tile"><span>This Week</span><strong>${report.overview.traffic.thisWeek}</strong><p>visits</p></article>
    <article class="stat-tile"><span>This Semester</span><strong>${report.overview.traffic.thisSemester}</strong><p>visits</p></article>
  </div>
    ${trafficBarLineSvg(report.overview.traffic.weekly, report.weekNumber)}
    ${trafficHeatmapSvg(report.overview.traffic.sessions)}
    <p class="traffic-note">Mon–Fri, 8am–10pm ET. One-hour slots. Darker red means more overlapping visits this campus week.</p>`;
  const wahfAttentionRows = attention.wahf.map((row) => `<tr><td>${escapeHtml(row.scholarName)}</td><td>${escapeHtml(row.cohort ?? "-")}</td><td>${escapeHtml(row.status)}</td></tr>`).join("");
  const tlAttentionRows = attention.tlSubmissions.map((row) => `<tr><td>${escapeHtml(row.leaderName)}</td><td>${escapeHtml(row.issues.join(", "))}</td></tr>`).join("");
  const attentionBody = `<div class="attention-grid"><div><h4>Missing or Late Scholar WAHF</h4>${table(["Scholar", "Cohort", "Status"], wahfAttentionRows, "No scholars have a missing or late WAHF.", "roster")}</div><div><h4>Team Leader Submissions</h4>${table(["Team leader", "What's missing"], tlAttentionRows, "No team leaders have missing or late submissions.", "roster")}</div></div>
    <div class="attention-grid"><div><h4>Study Session Completion Below ${report.attentionThresholdPercent}%</h4>${table(["Scholar", "Cohort", "Min", "Compl."], rosterRows(attention.studyCompletion), "No scholars require follow-up for study-session completion.", "roster")}</div><div><h4>Front Desk Completion Below ${report.attentionThresholdPercent}%</h4>${table(["Scholar", "Cohort", "Min", "Compl."], rosterRows(attention.frontDeskCompletion), "No scholars require follow-up for front-desk completion.", "roster")}</div></div>
    <h4>Tutoring No-Shows</h4>${table(["Scholar", "Tutor", "Day"], attention.tutoringNoShows.map((row) => `<tr><td>${escapeHtml(row.scholarName)}</td><td>${escapeHtml(row.tutorName ?? "-")}</td><td>${escapeHtml(row.dayOfWeek)}</td></tr>`).join(""), "No tutoring no-shows were recorded.")}
    <h4>Grades C+ or Lower</h4>${table(["Scholar", "Course", "Assignment", "Grade"], attention.lowGrades.map((row) => `<tr><td>${escapeHtml(row.scholarName)}</td><td>${escapeHtml(row.course)}</td><td>${escapeHtml(row.assessment)}</td><td class="number ${statusClass(row.percent)}">${percentage(row.percent)}</td></tr>`).join(""), "No grades C+ or lower were submitted.")}`;
  const tutoring = report.tutoringByDay
    .filter(({ sessions }) => sessions.some((session) => session.scholarName !== "EMPTY SESSION"))
    .map(({ day, sessions }) => `<div class="tutoring-day"><div>${escapeHtml(day)}</div>${sessions.filter((session) => session.scholarName !== "EMPTY SESSION").map((session) => `<p><span>${escapeHtml(session.tutorName ?? "-")}</span><b>${escapeHtml(session.scholarName)}</b></p>`).join("")}</div>`).join("") || `<p class="empty">No tutoring sessions were recorded.</p>`;
  const recognitionRows = (rows: typeof report.recognition.high) => rows.map((row) => `<tr><td>${escapeHtml(row.scholarName)}</td><td>${escapeHtml(`${row.course}, ${row.assessment}`)}</td><td class="number ${statusClass(row.percent)}">${percentage(row.percent)}</td></tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace()}
    @page{size:letter;margin:.75in}*{box-sizing:border-box}body{margin:0;font-family:Archivo,Arial,sans-serif;color:#201e1d;font-size:13px;line-height:1.4}table{width:100%;border-collapse:collapse} .masthead{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid #201e1d;padding-bottom:14px;margin-bottom:28px}.eyebrow,.section-kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#ec3013;font-weight:600}.masthead h1{font-size:34px;font-weight:800;letter-spacing:-.01em;line-height:1;margin:0}.masthead .eyebrow{margin-bottom:6px}.week{flex:none;text-align:right;font-size:13px;line-height:1.4}.week b{font-size:15px;font-weight:800}.week span{color:rgba(32,30,29,.65)}.section-heading{margin-bottom:12px}.section-heading h2{font-size:23px;font-weight:800;margin:2px 0 0}.rule{height:2px;background:rgba(32,30,29,.4);margin:8px 0 18px}.snapshot{margin-bottom:32px;break-inside:avoid}.snapshot-group{margin-top:16px}.group-kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#ec3013;font-weight:600;margin:0 0 8px}.snapshot-grid{display:grid}.snapshot-grid.cols-4{grid-template-columns:repeat(4,1fr)}.snapshot-grid.cols-3{grid-template-columns:repeat(3,1fr)}.stat-tile{background:#f8f4f4;padding:16px;border-right:1px solid rgba(32,30,29,.4);border-bottom:1px solid rgba(32,30,29,.4);min-height:112px}.stat-tile.traffic{border-right:0}.snapshot-grid .stat-tile:last-child{border-right:0}.snapshot-grid .stat-tile{border-bottom:0}.stat-tile>span{display:block;font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:rgba(32,30,29,.6);margin-bottom:6px;white-space:nowrap}.stat-tile strong{display:block;font-size:30px;font-weight:800;line-height:1}.stat-tile p{font-size:12px;margin:4px 0 0}.stat-tile small{display:block;font-size:11px;color:rgba(32,30,29,.55);margin-top:6px}.accent,.missing{color:#ec3013!important}.overview>span{margin-bottom:10px}.overview-row{display:flex;justify-content:space-between;gap:8px;font-size:13px}.overview-row b{font-size:15px;font-weight:800;white-space:nowrap}.overview-row em{font-size:11px;font-style:normal}.mini-rule{height:1px;background:rgba(32,30,29,.15);margin:8px 0}.traffic-kpis{display:grid;grid-template-columns:1fr 1fr;margin-bottom:16px}.traffic-kpis .stat-tile:last-child{border-right:0}.print-figure{display:block;width:100%;height:8px;margin:6px 0 8px}.print-figure.combo{height:auto;aspect-ratio:640/140}.print-figure.heatmap{height:auto;aspect-ratio:640/300;margin-top:16px}.traffic-note{font-size:11px;color:rgba(32,30,29,.55);margin:10px 0 0}.cohort-figure+.cohort-figure{margin-top:10px}.submission div{display:flex;justify-content:space-between;font-size:14px;margin-top:3px}.submission b{font-weight:800}.attention-grid,.two-column-roster,.recognition-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.attention-grid{margin-bottom:24px}.attention-grid h4,h4{font-size:14px;font-weight:800;margin:0 0 8px;break-after:avoid}h4{font-size:15px;margin-top:0}table{font-size:13px;margin-bottom:24px}thead{display:table-header-group}th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(32,30,29,.6);text-align:left;padding:8px;border-bottom:2px solid #201e1d}td{padding:7px 8px;border-bottom:1px solid rgba(32,30,29,.25);vertical-align:top}tr{break-inside:avoid;page-break-inside:avoid}.roster{font-size:12px}.roster th{font-size:9px;letter-spacing:.06em;padding:6px}.roster td{padding:5px 6px}.number{text-align:right;white-space:nowrap;font-weight:600}.good{color:#1a6b3c}.warning{color:#a06a00}.bad{color:#ae1800}.empty{font-size:12px;color:rgba(32,30,29,.6);margin:0 0 24px}section+section{break-before:page}.appendix-intro{font-size:12px;color:rgba(32,30,29,.6);margin:0 0 14px}.compact-roster{font-size:11.5px}.compact-roster th{font-size:9px;padding:5px 6px}.compact-roster td{padding:3px 6px;border-bottom-color:rgba(32,30,29,.2)}.two-column-roster{margin-bottom:16px}.roster-cohort{margin-bottom:20px}.roster-cohort h4{margin:0 0 8px}.tutoring-log{column-count:2;column-gap:28px;margin-bottom:32px}.tutoring-day{break-inside:avoid;margin-bottom:14px}.tutoring-day>div{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ec3013;border-bottom:1px solid rgba(32,30,29,.25);padding-bottom:3px;margin-bottom:4px}.tutoring-day p{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:2px 0;line-height:1.4;margin:0}.tutoring-day p span{color:rgba(32,30,29,.6)}.tutoring-day p b{text-align:right;font-weight:600}.recognition-grid{gap:28px}.recognition-grid h4{font-size:14px;margin:0 0 8px}.recognition-grid h4:first-child{color:#ae1800}.recognition-grid h4:last-child{color:rgba(32,30,29,.7)}.recognition-grid table{font-size:12px}.recognition-grid td{padding:5px 4px;border-bottom-color:rgba(32,30,29,.2)}.recognition-grid td:nth-child(2){color:rgba(32,30,29,.65)}@media print{section+section{break-before:page}}</style></head><body>
    <header class="masthead"><div><div class="eyebrow">Office of Multi-Ethnic Student Education &middot; University of Maryland, College Park</div><h1>CSS Weekly Memo</h1></div><div class="week"><b>${escapeHtml(report.weekLabel)}</b><br><span>${escapeHtml(report.dateRange)}</span><br><span>Printed ${escapeHtml(report.printedAtLabel)}</span></div></header>
    <section><div class="section-heading"><div class="section-kicker">01 &mdash; Snapshot</div><h2>Program Snapshot</h2></div><div class="rule"></div>${snapshot}</section>
    <section><div class="section-heading"><div class="section-kicker">02 &mdash; Room Traffic</div><h2>Room Traffic</h2></div><div class="rule"></div>${trafficBody}</section>
    <section><div class="section-heading"><div class="section-kicker">03 &mdash; Needs Attention</div><h2>Needs Attention</h2></div><div class="rule"></div>${attentionBody}</section>
    <section class="appendix"><div class="section-heading"><div class="section-kicker">Appendix</div><h2>Study Session Completion &mdash; Full Roster</h2></div><div class="rule"></div><p class="appendix-intro">Sorted by minutes, highest first, and grouped by cohort. Every Scholar with a Study Session requirement, ${escapeHtml(report.weekLabel)}.</p>${rosterTables(report.studyRoster, "No study-session requirements apply this week.")}</section>
    <section class="appendix"><div class="section-heading"><div class="section-kicker">Appendix</div><h2>Front Desk Completion &mdash; Full Roster</h2></div><div class="rule"></div><p class="appendix-intro">Sorted by minutes, highest first, and grouped by cohort. Every Scholar with a Front Desk requirement, ${escapeHtml(report.weekLabel)}.</p>${rosterTables(report.frontDeskRoster, "No front-desk requirements apply this week.")}</section>
    <section class="appendix"><div class="section-heading"><div class="section-kicker">Appendix</div><h2>Tutoring Session Log</h2></div><div class="rule"></div><div class="tutoring-log">${tutoring}</div></section>
    <section class="appendix"><div class="section-heading"><div class="section-kicker">Appendix</div><h2>Recognition Board, ${escapeHtml(report.weekLabel)}</h2></div><div class="rule"></div><div class="recognition-grid"><div><h4>90% or Higher</h4>${table([], recognitionRows(report.recognition.high), "No grades of 90% or higher were submitted.")}</div><div><h4>80 to 90%</h4>${table([], recognitionRows(report.recognition.mid), "No grades from 80% to 89% were submitted.")}</div></div></section>
  </body></html>`;
}

export function weeklyMemoPdfOptions(report: WeeklyMemoReport) {
  return {
    format: "letter" as const,
    landscape: false,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="width:100%;font:8px Archivo,Arial,sans-serif;color:rgba(32,30,29,.65);text-align:center">${escapeHtml(report.weekLabel)} | ${escapeHtml(report.dateRange)} | Printed ${escapeHtml(report.printedAtLabel)}</div>`,
    margin: { top: "0.75in", right: "0.75in", bottom: "0.75in", left: "0.75in" },
    waitForFonts: true,
  };
}

const PDF_BROWSER_ARGS = [
  "--font-render-hinting=none",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  // Railway/Docker /dev/shm is often 64MB; Chromium crashes without this.
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

export function weeklyMemoBrowserLaunchOptions(env: NodeJS.ProcessEnv = process.env) {
  if (env.PUPPETEER_EXECUTABLE_PATH) {
    return { headless: true as const, executablePath: env.PUPPETEER_EXECUTABLE_PATH, args: PDF_BROWSER_ARGS };
  }
  return { headless: true as const, args: PDF_BROWSER_ARGS };
}

export function isMissingBundledChrome(error: unknown): boolean {
  return error instanceof Error && /Could not find Chrome/i.test(error.message);
}

export async function launchWeeklyMemoBrowser() {
  const options = weeklyMemoBrowserLaunchOptions();
  try {
    return await puppeteer.launch(options);
  } catch (error) {
    if (options.executablePath || !isMissingBundledChrome(error)) throw error;
    // npm install does not always download Chrome. Use the machine's installed Chrome.
    return puppeteer.launch({ ...options, channel: "chrome" });
  }
}

export async function renderWeeklyMemoPdf(report: WeeklyMemoReport): Promise<Buffer> {
  const browser = await launchWeeklyMemoBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(renderWeeklyMemoHtml(report), { waitUntil: "load" });
    return Buffer.from(await page.pdf(weeklyMemoPdfOptions(report)));
  } finally {
    await browser.close();
  }
}
