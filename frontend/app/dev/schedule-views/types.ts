/**
 * Shapes for the FD/SS schedule board
 * (`GET` / `PUT /api/dev/schedule-board`).
 */

import type { ScheduleBoardScholar, ScheduleBoardShift } from "@css-atlas/shared/contracts/dev";

export type SessionKind = ScheduleBoardShift["kind"];

export type ScheduleViewMode = "week" | "day";

/** `dayOfWeek` is 0=Sun … 6=Sat (CSSAtlas / Eastern convention). */
export type StandingShift = ScheduleBoardShift;

export type BoardScholar = ScheduleBoardScholar;

export type DayShiftBlock = StandingShift & {
  scholarUid: string;
  scholarName: string;
  date: string;
  durationHours: number;
};

export type ScheduleBoardActions = {
  onAddShift?: (args: {
    scholarUid: string;
    date: string;
    kind: SessionKind;
  }) => void;
  onEditShift?: (block: DayShiftBlock) => void;
  onPublish?: () => void;
};
