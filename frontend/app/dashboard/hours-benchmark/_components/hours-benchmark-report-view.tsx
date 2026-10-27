import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  HOURS_BENCHMARK_AT_OR_BELOW_PERCENT,
  HOURS_BENCHMARK_MET_PERCENT,
  type HoursBenchmarkCell,
  type HoursBenchmarkReport,
} from "../types";
import { HoursBenchmarkExportButton } from "./hours-benchmark-export-button";

function cellTone(pct: number | null): "low" | "mid" | "met" | "empty" {
  if (pct == null) return "empty";
  if (pct >= HOURS_BENCHMARK_MET_PERCENT) return "met";
  if (pct <= HOURS_BENCHMARK_AT_OR_BELOW_PERCENT) return "low";
  return "mid";
}

function formatCell(cell: HoursBenchmarkCell): string {
  const tone = cellTone(cell.completionPercent);
  if (tone === "empty" || tone === "met") return "";
  return `${cell.completionPercent}${cell.excuseApplied ? "*" : ""}`;
}

function HeatmapCell({ cell }: { cell: HoursBenchmarkCell }) {
  const tone = cellTone(cell.completionPercent);
  const label = formatCell(cell);
  if (tone === "empty" || tone === "met") {
    return <TableCell className="p-1" />;
  }

  return (
    <TableCell className="p-1">
      <div
        className={cn(
          "mx-auto flex size-8 items-center justify-center rounded-sm text-center text-xs tabular-nums",
          tone === "low" && "bg-destructive/15 font-semibold text-destructive",
          tone === "mid" && "bg-amber-500/15 font-medium text-amber-800 dark:text-amber-200",
        )}
        title={label}
      >
        {label}
      </div>
    </TableCell>
  );
}

type HoursBenchmarkReportViewProps = {
  report: HoursBenchmarkReport;
};

export function HoursBenchmarkReportView({ report }: HoursBenchmarkReportViewProps) {
  const { summary, weekNumbers } = report;
  const hasScoredWeeks = report.scoredWeeks != null;
  const subtitle = [
    report.weekRangeLabel,
    report.dateRangeLabel || null,
    `Prepared ${report.preparedAtLabel}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const kpiCards = [
    {
      title: `Students at ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower at least once`,
      value: summary.studentsAtOrBelow50AtLeastOnce,
      hint: "Front desk or study session",
    },
    {
      title: `Times a student logged ${HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower`,
      value: summary.atOrBelow50Events,
      hint: "One per student, week and area",
    },
    {
      title: "Times at 0%",
      value: summary.zeroPercentEvents,
      hint: "No minutes logged that week",
    },
    {
      title: `Students who missed ${HOURS_BENCHMARK_MET_PERCENT}% at least once`,
      value: summary.studentsMissed80AtLeastOnce,
      hint: "Including 51–79%",
    },
  ];

  const maxTlEvents = Math.max(0, ...report.byTeamLeader.map((row) => row.atOrBelow50Events));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-destructive text-xs font-semibold tracking-wide uppercase">
            Confidential student information
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Hours Benchmark</h1>
          <p className="text-muted-foreground text-sm">
            Front desk and study session hours · {subtitle}
          </p>
        </div>
        <HoursBenchmarkExportButton available={hasScoredWeeks} />
      </div>

      {!hasScoredWeeks ? (
        <Card className="gap-0 bg-muted/20 py-0">
          <CardContent className="text-muted-foreground px-4 py-8 text-sm">
            No scored weeks yet. The report covers campus week 2 through the week before the current
            campus week
            {report.currentCampusWeek > 0 ? ` (current week ${report.currentCampusWeek})` : ""}.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => (
              <Card key={card.title} className="gap-0 bg-muted/20 py-0">
                <CardHeader className="gap-1 px-4 pt-4 pb-2">
                  <CardTitle className="text-muted-foreground text-sm font-medium">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 px-4 pb-4">
                  <div className="text-3xl font-semibold tabular-nums">{card.value}</div>
                  <p className="text-muted-foreground text-xs">{card.hint}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card className="gap-0 py-0">
            <CardHeader className="gap-1 px-4 pt-4 pb-3">
              <CardTitle className="text-base font-semibold">
                Students at {HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower, week by week
              </CardTitle>
              <CardDescription>
                Sorted by how many weeks they were at {HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or
                lower. Red = {HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower · Amber = 51–
                {HOURS_BENCHMARK_MET_PERCENT - 1}% · blank = met {HOURS_BENCHMARK_MET_PERCENT}% · * =
                excused minutes counted toward completion · (So.) = sophomore.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="align-bottom">
                        Student / team leader
                      </TableHead>
                      <TableHead colSpan={weekNumbers.length} className="text-center">
                        Front desk
                      </TableHead>
                      <TableHead colSpan={weekNumbers.length} className="text-center">
                        Study session
                      </TableHead>
                      <TableHead rowSpan={2} className="align-bottom text-center">
                        ≤50%
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      {weekNumbers.map((week) => (
                        <TableHead key={`fd-h-${week}`} className="p-1 text-center">
                          W{week}
                        </TableHead>
                      ))}
                      {weekNumbers.map((week) => (
                        <TableHead key={`ss-h-${week}`} className="p-1 text-center">
                          W{week}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.heatmapScholars.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3 + weekNumbers.length * 2}
                          className="text-muted-foreground"
                        >
                          No scholars were at {HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower in the
                          scored weeks.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.heatmapScholars.map((scholar) => (
                        <TableRow key={scholar.scholarId}>
                          <TableCell>
                            <div className="font-medium">
                              {scholar.scholarName}
                              {scholar.isSophomore ? " (So.)" : ""}
                            </div>
                            <div className="text-muted-foreground text-xs">{scholar.teamLeader}</div>
                          </TableCell>
                          {scholar.frontDeskByWeek.map((cell) => (
                            <HeatmapCell
                              key={`fd-${scholar.scholarId}-${cell.weekNum}`}
                              cell={cell}
                            />
                          ))}
                          {scholar.studySessionByWeek.map((cell) => (
                            <HeatmapCell
                              key={`ss-${scholar.scholarId}-${cell.weekNum}`}
                              cell={cell}
                            />
                          ))}
                          <TableCell className="text-center font-semibold tabular-nums">
                            {scholar.atOrBelow50Count}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="gap-1 px-4 pt-4 pb-3">
              <CardTitle className="text-base font-semibold">
                {HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}%-or-lower weeks by team leader
              </CardTitle>
              <CardDescription>
                Counts every student, week and area at {HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or
                lower, grouped by the scholar&apos;s current team leader. Bars are relative to the
                highest team-leader total.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {report.byTeamLeader.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No team-leader rollup for the scored weeks.
                </p>
              ) : (
                <div className="space-y-3">
                  {report.byTeamLeader.map((row) => {
                    const pct =
                      maxTlEvents > 0
                        ? Math.round((row.atOrBelow50Events / maxTlEvents) * 100)
                        : 0;
                    return (
                      <div key={row.teamLeader} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{row.teamLeader}</div>
                            <div className="text-muted-foreground text-xs">
                              {row.studentCount} student{row.studentCount === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {row.atOrBelow50Events}
                          </div>
                        </div>
                        <Progress
                          value={pct}
                          className="h-2.5 bg-muted [&_[data-slot=progress-indicator]]:bg-destructive"
                          aria-label={`${row.teamLeader} ${row.atOrBelow50Events} weeks at or below 50 percent`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="gap-1 px-4 pt-4 pb-3">
              <CardTitle className="text-base font-semibold">
                Every week at {HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower
              </CardTitle>
              <CardDescription>Lowest completion first, then by week.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Team leader</TableHead>
                      <TableHead className="text-right">Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.lowEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground">
                          No weeks at {HOURS_BENCHMARK_AT_OR_BELOW_PERCENT}% or lower.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.lowEvents.map((event, index) => (
                        <TableRow
                          key={`${event.weekNum}-${event.area}-${event.scholarName}-${index}`}
                        >
                          <TableCell>{event.weekDateLabel}</TableCell>
                          <TableCell>{event.areaLabel}</TableCell>
                          <TableCell className="font-medium">{event.scholarName}</TableCell>
                          <TableCell>{event.classYear}</TableCell>
                          <TableCell>{event.teamLeader}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {event.completionPercent}%{event.excuseApplied ? "*" : ""}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
