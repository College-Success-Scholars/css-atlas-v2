"use client";

import { useMemo, useState } from "react";
import { getDoubleEntries, type DoubleEntry } from "@/lib/types/session-log";
import type { ScholarWithCompletedSession } from "@css-atlas/shared/contracts/session-logs";
import { formatDuration, formatDate } from "@/lib/format/time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DoubleEntryCheckerProps {
  completedStudy: readonly ScholarWithCompletedSession[];
  completedFrontDesk: readonly ScholarWithCompletedSession[];
  /** Default tolerance in minutes (default: 5). User can adjust in UI. */
  defaultToleranceMinutes?: number;
}

export function DoubleEntryChecker({
  completedStudy,
  completedFrontDesk,
  defaultToleranceMinutes = 5,
}: DoubleEntryCheckerProps) {
  const [toleranceMinutes, setToleranceMinutes] = useState(
    defaultToleranceMinutes
  );

  const doubleEntries = useMemo(
    () =>
      getDoubleEntries(completedStudy, completedFrontDesk, {
        toleranceMinutes,
      }),
    [completedStudy, completedFrontDesk, toleranceMinutes]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Double entries this week</CardTitle>
        <CardDescription>
          Scholars signed into both front desk and study session at the same
          time for longer than the tolerance below.
        </CardDescription>
        <div className="flex items-center gap-2 pt-2">
          <Label htmlFor="tolerance-min" className="text-sm font-medium">
            Min. overlap (minutes):
          </Label>
          <Input
            id="tolerance-min"
            type="number"
            min={1}
            max={120}
            value={toleranceMinutes}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isNaN(v)) setToleranceMinutes(Math.max(1, Math.min(120, v)));
            }}
            className="w-20"
          />
        </div>
      </CardHeader>
      <CardContent>
        {doubleEntries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No double entries found for overlap ≥ {toleranceMinutes} minute
            {toleranceMinutes !== 1 ? "s" : ""}.
          </p>
        ) : (
          <ul className="space-y-4">
            {doubleEntries.map((entry, idx) => (
              <DoubleEntryRow key={`${entry.scholarId}-${idx}`} entry={entry} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DoubleEntryRow({ entry }: { entry: DoubleEntry }) {
  return (
    <li className="rounded-md border border-warning/50 bg-warning-muted/50 p-3 text-sm">
      <div className="font-medium">
        {entry.scholarName ?? entry.scholarId}
        <span className="text-muted-foreground font-normal ml-1">
          (ID {entry.scholarId})
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Overlap: {formatDuration(entry.overlapMs)}</Badge>
        <span className="text-muted-foreground text-xs">
          {formatDate(entry.overlapStart)} – {formatDate(entry.overlapEnd)}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-muted-foreground text-xs">
        <div>
          <span className="font-medium text-foreground">Study:</span>{" "}
          {formatDate(entry.studySession.entryAt)} –{" "}
          {formatDate(entry.studySession.exitAt)}
        </div>
        <div>
          <span className="font-medium text-foreground">Front desk:</span>{" "}
          {formatDate(entry.frontDeskSession.entryAt)} –{" "}
          {formatDate(entry.frontDeskSession.exitAt)}
        </div>
      </div>
    </li>
  );
}
