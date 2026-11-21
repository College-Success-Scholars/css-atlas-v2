/**
 * Compile-time guard: table-backed models stay aligned with generated Database types.
 * After `npm run db:types --prefix backend`, fix models if these assertions fail.
 */
import { describe, expectTypeOf, it } from "vitest";
import type { TutorReportLogRow } from "../models/tutor-report-log.model.js";
import type { ProfilesRow } from "../models/user.model.js";
import type { ScholarWeekExcuseRow } from "../models/attendance-week.model.js";
import type { Database } from "../supabase/database.types.js";

type ProfilesDbRow = Database["public"]["Tables"]["profiles"]["Row"];
type TutorReportDbRow = Database["public"]["Tables"]["tutor_report_logs"]["Row"];
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

  it("profiles Insert omits generated full_name in ScholarProfileInsert pattern", () => {
    type Insert = Database["public"]["Tables"]["profiles"]["Insert"];
    type WithoutGenerated = Omit<Insert, "full_name" | "created_at">;
    expectTypeOf<WithoutGenerated>().not.toHaveProperty("full_name");
  });
});
