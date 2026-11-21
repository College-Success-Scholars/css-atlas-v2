"use client";

import { useState } from "react";
import { dateToCampusWeek, campusWeekToDateRange } from "@/lib/format/time";
import { formDeadline, isLate } from "@css-atlas/shared/form-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ET = "America/New_York";

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-US", { timeZone: ET, dateStyle: "short", timeStyle: "short" });
}

export function FormLogsTestClient() {
  const [weekInput, setWeekInput] = useState("10");
  const [deadlines, setDeadlines] = useState<{
    whaf: string | null;
    mcfWpl: string | null;
    range: string | null;
  } | null>(null);

  const [submitInput, setSubmitInput] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  });
  const [lateResult, setLateResult] = useState<{
    week: number | null;
    whaf: boolean;
    mcf: boolean;
    wpl: boolean;
  } | null>(null);

  function handleWeekSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(weekInput, 10);
    if (Number.isNaN(n) || n < 1) {
      setDeadlines(null);
      return;
    }
    const range = campusWeekToDateRange(n);
    const whaf = formDeadline("WAHF", n);
    const mcfWpl = formDeadline("WPL", n);
    setDeadlines({
      range: range
        ? `${range.startDate.toLocaleDateString("en-US", { timeZone: ET })} – ${range.endDate.toLocaleDateString("en-US", { timeZone: ET })} (ET)`
        : null,
      whaf: whaf ? formatDateTime(whaf) : null,
      mcfWpl: mcfWpl ? formatDateTime(mcfWpl) : null,
    });
  }

  function handleLateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = new Date(submitInput);
    if (Number.isNaN(d.getTime())) {
      setLateResult(null);
      return;
    }
    const week = dateToCampusWeek(d);
    setLateResult({
      week: week ?? null,
      whaf: isLate("WAHF", d),
      mcf: isLate("MCF", d),
      wpl: isLate("WPL", d),
    });
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Week → Deadlines</CardTitle>
          <CardDescription>
            Campus week number. Shows WHAF (Thu 23:59 ET) and MCF/WPL (Fri 17:00 ET) deadlines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleWeekSubmit} className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="week-input" className="sr-only">
                Week number
              </Label>
              <Input
                id="week-input"
                type="number"
                min={1}
                value={weekInput}
                onChange={(e) => setWeekInput(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            <Button type="submit">Go</Button>
          </form>
          {deadlines && (
            <div className="space-y-2 text-sm">
              {deadlines.range && (
                <p className="text-muted-foreground">Week range: {deadlines.range}</p>
              )}
              <p>
                <strong>WHAF deadline:</strong>{" "}
                {deadlines.whaf ?? <span className="text-muted-foreground">—</span>}
              </p>
              <p>
                <strong>MCF / WPL deadline:</strong>{" "}
                {deadlines.mcfWpl ?? <span className="text-muted-foreground">—</span>}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission time → Late?</CardTitle>
          <CardDescription>
            Enter a submission datetime (local). Uses campus week of that date to check deadlines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLateSubmit} className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="submit-input" className="sr-only">
                Date and time
              </Label>
              <Input
                id="submit-input"
                type="datetime-local"
                value={submitInput}
                onChange={(e) => setSubmitInput(e.target.value)}
              />
            </div>
            <Button type="submit">Check</Button>
          </form>
          {lateResult !== null && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Campus week:</span>{" "}
                {lateResult.week != null ? (
                  <Badge variant="secondary">{lateResult.week}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
              <p>
                <strong>WHAF:</strong>{" "}
                <Badge variant={lateResult.whaf ? "destructive" : "secondary"}>
                  {lateResult.whaf ? "Late" : "On time"}
                </Badge>
              </p>
              <p>
                <strong>MCF:</strong>{" "}
                <Badge variant={lateResult.mcf ? "destructive" : "secondary"}>
                  {lateResult.mcf ? "Late" : "On time"}
                </Badge>
              </p>
              <p>
                <strong>WPL:</strong>{" "}
                <Badge variant={lateResult.wpl ? "destructive" : "secondary"}>
                  {lateResult.wpl ? "Late" : "On time"}
                </Badge>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
