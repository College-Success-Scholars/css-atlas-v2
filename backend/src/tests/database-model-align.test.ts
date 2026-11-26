/**
 * Compile-time guard: table-backed models stay aligned with generated Database types.
 * After `npm run db:types -w @css-atlas/backend`, fix models if these assertions fail.
 */
import { describe, expectTypeOf, it } from "vitest";
import type { TutorReportLogRow } from "../models/tutor-report-log.model.js";
import type { SessionLogRow } from "../models/session-log.model.js";
import type { DevTestProfile } from "@css-atlas/shared/contracts/dev";
import type { ProfilesRow, RosterRow } from "../models/user.model.js";
import type { ScholarWeekExcuseRow } from "../models/attendance-week.model.js";
import type { ActiveSemesterRow } from "@css-atlas/shared/contracts/auth";
import type { MenteeRow } from "@css-atlas/shared/contracts/mentees";
import type { McfFormLogRow, WahfFormLogRow, WplFormLogRow } from "@css-atlas/shared/contracts/form-logs";
import type { Database } from "../supabase/database.types.js";

type ProfilesDbRow = Database["public"]["Tables"]["profiles"]["Row"];
type FrontDeskLogDbRow = Database["public"]["Tables"]["front_desk_logs"]["Row"];
type StudySessionLogDbRow = Database["public"]["Tables"]["study_session_logs"]["Row"];
type UserRosterDbRow = Database["public"]["Tables"]["user_roster"]["Row"];
type DevTestProfileDbRow = Database["public"]["Tables"]["dev_test_profiles"]["Row"];
type TutorReportDbRow = Database["public"]["Tables"]["tutor_report_logs"]["Row"];
type SemesterDbRow = Database["public"]["Tables"]["semesters"]["Row"];
type McfFormLogDbRow = Database["public"]["Tables"]["mcf_form_logs"]["Row"];
type WahfFormLogDbRow = Database["public"]["Tables"]["whaf_form_logs"]["Row"];
type WplFormLogDbRow = Database["public"]["Tables"]["wpl_form_logs"]["Row"];
type Writable<T> = { -readonly [K in keyof T]: T[K] };
type ScholarWeekExcuseDbRow = Database["public"]["Tables"]["scholar_week_excuses"]["Row"];

describe("Database ↔ model alignment", () => {
  it("profiles.student_id matches Postgres text (string | null)", () => {
    expectTypeOf<ProfilesRow["student_id"]>().toEqualTypeOf<ProfilesDbRow["student_id"]>();
  });

  it("TutorReportLogRow shared columns match tutor_report_logs Row (including date)", () => {
    expectTypeOf<TutorReportLogRow["date"]>().toEqualTypeOf<TutorReportDbRow["date"]>();
    expectTypeOf<TutorReportLogRow["id"]>().toEqualTypeOf<TutorReportDbRow["id"]>();
    expectTypeOf<TutorReportLogRow["scholar_uid"]>().toEqualTypeOf<TutorReportDbRow["scholar_uid"]>();
    expectTypeOf<TutorReportLogRow["tutor_name"]>().toEqualTypeOf<TutorReportDbRow["tutor_name"]>();
    expectTypeOf<TutorReportLogRow["start_time"]>().toEqualTypeOf<TutorReportDbRow["start_time"]>();
    expectTypeOf<TutorReportLogRow["end_time"]>().toEqualTypeOf<TutorReportDbRow["end_time"]>();
    // Contract arrays are readonly; the element type must still match the column.
    expectTypeOf<TutorReportLogRow["courses"]>().toEqualTypeOf<Readonly<TutorReportDbRow["courses"]>>();
    expectTypeOf<TutorReportLogRow["created_at"]>().toEqualTypeOf<TutorReportDbRow["created_at"]>();
  });

  it("SessionLogRow shared columns match front_desk_logs and study_session_logs Rows", () => {
    expectTypeOf<SessionLogRow["id"]>().toEqualTypeOf<FrontDeskLogDbRow["id"]>();
    expectTypeOf<SessionLogRow["scholar_uid"]>().toEqualTypeOf<FrontDeskLogDbRow["scholar_uid"]>();
    expectTypeOf<SessionLogRow["action_type"]>().toEqualTypeOf<FrontDeskLogDbRow["action_type"]>();
    expectTypeOf<SessionLogRow["id"]>().toEqualTypeOf<StudySessionLogDbRow["id"]>();
    expectTypeOf<SessionLogRow["scholar_uid"]>().toEqualTypeOf<StudySessionLogDbRow["scholar_uid"]>();
    expectTypeOf<SessionLogRow["action_type"]>().toEqualTypeOf<StudySessionLogDbRow["action_type"]>();
  });

  it("RosterRow columns match user_roster Row", () => {
    expectTypeOf<RosterRow["id"]>().toEqualTypeOf<UserRosterDbRow["id"]>();
    // The service drops rows with no uid, so the wire type is non-null.
    expectTypeOf<RosterRow["uid"]>().toEqualTypeOf<NonNullable<UserRosterDbRow["uid"]>>();
    expectTypeOf<RosterRow["created_at"]>().toEqualTypeOf<UserRosterDbRow["created_at"]>();
    expectTypeOf<RosterRow["first_name"]>().toEqualTypeOf<UserRosterDbRow["first_name"]>();
    expectTypeOf<RosterRow["last_name"]>().toEqualTypeOf<UserRosterDbRow["last_name"]>();
    expectTypeOf<RosterRow["phone_number"]>().toEqualTypeOf<UserRosterDbRow["phone_number"]>();
    expectTypeOf<RosterRow["email"]>().toEqualTypeOf<UserRosterDbRow["email"]>();
    expectTypeOf<RosterRow["cohort"]>().toEqualTypeOf<UserRosterDbRow["cohort"]>();
    expectTypeOf<RosterRow["status"]>().toEqualTypeOf<UserRosterDbRow["status"]>();
    expectTypeOf<RosterRow["app_role"]>().toEqualTypeOf<UserRosterDbRow["app_role"]>();
    expectTypeOf<RosterRow["program_role"]>().toEqualTypeOf<UserRosterDbRow["program_role"]>();
    expectTypeOf<RosterRow["fd_required"]>().toEqualTypeOf<UserRosterDbRow["fd_required"]>();
    expectTypeOf<RosterRow["ss_required"]>().toEqualTypeOf<UserRosterDbRow["ss_required"]>();
    expectTypeOf<RosterRow["mentee_count"]>().toEqualTypeOf<UserRosterDbRow["mentee_count"]>();
    expectTypeOf<RosterRow["invite_accepted_at"]>().toEqualTypeOf<UserRosterDbRow["invite_accepted_at"]>();
    expectTypeOf<RosterRow["invite_sent_at"]>().toEqualTypeOf<UserRosterDbRow["invite_sent_at"]>();
    // Contract arrays are readonly; the element type must still match the column.
    expectTypeOf<RosterRow["majors"]>().toEqualTypeOf<Readonly<UserRosterDbRow["majors"]>>();
    expectTypeOf<RosterRow["minors"]>().toEqualTypeOf<Readonly<UserRosterDbRow["minors"]>>();
    expectTypeOf<RosterRow["mentee_uids"]>().toEqualTypeOf<Readonly<UserRosterDbRow["mentee_uids"]>>();
    expectTypeOf<RosterRow["teams"]>().toEqualTypeOf<Readonly<UserRosterDbRow["teams"]>>();
  });

  it("DevTestProfile columns match dev_test_profiles Row", () => {
    expectTypeOf<DevTestProfile["id"]>().toEqualTypeOf<DevTestProfileDbRow["id"]>();
    expectTypeOf<DevTestProfile["label"]>().toEqualTypeOf<DevTestProfileDbRow["label"]>();
    expectTypeOf<DevTestProfile["roster_uid"]>().toEqualTypeOf<DevTestProfileDbRow["roster_uid"]>();
    expectTypeOf<NonNullable<DevTestProfile["program_role"]> | null>().toEqualTypeOf<DevTestProfileDbRow["program_role"]>();
    expectTypeOf<NonNullable<DevTestProfile["app_role"]> | null>().toEqualTypeOf<DevTestProfileDbRow["app_role"]>();
    expectTypeOf<NonNullable<DevTestProfile["first_name"]> | null>().toEqualTypeOf<DevTestProfileDbRow["first_name"]>();
    expectTypeOf<NonNullable<DevTestProfile["last_name"]> | null>().toEqualTypeOf<DevTestProfileDbRow["last_name"]>();
    expectTypeOf<NonNullable<DevTestProfile["cohort"]> | null>().toEqualTypeOf<DevTestProfileDbRow["cohort"]>();
    expectTypeOf<NonNullable<DevTestProfile["fd_required"]> | null>().toEqualTypeOf<DevTestProfileDbRow["fd_required"]>();
    expectTypeOf<NonNullable<DevTestProfile["ss_required"]> | null>().toEqualTypeOf<DevTestProfileDbRow["ss_required"]>();
  });

  it("ScholarWeekExcuseRow columns match scholar_week_excuses Row", () => {
    expectTypeOf<ScholarWeekExcuseRow["scholar_uid"]>().toEqualTypeOf<
      ScholarWeekExcuseDbRow["scholar_uid"]
    >();
    expectTypeOf<ScholarWeekExcuseRow["week_start"]>().toEqualTypeOf<
      ScholarWeekExcuseDbRow["week_start"]
    >();
    expectTypeOf<ScholarWeekExcuseRow["week_num"]>().toEqualTypeOf<
      ScholarWeekExcuseDbRow["week_num"]
    >();
    expectTypeOf<ScholarWeekExcuseRow["excuse_min"]>().toEqualTypeOf<
      ScholarWeekExcuseDbRow["excuse_min"]
    >();
    expectTypeOf<ScholarWeekExcuseRow["description"]>().toEqualTypeOf<
      ScholarWeekExcuseDbRow["description"]
    >();
    expectTypeOf<ScholarWeekExcuseRow["updated_by"]>().toEqualTypeOf<
      ScholarWeekExcuseDbRow["updated_by"]
    >();
    expectTypeOf<ScholarWeekExcuseRow["updated_at"]>().toEqualTypeOf<
      ScholarWeekExcuseDbRow["updated_at"]
    >();
  });

  it("ActiveSemesterRow columns match semesters Row", () => {
    expectTypeOf<ActiveSemesterRow["id"]>().toEqualTypeOf<SemesterDbRow["id"]>();
    expectTypeOf<ActiveSemesterRow["start_date"]>().toEqualTypeOf<SemesterDbRow["start_date"]>();
    expectTypeOf<ActiveSemesterRow["end_date"]>().toEqualTypeOf<SemesterDbRow["end_date"]>();
  });

  it("MenteeRow roster columns match user_roster Row", () => {
    expectTypeOf<MenteeRow["first_name"]>().toEqualTypeOf<UserRosterDbRow["first_name"]>();
    expectTypeOf<MenteeRow["last_name"]>().toEqualTypeOf<UserRosterDbRow["last_name"]>();
    expectTypeOf<MenteeRow["email"]>().toEqualTypeOf<UserRosterDbRow["email"]>();
    expectTypeOf<MenteeRow["fd_required"]>().toEqualTypeOf<UserRosterDbRow["fd_required"]>();
    expectTypeOf<MenteeRow["ss_required"]>().toEqualTypeOf<UserRosterDbRow["ss_required"]>();
  });

  it("form log rows match their tables (JSON columns excluded)", () => {
    expectTypeOf<Writable<McfFormLogRow>>().toEqualTypeOf<McfFormLogDbRow>();
    expectTypeOf<Writable<Omit<WahfFormLogRow, "assignment_grades">>>().toEqualTypeOf<
      Omit<WahfFormLogDbRow, "assignment_grades">
    >();
    expectTypeOf<Writable<Omit<WplFormLogRow, "projects">>>().toEqualTypeOf<Omit<WplFormLogDbRow, "projects">>();
  });

  it("profiles Insert omits generated full_name in ScholarProfileInsert pattern", () => {
    type Insert = Database["public"]["Tables"]["profiles"]["Insert"];
    type WithoutGenerated = Omit<Insert, "full_name" | "created_at">;
    expectTypeOf<WithoutGenerated>().not.toHaveProperty("full_name");
  });
});
