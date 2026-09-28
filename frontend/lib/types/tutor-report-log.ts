/** Types mirroring backend/src/models/tutor-report-log.model.ts */

export interface TutorReportLogRow {
  id: number;
  created_at: string | null;
  date: string | null;
  tutor_name: string;
  scholar_uid: string | null;
  end_time: string;
  start_time: string;
  courses: string[];
}

/** `GET /api/tutor-reports/week/:weekNum` row: `scholar_name` is EMPTY SESSION for `n/a` / `111111111`. */
export interface TutorReportWeekRow extends TutorReportLogRow {
  scholar_name: string;
  day_of_week: string;
}

/** Display-ready row with scholar name resolved. */
export interface MemoTutorReportRow {
  id: number;
  scholarId: string | null;
  scholarName: string;
  tutorName: string;
  courses: string[];
  startTime: string;
  endTime: string;
  dayOfWeek: string;
}
