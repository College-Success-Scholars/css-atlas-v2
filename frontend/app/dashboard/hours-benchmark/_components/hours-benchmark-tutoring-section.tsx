"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { HoursBenchmarkTutoringGroup } from "../types";

type TutoringTabId = "scholar" | "tutor" | "day";

type HoursBenchmarkTutoringSectionProps = {
  weekRangeLabel: string;
  byScholar: HoursBenchmarkTutoringGroup[];
  byTutor: HoursBenchmarkTutoringGroup[];
  byDay: HoursBenchmarkTutoringGroup[];
};

const TABS: Array<{ id: TutoringTabId; label: string }> = [
  { id: "scholar", label: "By scholar" },
  { id: "tutor", label: "By tutor" },
  { id: "day", label: "By day" },
];

function TutoringGroupList({
  groups,
  mode,
}: {
  groups: HoursBenchmarkTutoringGroup[];
  mode: TutoringTabId;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No tutoring sessions were recorded for the scored weeks.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "gap-x-7",
        mode === "day" ? "columns-1 sm:columns-2" : "space-y-4",
      )}
    >
      {groups.map((group) => (
        <div
          key={group.key}
          className={cn("mb-3.5 break-inside-avoid", mode !== "day" && "mb-0")}
        >
          <div
            className={cn(
              "mb-1 border-b border-border/60 pb-0.5 text-[11px] font-extrabold tracking-[0.06em] uppercase",
              mode === "day" ? "text-[#ec3013]" : "text-foreground",
            )}
          >
            {group.title}
          </div>
          <ul className="space-y-0.5">
            {group.sessions.map((session) => {
              const leading =
                mode === "scholar"
                  ? session.tutorName
                  : mode === "tutor"
                    ? session.scholarName
                    : session.tutorName;
              const trailing =
                mode === "day"
                  ? session.scholarName
                  : `${session.dayOfWeek} · ${session.dateLabel}`;
              const leadingBold = mode === "tutor";
              const trailingBold = mode === "day";

              return (
                <li
                  key={session.id}
                  className="flex justify-between gap-2 py-0.5 text-[11.5px] leading-snug"
                >
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      leadingBold ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {leading}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-right",
                      trailingBold ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {trailing}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function HoursBenchmarkTutoringSection({
  weekRangeLabel,
  byScholar,
  byTutor,
  byDay,
}: HoursBenchmarkTutoringSectionProps) {
  const [tab, setTab] = useState<TutoringTabId>("day");

  const groups = useMemo(() => {
    if (tab === "scholar") return byScholar;
    if (tab === "tutor") return byTutor;
    return byDay;
  }, [tab, byScholar, byTutor, byDay]);

  const description =
    tab === "day"
      ? `Weekday frequency across ${weekRangeLabel}, matching the weekly memo tutoring printout.`
      : tab === "scholar"
        ? `Sessions grouped by scholar name (${weekRangeLabel}).`
        : `Sessions grouped by tutor name (${weekRangeLabel}).`;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-1 px-4 pt-4 pb-3">
        <CardTitle className="text-base font-semibold">Tutoring</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <div className="flex items-center gap-1.5 rounded-md bg-muted/40 p-1">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "cursor-pointer rounded-sm px-3 py-1.5 text-sm transition-colors",
                tab === entry.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <TutoringGroupList groups={groups} mode={tab} />
      </CardContent>
    </Card>
  );
}
