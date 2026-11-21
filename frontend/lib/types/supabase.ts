/** API response shapes for backend routes (not Postgres table mirrors). */
import type { MenteeRow } from "@css-atlas/shared/contracts/mentees"

export type ShiftComplianceSession = {
  entryAt: string
  exitAt: string
  insideMinutes: number
  outsideMinutes: number
}

export type ShiftCompliancePerDate = {
  date: string
  scheduledStart: string | null
  scheduledEnd: string | null
  insideMinutes: number
  outsideMinutes: number
  noShow: boolean
  unscheduled: boolean
  sessions: ShiftComplianceSession[]
}

export type ShiftComplianceByKind = {
  insideMinutes: number
  outsideMinutes: number
  noShowCount: number
  dates: ShiftCompliancePerDate[]
}

/** Response shape when calling break-week helpers (backend maps RPC / semester APIs). */
export type WeekBreakRpcRow = {
  break_days: number | null
  is_break_week: boolean | null
  breaks: unknown[] | null
}

/** Response row from daily-activity APIs (`/api/daily-activity/…`). */
export type ActivityRow = {
    scholar_uid: string
    activity_date: string
    week_num: number
    log_source: "front_desk_logs" | "study_session_logs"
    duration_minutes: number
}

import type { WahfFormLogRow, McfFormLogRow, WplFormLogRow } from "@css-atlas/shared/contracts/form-logs"
import type { AttendanceForUids } from "@css-atlas/shared/contracts/attendance"

export type WahfRow = WahfFormLogRow
export type McfRow = McfFormLogRow
export type WplRow = WplFormLogRow

/** Response row from tutor-report APIs (mirrors backend TutorReportLogRow). */
export type TutoringRow = {
  id: number
  created_at: string
  date: string | null
  tutor_name: string
  scholar_uid: string
  start_time: string
  end_time: string
  courses: string[]
}

/** Traffic kiosk / analytics row from traffic APIs. */
export type TrafficRow = {
  id: number
  created_at: string
  uid: string | null
  traffic_type: string | null
  duration_min: number | null
}

/**
 * Profile fields returned by auth/profile APIs for dashboard pages.
 * Mentee assignments live on `user_roster` / GET /api/auth/mentees — not on profiles.
 */
export type ProfileRow = {
  id: string
  created_at: string
  first_name: string | null
  last_name: string | null
  student_id: string | null
  cohort: number | null
  status: string | null
  app_role: string | null
  program_role: string | null
  fd_required: number | null
  ss_required: number | null
  mentee_count: number | null
  phone_number: string | null
  full_name: string | null
  emails: string[] | null
  majors: string[] | null
  minors: string[] | null
  teams: string[] | null
}

export interface PersonalClientProps {
  profile: ProfileRow
  wahf: readonly WahfRow[]
  mcf: readonly McfRow[]
  wpl: readonly WplRow[]
  mentees: ReadonlyArray<MenteeRow>
  /** Campus week from `dateToCampusWeek`; null before Fall start. */
  currentCampusWeek: number | null
}
