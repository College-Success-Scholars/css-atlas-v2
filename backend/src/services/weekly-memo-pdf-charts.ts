/**
 * @file weekly-memo-pdf-charts.ts
 * @module backend/services
 *
 * Print-only SVG figures for the weekly memo PDF snapshot.
 * Vector markup for Puppeteer — no React, Recharts, or dashboard CSS variables.
 *
 * ## What belongs here
 * - Stacked submission bars (on-time / late / missing)
 * - Cohort completion tracks (front desk / study session)
 * - Traffic combo chart (weekly bars + rolling-average line)
 * - Traffic heat map (Mon–Fri, 8am–10pm ET)
 *
 * ## What does NOT belong here
 * - Interactive or dark-mode charts
 * - Needs Attention / appendix tables
 */
import { scholarYearGroupLabel } from "./time.service.js";

export type PrintSubmissionCounts = {
  onTime: number;
  late: number;
  missing: number;
};

export type PrintCohortHours = {
  cohort: number;
  completed: number;
  total: number;
};

export type PrintTrafficPoint = {
  week: number;
  visits: number;
};

export type PrintTrafficSession = {
  entryAt: string;
  exitAt: string;
};

/** Continuous week-1…N series; missing campus weeks count as 0 visits. */
export function toPrintTrafficSeries(
  rows: Array<{ weekNumber: number; entryCount: number }>,
  throughWeek: number,
): PrintTrafficPoint[] {
  const byWeek = new Map(rows.map((row) => [row.weekNumber, row.entryCount]));
  const last = Math.max(0, Math.floor(throughWeek));
  return Array.from({ length: last }, (_, index) => {
    const week = index + 1;
    return { week, visits: byWeek.get(week) ?? 0 };
  });
}

export const PRINT_CHART = {
  ink: "#201e1d",
  accent: "#ec3013",
  good: "#1a6b3c",
  warn: "#a06a00",
  track: "#d9d4d4",
} as const;

const STACK_WIDTH = 100;
const STACK_HEIGHT = 8;

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function submissionSegmentWidths(counts: PrintSubmissionCounts): {
  onTime: number;
  late: number;
  missing: number;
} {
  const total = counts.onTime + counts.late + counts.missing;
  if (total <= 0) return { onTime: 0, late: 0, missing: 0 };
  return {
    onTime: round1((counts.onTime / total) * STACK_WIDTH),
    late: round1((counts.late / total) * STACK_WIDTH),
    missing: round1((counts.missing / total) * STACK_WIDTH),
  };
}

function lateHatch(id: string): string {
  return `<defs><pattern id="${escapeXml(id)}-late" patternUnits="userSpaceOnUse" width="4" height="4"><rect width="4" height="4" fill="${PRINT_CHART.warn}"/><path d="M0 4 L4 0" stroke="#fff" stroke-width="1"/></pattern></defs>`;
}

/**
 * Horizontal stacked bar. Late uses a hatch so the three states survive grayscale.
 * Count labels stay in the surrounding HTML tile — segments are too small for type.
 */
export function submissionStackSvg(counts: PrintSubmissionCounts, id: string): string {
  const widths = submissionSegmentWidths(counts);
  const total = counts.onTime + counts.late + counts.missing;
  const label = total === 0
    ? "No submissions recorded"
    : `${counts.onTime} on-time, ${counts.late} late, ${counts.missing} missing`;
  let x = 0;
  const segments: string[] = [];
  const push = (width: number, fill: string) => {
    if (width <= 0) return;
    segments.push(`<rect x="${x}" y="0" width="${width}" height="${STACK_HEIGHT}" fill="${fill}"/>`);
    x = round1(x + width);
  };
  push(widths.onTime, PRINT_CHART.good);
  push(widths.late, `url(#${escapeXml(id)}-late)`);
  push(widths.missing, PRINT_CHART.accent);
  const body = segments.length === 0
    ? `<rect x="0" y="0" width="${STACK_WIDTH}" height="${STACK_HEIGHT}" fill="${PRINT_CHART.track}"/>`
    : segments.join("");
  return `<svg class="print-figure" data-print-chart="submission-stack" data-print-chart-id="${escapeXml(id)}" viewBox="0 0 ${STACK_WIDTH} ${STACK_HEIGHT}" role="img" aria-label="${escapeXml(label)}" preserveAspectRatio="none">${lateHatch(id)}<rect x="0" y="0" width="${STACK_WIDTH}" height="${STACK_HEIGHT}" fill="${PRINT_CHART.track}"/>${body}</svg>`;
}

export function cohortFillWidth(completed: number, total: number): number {
  if (total <= 0) return 0;
  return round1(Math.min(100, Math.max(0, (completed / total) * STACK_WIDTH)));
}

function cohortHoursName(cohort: number): string {
  return scholarYearGroupLabel(cohort) ?? `Cohort ${cohort}`;
}

export function cohortBarSvg(item: PrintCohortHours, id: string): string {
  const fill = cohortFillWidth(item.completed, item.total);
  const fillColor = fill >= 90 ? PRINT_CHART.good : fill >= 60 ? PRINT_CHART.warn : PRINT_CHART.accent;
  const name = cohortHoursName(item.cohort);
  const label = item.total <= 0
    ? `${name} has no hours requirement`
    : `${name} ${item.completed} of ${item.total} complete`;
  const fillRect = fill > 0
    ? `<rect x="0" y="0" width="${fill}" height="${STACK_HEIGHT}" fill="${fillColor}"/>`
    : "";
  return `<svg class="print-figure" data-print-chart="cohort-bar" data-print-chart-id="${escapeXml(id)}" data-cohort="${item.cohort}" viewBox="0 0 ${STACK_WIDTH} ${STACK_HEIGHT}" role="img" aria-label="${escapeXml(label)}" preserveAspectRatio="none"><rect x="0" y="0" width="${STACK_WIDTH}" height="${STACK_HEIGHT}" fill="${PRINT_CHART.track}"/>${fillRect}</svg>`;
}

const TRAFFIC_WIDTH = 640;
const TRAFFIC_HEIGHT = 140;
const TRAFFIC_PAD = { top: 12, right: 12, bottom: 28, left: 40 };
const TRAFFIC_ROLLING_WINDOW = 3;
const TRAFFIC_TYPE = `font-family="Archivo,Arial,sans-serif" font-size="10" fill="${PRINT_CHART.ink}" fill-opacity="0.7"`;

export function rollingAverage(values: number[], window = TRAFFIC_ROLLING_WINDOW): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    return round1(slice.reduce((sum, value) => sum + value, 0) / slice.length);
  });
}

export function trafficScaleMax(values: number[]): number {
  const peak = Math.max(0, ...values);
  if (peak <= 0) return 10;
  return Math.ceil(peak / 10) * 10;
}

/**
 * Weekly visit bars with a rolling-average line on top.
 * Current week is a solid ink bar; other weeks are muted so the red trend line stays readable in print.
 */
export function trafficBarLineSvg(series: PrintTrafficPoint[], currentWeek: number): string {
  const plotWidth = TRAFFIC_WIDTH - TRAFFIC_PAD.left - TRAFFIC_PAD.right;
  const plotHeight = TRAFFIC_HEIGHT - TRAFFIC_PAD.top - TRAFFIC_PAD.bottom;
  const visits = series.map((point) => point.visits);
  const trend = rollingAverage(visits);
  const max = trafficScaleMax([...visits, ...trend]);
  const label = series.length === 0
    ? "No traffic recorded"
    : `Room traffic by campus week, ${series[0]!.week} to ${series[series.length - 1]!.week}`;

  if (series.length === 0) {
    return `<svg class="print-figure combo" data-print-chart="traffic-bar-line" viewBox="0 0 ${TRAFFIC_WIDTH} ${TRAFFIC_HEIGHT}" role="img" aria-label="${escapeXml(label)}" preserveAspectRatio="xMinYMid meet"><rect x="${TRAFFIC_PAD.left}" y="${TRAFFIC_PAD.top}" width="${plotWidth}" height="${plotHeight}" fill="${PRINT_CHART.track}"/></svg>`;
  }

  const slot = plotWidth / series.length;
  const barWidth = round1(slot * 0.58);
  const yFor = (value: number) => round1(TRAFFIC_PAD.top + plotHeight - (value / max) * plotHeight);
  const bars = series.map((point, index) => {
    const x = round1(TRAFFIC_PAD.left + index * slot + (slot - barWidth) / 2);
    const y = yFor(point.visits);
    const height = round1(TRAFFIC_PAD.top + plotHeight - y);
    const fill = point.week === currentWeek ? PRINT_CHART.ink : PRINT_CHART.track;
    return `<rect data-week="${point.week}" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(0, height)}" fill="${fill}"/>`;
  }).join("");
  const points = series.map((point, index) => {
    const x = round1(TRAFFIC_PAD.left + index * slot + slot / 2);
    return `${x},${yFor(trend[index]!)}`;
  }).join(" ");
  const dots = series.map((point, index) => {
    const x = round1(TRAFFIC_PAD.left + index * slot + slot / 2);
    return `<circle cx="${x}" cy="${yFor(trend[index]!)}" r="2.2" fill="${PRINT_CHART.accent}"/>`;
  }).join("");
  const weekLabels = series.map((point, index) => {
    const crowded = series.length > 16;
    const step = series.length > 24 ? 3 : 2;
    const show = !crowded || point.week === currentWeek || index === 0 || index === series.length - 1 || point.week % step === 0;
    if (!show) return "";
    const x = round1(TRAFFIC_PAD.left + index * slot + slot / 2);
    return `<text x="${x}" y="${TRAFFIC_HEIGHT - 8}" text-anchor="middle" ${TRAFFIC_TYPE}>${point.week}</text>`;
  }).join("");
  const axisX = TRAFFIC_PAD.left - 8;
  const axis = `<text x="${axisX}" y="${TRAFFIC_PAD.top + 10}" text-anchor="end" ${TRAFFIC_TYPE}>${max}</text><text x="${axisX}" y="${TRAFFIC_PAD.top + plotHeight}" text-anchor="end" ${TRAFFIC_TYPE}>0</text>`;
  const baseline = `<line x1="${TRAFFIC_PAD.left}" y1="${TRAFFIC_PAD.top + plotHeight}" x2="${TRAFFIC_PAD.left + plotWidth}" y2="${TRAFFIC_PAD.top + plotHeight}" stroke="${PRINT_CHART.ink}" stroke-opacity="0.2" stroke-width="1"/>`;

  return `<svg class="print-figure combo" data-print-chart="traffic-bar-line" viewBox="0 0 ${TRAFFIC_WIDTH} ${TRAFFIC_HEIGHT}" role="img" aria-label="${escapeXml(label)}" preserveAspectRatio="xMinYMid meet">${baseline}${axis}${bars}<polyline fill="none" stroke="${PRINT_CHART.accent}" stroke-width="2" points="${points}"/>${dots}${weekLabels}</svg>`;
}

const HEAT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const HEAT_START_HOUR = 8;
const HEAT_HOURS = 14;
const HEAT_WIDTH = 640;
const HEAT_HEIGHT = 300;
const HEAT_PAD = { top: 22, right: 12, bottom: 32, left: 44 };
export const PRINT_TRAFFIC_HEAT_SLOT_MINUTES = 60;

function hexRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function lerpHex(from: string, to: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
  const [fr, fg, fb] = hexRgb(from);
  const [tr, tg, tb] = hexRgb(to);
  const hex = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${hex(Math.round(fr + (tr - fr) * t))}${hex(Math.round(fg + (tg - fg) * t))}${hex(Math.round(fb + (tb - fb) * t))}`;
}

function heatSlotsPerDay(slotMinutes: number): number {
  return Math.floor((HEAT_HOURS * 60) / slotMinutes);
}

function parseHeatSlot(iso: string, slotMinutes: number): { dayOfWeek: number; slotIndex: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const dayOfWeek = HEAT_DAYS.indexOf(weekday as (typeof HEAT_DAYS)[number]);
  const minutesFromOpen = (hour - HEAT_START_HOUR) * 60 + minute;
  const slotCount = heatSlotsPerDay(slotMinutes);
  const slotIndex = hour >= HEAT_START_HOUR && hour < HEAT_START_HOUR + HEAT_HOURS && minutesFromOpen >= 0 && minutesFromOpen < HEAT_HOURS * 60
    ? Math.min(Math.floor(minutesFromOpen / slotMinutes), slotCount - 1)
    : -1;
  return { dayOfWeek, slotIndex };
}

function hourLabel(slotIndex: number, slotMinutes: number): string {
  const hour = HEAT_START_HOUR + Math.floor((slotIndex * slotMinutes) / 60);
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

/** Mon–Fri occupancy grid in ET, matching the dashboard traffic heat map. */
export function trafficHeatGrid(
  sessions: PrintTrafficSession[],
  slotMinutes = PRINT_TRAFFIC_HEAT_SLOT_MINUTES,
): number[][] {
  const slotCount = heatSlotsPerDay(slotMinutes);
  const grid = Array.from({ length: HEAT_DAYS.length }, () => Array.from({ length: slotCount }, () => 0));
  const slotMs = slotMinutes * 60 * 1000;
  for (const session of sessions) {
    const entryMs = new Date(session.entryAt).getTime();
    const exitMs = new Date(session.exitAt).getTime();
    if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs) || exitMs <= entryMs) continue;
    const t0 = Math.floor(entryMs / slotMs) * slotMs;
    for (let tick = t0; tick < exitMs; tick += slotMs) {
      const { dayOfWeek, slotIndex } = parseHeatSlot(new Date(tick).toISOString(), slotMinutes);
      if (dayOfWeek >= 0 && slotIndex >= 0) grid[dayOfWeek]![slotIndex]! += 1;
    }
  }
  return grid;
}

/**
 * Day × hour occupancy. 60-minute slots so labels stay readable in print.
 * Empty cells use the paper track; busier cells move toward OMSE red.
 */
export function trafficHeatmapSvg(
  sessions: PrintTrafficSession[],
  slotMinutes = PRINT_TRAFFIC_HEAT_SLOT_MINUTES,
): string {
  const grid = trafficHeatGrid(sessions, slotMinutes);
  const slotCount = heatSlotsPerDay(slotMinutes);
  const peak = Math.max(0, ...grid.flat());
  const plotWidth = HEAT_WIDTH - HEAT_PAD.left - HEAT_PAD.right;
  const plotHeight = HEAT_HEIGHT - HEAT_PAD.top - HEAT_PAD.bottom;
  const cellWidth = round1(plotWidth / HEAT_DAYS.length);
  const cellHeight = round1(plotHeight / slotCount);
  const label = peak === 0
    ? "No room traffic in this campus week"
    : `Room traffic heat map, Monday to Friday, 8am to 10pm Eastern, peak ${peak}`;

  const dayLabels = HEAT_DAYS.map((day, index) => {
    const x = round1(HEAT_PAD.left + index * cellWidth + cellWidth / 2);
    return `<text x="${x}" y="14" text-anchor="middle" ${TRAFFIC_TYPE}>${day}</text>`;
  }).join("");
  const hourLabels = Array.from({ length: slotCount }, (_, slot) => {
    const y = round1(HEAT_PAD.top + slot * cellHeight + cellHeight / 2 + 3);
    return `<text x="${HEAT_PAD.left - 6}" y="${y}" text-anchor="end" ${TRAFFIC_TYPE}>${hourLabel(slot, slotMinutes)}</text>`;
  }).join("");
  const cells = grid.flatMap((row, day) => row.map((value, slot) => {
    const x = round1(HEAT_PAD.left + day * cellWidth + 1);
    const y = round1(HEAT_PAD.top + slot * cellHeight + 1);
    const fill = value <= 0 || peak <= 0 ? PRINT_CHART.track : lerpHex(PRINT_CHART.track, PRINT_CHART.accent, value / peak);
    const count = value > 0
      ? `<text x="${round1(x + (cellWidth - 2) / 2)}" y="${round1(y + (cellHeight - 2) / 2 + 3)}" text-anchor="middle" font-family="Archivo,Arial,sans-serif" font-size="8" fill="${value / peak >= 0.45 ? "#fff" : PRINT_CHART.ink}">${value}</text>`
      : "";
    return `<rect data-heat-day="${day}" data-heat-slot="${slot}" x="${x}" y="${y}" width="${round1(cellWidth - 2)}" height="${round1(cellHeight - 2)}" fill="${fill}"/>${count}`;
  })).join("");
  const legendY = HEAT_HEIGHT - 12;
  const legend = `<rect x="${HEAT_PAD.left}" y="${legendY - 8}" width="12" height="8" fill="${PRINT_CHART.track}"/><text x="${HEAT_PAD.left + 16}" y="${legendY}" ${TRAFFIC_TYPE}>Fewer</text><rect x="${HEAT_WIDTH - HEAT_PAD.right - 70}" y="${legendY - 8}" width="12" height="8" fill="${PRINT_CHART.accent}"/><text x="${HEAT_WIDTH - HEAT_PAD.right - 54}" y="${legendY}" ${TRAFFIC_TYPE}>More</text>`;

  return `<svg class="print-figure heatmap" data-print-chart="traffic-heatmap" viewBox="0 0 ${HEAT_WIDTH} ${HEAT_HEIGHT}" role="img" aria-label="${escapeXml(label)}" preserveAspectRatio="xMinYMid meet">${dayLabels}${hourLabels}${cells}${legend}</svg>`;
}
