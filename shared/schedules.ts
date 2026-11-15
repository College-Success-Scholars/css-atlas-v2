export type StandingShiftInput = {
  kind: "front_desk" | "study_session";
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type ScheduleShiftDto = StandingShiftInput & {
  id: string;
  effectiveFrom: string;
  effectiveUntil: string;
};

export type ScheduleSemesterDto = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
};

export type ScheduleBoardScholarDto = {
  uid: string;
  name: string;
  cohort: number | null;
  classYearLabel: "Freshman" | "Sophomore" | null;
  programRole: string | null;
  status: string | null;
  fd_required: number;
  ss_required: number;
  revision: number;
  shifts: ScheduleShiftDto[];
};

export type ScheduleBoardResponse = {
  semester: ScheduleSemesterDto | null;
  currentWeekStart: string;
  weekStart: string;
  scholars: ScheduleBoardScholarDto[];
};

export type ScholarScheduleResponse = Omit<ScheduleBoardResponse, "scholars"> & {
  scholar: ScheduleBoardScholarDto;
};
