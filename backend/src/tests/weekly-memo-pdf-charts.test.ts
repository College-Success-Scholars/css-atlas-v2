import { describe, expect, it } from "vitest";
import {
  PRINT_CHART,
  cohortBarSvg,
  cohortFillWidth,
  rollingAverage,
  submissionSegmentWidths,
  submissionStackSvg,
  toPrintTrafficSeries,
  trafficBarLineSvg,
  trafficHeatGrid,
  trafficHeatmapSvg,
  trafficScaleMax,
} from "../services/weekly-memo-pdf-charts.js";
import { freshmanCohortYear, sophomoreCohortYear } from "../services/time.service.js";

describe("weekly memo print charts", () => {
  it("sizes submission segments as percentages of the bar", () => {
    expect(submissionSegmentWidths({ onTime: 1, late: 0, missing: 1 })).toEqual({
      onTime: 50,
      late: 0,
      missing: 50,
    });
    expect(submissionSegmentWidths({ onTime: 0, late: 0, missing: 0 })).toEqual({
      onTime: 0,
      late: 0,
      missing: 0,
    });
  });

  it("hatches the late segment and labels the stack for print", () => {
    const svg = submissionStackSvg({ onTime: 2, late: 1, missing: 1 }, "wahf");
    expect(svg).toContain('data-print-chart="submission-stack"');
    expect(svg).toContain('data-print-chart-id="wahf"');
    expect(svg).toContain('id="wahf-late"');
    expect(svg).toContain(`fill="${PRINT_CHART.good}"`);
    expect(svg).toContain('fill="url(#wahf-late)"');
    expect(svg).toContain(`fill="${PRINT_CHART.accent}"`);
    expect(svg).toContain('aria-label="2 on-time, 1 late, 1 missing"');
  });

  it("draws an empty track when no submissions exist", () => {
    const svg = submissionStackSvg({ onTime: 0, late: 0, missing: 0 }, "wpl");
    expect(svg).toContain(`fill="${PRINT_CHART.track}"`);
    expect(svg).not.toContain("url(#wpl-late)");
    expect(svg).toContain("No submissions recorded");
  });

  it("fills cohort bars from completion and uses print status colors", () => {
    const sophomore = sophomoreCohortYear();
    const freshman = freshmanCohortYear();
    expect(cohortFillWidth(3, 10)).toBe(30);
    expect(cohortFillWidth(0, 0)).toBe(0);
    const low = cohortBarSvg({ cohort: sophomore, completed: 2, total: 10 }, "fd-soph");
    expect(low).toContain('data-print-chart="cohort-bar"');
    expect(low).toContain(`data-cohort="${sophomore}"`);
    expect(low).toContain(`fill="${PRINT_CHART.accent}"`);
    expect(low).toContain("Sophomores 2 of 10 complete");
    const high = cohortBarSvg({ cohort: freshman, completed: 10, total: 10 }, "fd-fresh");
    expect(high).toContain(`fill="${PRINT_CHART.good}"`);
    expect(high).toContain("Freshmen 10 of 10 complete");
  });

  it("draws weekly traffic as bars plus a rolling-average line", () => {
    expect(toPrintTrafficSeries([{ weekNumber: 2, entryCount: 20 }], 3)).toEqual([
      { week: 1, visits: 0 },
      { week: 2, visits: 20 },
      { week: 3, visits: 0 },
    ]);
    expect(rollingAverage([10, 20, 30])).toEqual([10, 15, 20]);
    expect(trafficScaleMax([96, 155])).toBe(160);
    const series = toPrintTrafficSeries(
      [
        { weekNumber: 1, entryCount: 96 },
        { weekNumber: 7, entryCount: 155 },
      ],
      7,
    );
    const svg = trafficBarLineSvg(series, 7);
    expect(svg).toContain('data-print-chart="traffic-bar-line"');
    expect(svg).toContain("polyline");
    expect(svg).toContain('data-week="7"');
    expect(svg).toContain(`fill="${PRINT_CHART.ink}"`);
    expect(svg).toContain(`stroke="${PRINT_CHART.accent}"`);
    expect(svg).toContain('preserveAspectRatio="xMinYMid meet"');
    expect(svg).not.toContain('preserveAspectRatio="none"');
    expect(svg).toContain('font-size="10"');
    expect(svg).toContain("Room traffic by campus week, 1 to 7");
  });

  it("bins weekday occupancy into a print heat map", () => {
    const mondayMorning = {
      entryAt: "2026-08-31T12:00:00.000Z",
      exitAt: "2026-08-31T13:00:00.000Z",
    };
    const grid = trafficHeatGrid([mondayMorning]);
    expect(grid).toHaveLength(5);
    expect(grid[0]).toHaveLength(14);
    expect(grid[0]![0]).toBe(1);
    expect(grid.flat().reduce((total, value) => total + value, 0)).toBe(1);
    const svg = trafficHeatmapSvg([mondayMorning]);
    expect(svg).toContain('data-print-chart="traffic-heatmap"');
    expect(svg).toContain("Mon");
    expect(svg).toContain("8am");
    expect(svg).toContain('data-heat-day="0"');
    expect(svg).toContain('preserveAspectRatio="xMinYMid meet"');
  });
});
