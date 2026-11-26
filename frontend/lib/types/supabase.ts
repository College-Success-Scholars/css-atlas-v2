/** API response shapes for backend routes (not Postgres table mirrors). */
import type { MenteeRow } from "@css-atlas/shared/contracts/mentees"

import type { WahfFormLogRow, McfFormLogRow, WplFormLogRow } from "@css-atlas/shared/contracts/form-logs"
import type { AttendanceForUids } from "@css-atlas/shared/contracts/attendance"

export type WahfRow = WahfFormLogRow
export type McfRow = McfFormLogRow
export type WplRow = WplFormLogRow

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
