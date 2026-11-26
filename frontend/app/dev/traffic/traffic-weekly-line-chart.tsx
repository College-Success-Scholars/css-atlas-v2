"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WINTER_BREAK_CAMPUS_WEEK_NUMBER } from "@/lib/format/time";
import { cssColor } from "@/lib/theme/css-color";
import type { WeekEntryCount } from "@css-atlas/shared/contracts/traffic";

export type { WeekEntryCount };

interface TrafficWeeklyLineChartProps {
  data: readonly WeekEntryCount[];
  /** When set, x-axis shows all these weeks and missing weeks are plotted as 0. */
  allWeekNumbers?: number[];
  /** Label shown underneath the chart (e.g. "Fall semester"). */
  semesterLabel?: string;
  /** "full" = default width (600px); "half" = half width for side-by-side layout */
  cardSpan?: "full" | "half";
  /** Card header title. Default: "Entry count by week" */
  title?: string;
  /** Card description. Omit or pass null to hide. */
  description?: string | null;
  /** When true, render only the chart and semester label (no Card wrapper). */
  hideCard?: boolean;
  /** Override chart width (e.g. for side-by-side layout so two fit with gap). */
  width?: number;
  /** Override chart height (e.g. for half view to keep card profile square). */
  height?: number;
}

const MARGIN = { top: 24, right: 24, bottom: 32, left: 40 };
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 200;
/** Width per chart when two are shown side by side (fits in max-w-5xl with gap). */
const SIDE_BY_SIDE_WIDTH = 460;
/** Height per chart in half view so card profile is roughly square. */
const HALF_VIEW_CHART_HEIGHT = 180;
/** Same green as the traffic heat map */
const TRAFFIC_COLOR = cssColor.traffic;

const DEFAULT_TITLE = "Entry count by week";
const DEFAULT_DESCRIPTION = "Line graph of entry tickets per campus week (aggregate).";

export function TrafficWeeklyLineChart({
  data,
  allWeekNumbers,
  semesterLabel,
  cardSpan = "full",
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  hideCard = false,
  width: widthOverride,
  height: heightOverride,
}: TrafficWeeklyLineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const chartData = useMemo(
    () =>
      allWeekNumbers != null && allWeekNumbers.length > 0
        ? allWeekNumbers.map((weekNumber) => ({
            weekNumber,
            entryCount: data.find((d) => d.weekNumber === weekNumber)?.entryCount ?? 0,
          }))
        : data.filter((d) => d.entryCount > 0),
    [data, allWeekNumbers]
  );

  const hasAnyData = chartData.some((d) => d.entryCount > 0);
  const showChart = chartData.length > 0 && (allWeekNumbers != null || hasAnyData);

  const totalWidth =
    widthOverride ??
    (cardSpan === "half" ? DEFAULT_WIDTH / 2 : DEFAULT_WIDTH);
  const totalHeight = heightOverride ?? DEFAULT_HEIGHT;

  useEffect(() => {
    if (!svgRef.current || !showChart) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = totalWidth - MARGIN.left - MARGIN.right;
    const height = totalHeight - MARGIN.top - MARGIN.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3
      .scaleLinear()
      .domain(
        d3.extent(chartData, (d: WeekEntryCount) => d.weekNumber) as [number, number]
      )
      .range([0, width])
      .nice();

    const yMax =
      d3.max(chartData, (d: WeekEntryCount) => d.entryCount) ?? 1;
    const y = d3
      .scaleLinear()
      .domain([0, yMax])
      .range([height, 0])
      .nice();

    const sortedData = [...chartData].sort((a, b) => a.weekNumber - b.weekNumber);

    const line = d3
      .line()
      .x((d: WeekEntryCount) => x(d.weekNumber))
      .y((d: WeekEntryCount) => y(d.entryCount))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(sortedData)
      .attr("fill", "none")
      .attr("stroke", TRAFFIC_COLOR)
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("d", line);

    g.selectAll(".dot")
      .data(sortedData)
      .join("circle")
      .attr("class", "dot")
      .attr("cx", (d: WeekEntryCount) => x(d.weekNumber))
      .attr("cy", (d: WeekEntryCount) => y(d.entryCount))
      .attr("r", 3)
      .attr("fill", TRAFFIC_COLOR);

    const xAxis = d3
      .axisBottom(x)
      .ticks(chartData.length)
      .tickFormat((v: number) => String(v));
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .attr("color", cssColor.mutedForeground)
      .selectAll("text")
      .attr("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(y))
      .attr("color", cssColor.mutedForeground)
      .selectAll("text")
      .attr("font-size", "11px");

    return () => {
      svg.selectAll("*").remove();
    };
  }, [chartData, totalWidth, totalHeight, showChart]);

  const chartBlock = (
    <div className="flex flex-col items-center">
      <svg
        ref={svgRef}
        width={totalWidth}
        height={totalHeight}
        className="overflow-visible shrink-0"
      />
      {semesterLabel != null && semesterLabel !== "" && (
        <p className="text-sm font-medium text-muted-foreground pt-2">
          {semesterLabel}
        </p>
      )}
    </div>
  );

  if (!showChart) {
    if (hideCard) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            No traffic data for the selected weeks.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (hideCard) return chartBlock;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description != null && description !== "" && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex justify-center pt-6">
        {chartBlock}
      </CardContent>
    </Card>
  );
}

/** When set to "fall" or "spring", only that semester's chart is shown. Default "both". */
export type TrafficSemesterFilter = "fall" | "spring" | "both";

interface TrafficWeeklyLineChartBySemesterProps {
  data: readonly WeekEntryCount[];
  /** Today's campus week; extends fall/spring axes through this week when in that segment. */
  currentCampusWeek?: number | null;
  /** Minimum last week on the spring axis before extending by current campus week (e.g. 25). */
  maxWeek?: number;
  /** "full" = stacked; "half" = two charts side by side in a grid. */
  cardSpan?: "full" | "half";
  title?: string;
  description?: string | null;
  /** Which semester(s) to show. "both" = fall and spring; "fall" or "spring" = single chart. */
  semesterFilter?: TrafficSemesterFilter;
  /** When true, render only the chart content (no Card wrapper). Use when embedding inside another card. */
  hideCard?: boolean;
}

export function TrafficWeeklyLineChartBySemester({
  data,
  currentCampusWeek = null,
  maxWeek = 25,
  cardSpan = "full",
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  semesterFilter = "both",
  hideCard = false,
}: TrafficWeeklyLineChartBySemesterProps) {
  const fallWeekNumbers = useMemo(() => {
    const lastFallWeek = WINTER_BREAK_CAMPUS_WEEK_NUMBER - 1;
    const fallThrough =
      currentCampusWeek != null && currentCampusWeek < WINTER_BREAK_CAMPUS_WEEK_NUMBER
        ? Math.min(currentCampusWeek, lastFallWeek)
        : lastFallWeek;
    const list: number[] = [];
    for (let w = 1; w <= fallThrough; w++) list.push(w);
    return list;
  }, [currentCampusWeek]);
  const springWeekNumbers = useMemo(() => {
    const springThrough =
      currentCampusWeek != null && currentCampusWeek > WINTER_BREAK_CAMPUS_WEEK_NUMBER
        ? Math.max(maxWeek, currentCampusWeek)
        : maxWeek;
    const list: number[] = [];
    for (let w = WINTER_BREAK_CAMPUS_WEEK_NUMBER + 1; w <= springThrough; w++) list.push(w);
    return list;
  }, [maxWeek, currentCampusWeek]);

  const showFall = (semesterFilter === "both" || semesterFilter === "fall") && fallWeekNumbers.length > 0;
  const showSpring = (semesterFilter === "both" || semesterFilter === "spring") && springWeekNumbers.length > 0;

  const chartSpan = cardSpan === "half" ? "half" : "full";
  /* Full view: side by side with padding; half view: stacked, no top space. When single semester, no grid. */
  const isSingleChart = semesterFilter !== "both";
  const contentClass = isSingleChart
    ? "pt-0 pb-0"
    : cardSpan === "full"
      ? "pt-6 grid grid-cols-1 md:grid-cols-2 gap-6"
      : "pt-0 pb-0 space-y-6";
  /* When full and side-by-side, use smaller width so two charts fit with gap. */
  const chartWidth = cardSpan === "full" && !isSingleChart ? SIDE_BY_SIDE_WIDTH : undefined;
  /* Half view: shorter charts so card profile is roughly square. */
  const chartHeight = cardSpan === "half" ? HALF_VIEW_CHART_HEIGHT : undefined;

  const content = (
    <div className={contentClass}>
      {showFall && (
        <TrafficWeeklyLineChart
          data={data}
          allWeekNumbers={fallWeekNumbers}
          semesterLabel="Fall semester"
          cardSpan={chartSpan}
          width={chartWidth}
          height={chartHeight}
          hideCard
        />
      )}
      {showSpring && (
        <TrafficWeeklyLineChart
          data={data}
          allWeekNumbers={springWeekNumbers}
          semesterLabel="Spring semester"
          cardSpan={chartSpan}
          width={chartWidth}
          height={chartHeight}
          hideCard
        />
      )}
    </div>
  );

  if (hideCard) return content;

  return (
    <Card>
      {cardSpan === "full" && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description != null && description !== "" && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent>{content}</CardContent>
    </Card>
  );
}
