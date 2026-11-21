/** Display-ready row with scholar name resolved. */
export interface MemoTutorReportRow {
  id: number;
  scholarId: string | null;
  scholarName: string;
  /** True when mentor_mentee has at least one row for this scholar. */
  isMentee?: boolean;
  tutorName: string;
  courses: string[];
  startTime: string;
  endTime: string;
  dayOfWeek: string;
}
