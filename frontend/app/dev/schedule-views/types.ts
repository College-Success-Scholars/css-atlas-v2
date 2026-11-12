/**
 * Shapes for the FD/SS schedule board
 * (`GET` / `PUT /api/dev/schedule-board`).
 */

export type SessionKind = "front_desk" | "study_session";

export type ScheduleViewMode = "week" | "day";

export type StandingShift = {
  id: string;
  kind: SessionKind;
  /** 0=Sun … 6=Sat (CSSAtlas / Eastern convention). */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type BoardScholar = {
  uid: string;
  name: string;
  cohort: number | null;
  classYearLabel: "Freshman" | "Sophomore" | null;
  fd_required: number;
  ss_required: number;
  shifts: StandingShift[];
};

export type ScheduleBoardResponse = {
  scholars: BoardScholar[];
};

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
