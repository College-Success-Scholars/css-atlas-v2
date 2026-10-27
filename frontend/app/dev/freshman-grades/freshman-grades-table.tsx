"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FreshmanGradeHoursWeek = {
  loggedMinutes: number;
  excuseMinutes: number;
  effectiveMinutes: number;
  requiredMinutes: number | null;
  rawPct: number | null;
  cappedPct: number | null;
};

export type FreshmanGradeWeekBreakdown = {
  weekNum: number;
  fd: FreshmanGradeHoursWeek;
  ss: FreshmanGradeHoursWeek;
  wahfStatus: "on-time" | "late" | "missing";
  wahfPct: number;
};

export type FreshmanGradeRow = {
  scholarId: string;
  scholarName: string;
  mentor: string;
  cohort: number;
  fdPct: number | null;
  ssPct: number | null;
  wahfPct: number | null;
  weeks: FreshmanGradeWeekBreakdown[];
};

export type FreshmanGradesReport = {
  throughWeek: number;
  scoredWeeks: { fromWeek: number; throughWeek: number } | null;
  weights: { fd: number; ss: number; wahf: number; outOfApp: number };
  scholars: FreshmanGradeRow[];
};

export type FreshmanGradesCsvMode = "overall" | "in-depth";

export type FreshmanGradesAudience = "freshman" | "sophomore";

const AUDIENCE_COPY: Record<
  FreshmanGradesAudience,
  { singular: string; plural: string; title: string; empty: string; csvPrefix: string }
> = {
  freshman: {
    singular: "freshman",
    plural: "freshmen",
    title: "Freshmen",
    empty: "No enrolled freshmen with required hours.",
    csvPrefix: "freshman-grades",
  },
  sophomore: {
    singular: "sophomore",
    plural: "sophomores",
    title: "Sophomores",
    empty: "No enrolled sophomores with required hours.",
    csvPrefix: "sophomore-grades",
  },
};

const OVERALL_CSV_HEADERS = ["Scholar", "UID", "Mentor", "FD %", "SS %", "WAHF %"] as const;

const IN_DEPTH_CSV_HEADERS = [
  "Scholar",
  "UID",
  "Mentor",
  "Week",
  "FD %",
  "FD recorded min",
  "FD excused min",
  "FD total min",
  "FD expected min",
  "SS %",
  "SS recorded min",
  "SS excused min",
  "SS total min",
  "SS expected min",
  "WAHF %",
] as const;

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Recorded, excused, recorded plus excused, and the minutes that week expected. */
function minuteCells(hours: FreshmanGradeHoursWeek): Array<number | null> {
  return [
    hours.loggedMinutes,
    hours.excuseMinutes,
    hours.effectiveMinutes,
    hours.requiredMinutes,
  ];
}

function scholarSummaryCells(scholar: FreshmanGradeRow): Array<string | number | null> {
  return [
    scholar.scholarName,
    scholar.scholarId,
    scholar.mentor,
    scholar.fdPct,
    scholar.ssPct,
    scholar.wahfPct,
  ];
}

const SCHOLAR_NAME_COLUMN = 0;
const SCHOLAR_UID_COLUMN = 1;
const MENTOR_COLUMN = 2;

/**
 * Leave a name or UID empty when it repeats the cell above it.
 * A mentor cell is blank only on a later row for the same scholar.
 * A different scholar always shows their mentor. Grade cells are always written.
 */
export function blankRepeatedCsvCells(
  rows: Array<Array<string | number | null>>,
): string[][] {
  let previous: string[] | null = null;
  return rows.map((row) => {
    const rendered = row.map((cell) => (cell == null ? "" : String(cell)));
    const sameScholar = previous != null && previous[SCHOLAR_UID_COLUMN] === rendered[SCHOLAR_UID_COLUMN];
    const display = rendered.map((text, index) => {
      if (text === "" || previous?.[index] !== text) return text;
      if (index === SCHOLAR_NAME_COLUMN || index === SCHOLAR_UID_COLUMN) return "";
      if (index === MENTOR_COLUMN && sameScholar) return "";
      return text;
    });
    previous = rendered;
    return display;
  });
}

/** First cell of the file: the campus week numbers the sheet covers, such as 2-5. */
export function freshmanGradesSheetParticulars(report: FreshmanGradesReport): string {
  const scored = report.scoredWeeks;
  if (scored == null) return "";
  if (scored.fromWeek === scored.throughWeek) return String(scored.fromWeek);
  return `${scored.fromWeek}-${scored.throughWeek}`;
}

function csvLines(
  particulars: string,
  headers: readonly string[],
  rows: Array<Array<string | number | null>>,
): string {
  const body = blankRepeatedCsvCells(rows).map((row) => row.map(csvCell).join(","));
  const lines = [headers.join(","), ...body];
  if (particulars !== "") lines.unshift(csvCell(particulars));
  return `\uFEFF${lines.join("\n")}\n`;
}

/** Overall matches the on-screen averages. In-depth is one row per scholar-week, with that week's capped percent and minutes. */
export function freshmanGradesCsv(
  report: FreshmanGradesReport,
  mode: FreshmanGradesCsvMode = "overall",
): string {
  if (mode === "overall") {
    return csvLines(
      freshmanGradesSheetParticulars(report),
      OVERALL_CSV_HEADERS,
      report.scholars.map((scholar) => scholarSummaryCells(scholar)),
    );
  }

  const rows: Array<Array<string | number | null>> = [];
  for (const scholar of report.scholars) {
    const weeks = scholar.weeks.length > 0 ? scholar.weeks : [null];
    for (const week of weeks) {
      rows.push([
        scholar.scholarName,
        scholar.scholarId,
        scholar.mentor,
        week?.weekNum ?? null,
        week ? formatPct(week.fd.cappedPct) : null,
        ...(week ? minuteCells(week.fd) : Array<null>(4).fill(null)),
        week ? formatPct(week.ss.cappedPct) : null,
        ...(week ? minuteCells(week.ss) : Array<null>(4).fill(null)),
        week ? formatPct(week.wahfPct) : null,
      ]);
    }
  }
  return csvLines(freshmanGradesSheetParticulars(report), IN_DEPTH_CSV_HEADERS, rows);
}

export function freshmanGradesCsvFilename(
  report: FreshmanGradesReport,
  mode: FreshmanGradesCsvMode = "overall",
  audience: FreshmanGradesAudience = "freshman",
): string {
  const weekPart =
    report.scoredWeeks != null
      ? `weeks-${report.scoredWeeks.fromWeek}-${report.scoredWeeks.throughWeek}`
      : `through-week-${report.throughWeek}`;
  return `${AUDIENCE_COPY[audience].csvPrefix}-${mode}-${weekPart}.csv`;
}

export function downloadFreshmanGradesCsv(
  report: FreshmanGradesReport,
  mode: FreshmanGradesCsvMode = "overall",
  audience: FreshmanGradesAudience = "freshman",
) {
  const blob = new Blob([freshmanGradesCsv(report, mode)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = freshmanGradesCsvFilename(report, mode, audience);
  link.click();
  URL.revokeObjectURL(url);
}

export function hoursDetail(hours: FreshmanGradeHoursWeek): string {
  if (hours.cappedPct == null || hours.requiredMinutes == null) return "Not scored";
  return `${hours.loggedMinutes} logged · ${hours.excuseMinutes} excuse · ${hours.effectiveMinutes} of ${hours.requiredMinutes} min`;
}

/** Lists the capped percents that were averaged, skipping unscored weeks. */
export function averageExplanation(
  label: string,
  cappedPcts: Array<number | null>,
): string {
  const scored = cappedPcts.filter((pct): pct is number => pct != null);
  if (scored.length === 0) return `${label} has no scored weeks.`;
  return `${label} averages ${scored.map((pct) => `${pct}%`).join(", ")}.`;
}

function wahfLabel(status: FreshmanGradeWeekBreakdown["wahfStatus"]): string {
  if (status === "missing") return "Missing";
  if (status === "late") return "Submitted late";
  return "Submitted on time";
}

function DutyStat({ title, hours }: { title: string; hours: FreshmanGradeHoursWeek }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</div>
      <div className="text-lg font-semibold tabular-nums">{formatPct(hours.cappedPct)}</div>
      {hours.rawPct != null && hours.cappedPct != null && hours.rawPct > hours.cappedPct ? (
        <div className="text-xs">Capped from {hours.rawPct}%</div>
      ) : null}
      <p className="text-muted-foreground text-xs">{hoursDetail(hours)}</p>
    </div>
  );
}

function SummaryTile({
  label,
  pct,
  detail,
}: {
  label: string;
  pct: number | null;
  detail: string;
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{formatPct(pct)}</div>
      <p className="text-muted-foreground text-xs">{detail}</p>
    </div>
  );
}

export function FreshmanGradesTable({
  report,
  audience = "freshman",
}: {
  report: FreshmanGradesReport;
  audience?: FreshmanGradesAudience;
}) {
  const { weights } = report;
  const copy = AUDIENCE_COPY[audience];
  const [selected, setSelected] = useState<FreshmanGradeRow | null>(null);
  const [csvMode, setCsvMode] = useState<FreshmanGradesCsvMode>("overall");
  const csvModeId = `${audience}-grades-csv-mode`;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>
            {report.scholars.length} {report.scholars.length === 1 ? copy.singular : copy.plural}.
            Select a name to see each week.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <label htmlFor={csvModeId} className="text-muted-foreground text-xs">
                Printout
              </label>
              <select
                id={csvModeId}
                value={csvMode}
                onChange={(event) => setCsvMode(event.target.value as FreshmanGradesCsvMode)}
                className="border-input bg-background h-8 rounded-md border px-2 text-sm"
              >
                <option value="overall">Overall</option>
                <option value="in-depth">In-depth</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadFreshmanGradesCsv(report, csvMode, audience)}
              >
                Download CSV
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scholar</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>Mentor</TableHead>
                <TableHead>FD ({weights.fd}%)</TableHead>
                <TableHead>SS ({weights.ss}%)</TableHead>
                <TableHead>WAHF ({weights.wahf}%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.scholars.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>{copy.empty}</TableCell>
                </TableRow>
              ) : (
                report.scholars.map((row) => (
                  <TableRow key={row.scholarId}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-primary text-left font-medium hover:underline"
                        onClick={() => setSelected(row)}
                      >
                        {row.scholarName}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.scholarId}</TableCell>
                    <TableCell>{row.mentor}</TableCell>
                    <TableCell>{formatPct(row.fdPct)}</TableCell>
                    <TableCell>{formatPct(row.ssPct)}</TableCell>
                    <TableCell>{formatPct(row.wahfPct)}</TableCell>
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell>Out of app</TableCell>
                <TableCell />
                <TableCell />
                <TableCell colSpan={3}>
                  {weights.outOfApp}% — not scored here
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={selected != null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.scholarName}</DialogTitle>
                <DialogDescription>
                  UID {selected.scholarId} · Mentor {selected.mentor}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryTile
                  label="Front desk"
                  pct={selected.fdPct}
                  detail={averageExplanation("Front desk", selected.weeks.map((week) => week.fd.cappedPct))}
                />
                <SummaryTile
                  label="Study session"
                  pct={selected.ssPct}
                  detail={averageExplanation("Study session", selected.weeks.map((week) => week.ss.cappedPct))}
                />
                <SummaryTile
                  label="WAHF"
                  pct={selected.wahfPct}
                  detail={averageExplanation("WAHF", selected.weeks.map((week) => week.wahfPct))}
                />
              </div>
              <div className="space-y-3">
                {selected.weeks.map((week) => (
                  <section key={week.weekNum} className="rounded-lg border">
                    <div className="bg-muted/50 border-b px-3 py-2 text-sm font-medium">
                      Week {week.weekNum}
                    </div>
                    <div className="grid gap-4 p-3 sm:grid-cols-3">
                      <DutyStat title="Front desk" hours={week.fd} />
                      <DutyStat title="Study session" hours={week.ss} />
                      <div className="space-y-1">
                        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">WAHF</div>
                        <div className="text-lg font-semibold tabular-nums">{week.wahfPct}%</div>
                        <Badge
                          variant={
                            week.wahfStatus === "missing"
                              ? "warning"
                              : week.wahfStatus === "late"
                                ? "info"
                                : "success"
                          }
                        >
                          {wahfLabel(week.wahfStatus)}
                        </Badge>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
