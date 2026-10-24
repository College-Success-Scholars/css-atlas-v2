/** Types mirroring backend/src/models/form-log.model.ts */

export interface McfFormLogRow {
  id: string;
  created_at: string;
  mentor_name: string | null;
  mentor_uid: string | null;
  mentee_name: string | null;
  mentee_uid: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  met_in_person: string | null;
  reason_no_meeting: string | null;
  tasks_completed: string | null;
  meeting_notes: string | null;
  tutoring_status: string | null;
  needs_tutor: string | null;
  support_rank: string | null;
  submitted_by_email: string | null;
}

export interface WahfFormLogRow {
  id: string;
  created_at: string;
  scholar_uid: string | null;
  scholar_name: string | null;
  team_leader_contact: string | null;
  tl_meeting_in_person: string | null;
  course_changes: string | null;
  /** e.g. { "CMSC420": { "Exam": "90%" }, "ECON200": { "Exam": "95%" } } */
  assignment_grades: Record<string, Record<string, string>> | null;
  missed_classes: string | null;
  missed_assignments: string | null;
  submitted_by_email: string | null;
  course_change_details: string | null;
}

export interface WplFormLogRow {
  id: string;
  created_at: string;
  full_name: string | null;
  scholar_uid: string | null;
  hours_worked: number | null;
  projects: unknown[] | null;
  met_with_all: string | null;
  explanation: string | null;
  submitted_by_email: string | null;
}

export type FormLogRowWithLate<T> = T & { isLate: boolean };

export type ActivityFormType = "WAHF" | "WPL" | "MCF";

export type RecentFormSubmission = {
  id: string;
  formType: ActivityFormType;
  submittedAt: string | null;
  assignment_grades?: unknown;
  course_changes?: string | null;
  missed_classes?: string | null;
  missed_assignments?: string | null;
  course_change_details?: string | null;
  hours_worked?: number | null;
  projects?: unknown;
  met_with_all?: string | null;
  explanation?: string | null;
  mentee_name?: string | null;
  meeting_date?: string | null;
  meeting_time?: string | null;
  met_in_person?: string | null;
  tasks_completed?: string | null;
  meeting_notes?: string | null;
  needs_tutor?: string | null;
};

export type GradeEntry = {
  scholarName: string;
  /** WAHF submitter UID; absent on legacy/mock rows. */
  scholarId?: string | null;
  /** True when mentor_mentee has at least one row for the submitter. */
  isMentee?: boolean;
  course: string;
  assessment: string;
  grade: string;
  percent: number;
};

export type GradeBreakdown = {
  high: GradeEntry[];
  mid: GradeEntry[];
  low: GradeEntry[];
};

export type TeamLeaderFormStatsRow = {
  scholarId: string;
  name: string;
  programRole: string | null;
  mcfCompleted: number;
  mcfRequired: number;
  mcfLate: boolean;
  mcfPct: number;
  mcfLatestAt: string;
  wahfCompleted: number;
  wahfRequired: number;
  wahfLate: boolean;
  wahfPct: number;
  wahfLatestAt: string;
  wplCompleted: number;
  wplRequired: number;
  wplLate: boolean;
  wplPct: number;
  wplLatestAt: string;
};
