-- Standing weekly shift assignments for front desk and study sessions.
--
-- One row per scholar per standing shift, per semester. Planned occupancy only:
-- this is who is *supposed* to be working when. Actual attendance lives in
-- front_desk_logs / study_session_logs and is compared against this table live
-- in app code (backend/src/services/session-log.service.ts, which already reads
-- this table) — no trigger, view, or cron precomputes the comparison.
--
-- Loaded from the sign-up sheets by scripts/ingest-signups.sh.
--
-- Rollback:
--   DROP TABLE IF EXISTS "public"."scholar_shift_assignments";
--   DROP TYPE IF EXISTS "public"."session_kind";
--   DROP TYPE IF EXISTS "public"."timerange";

-- Range over `time` for the overlap check below. Postgres ships tsrange and
-- daterange but has no built-in range over a bare time.
CREATE TYPE "public"."timerange" AS RANGE (subtype = time without time zone);

CREATE TYPE "public"."session_kind" AS ENUM ('front_desk', 'study_session');

CREATE TABLE IF NOT EXISTS "public"."scholar_shift_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scholar_id" "uuid" NOT NULL,
    "semester_id" integer NOT NULL,
    "session_kind" "public"."session_kind" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "source" "text" DEFAULT 'google_sheet'::"text" NOT NULL,
    "source_tab" "text",
    "source_name" "text",
    "match_method" "text",
    "load_batch_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scholar_shift_assignments_dow_valid" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "scholar_shift_assignments_time_order" CHECK (("end_time" > "start_time"))
);

ALTER TABLE "public"."scholar_shift_assignments" OWNER TO "postgres";

COMMENT ON TABLE "public"."scholar_shift_assignments" IS
  'Standing weekly shift assignments (who is supposed to be working when), per semester, for front desk and study sessions. Planned occupancy only — NOT attendance. Compared live in app code against front_desk_logs / study_session_logs; nothing is precomputed. Loaded from the sign-up sheets via scripts/ingest-signups.sh.';

COMMENT ON COLUMN "public"."scholar_shift_assignments"."day_of_week" IS
  'Postgres DOW convention: 0=Sunday .. 6=Saturday, matching shared/eastern-time.ts getEasternDayOfWeek(). The sign-up sheets only populate 1..5 (Mon-Fri).';

COMMENT ON COLUMN "public"."scholar_shift_assignments"."scholar_id" IS
  'References profiles.id. Note the log tables key on scholar_uid, which matches profiles.student_id — joining schedule to logs goes through profiles.';

COMMENT ON COLUMN "public"."scholar_shift_assignments"."is_active" IS
  'Whether the assignment is currently in force. Compliance reads filter on is_active = true; the overlap constraint only applies to active rows.';

COMMENT ON COLUMN "public"."scholar_shift_assignments"."source_name" IS
  'Diagnostics: the raw name fragment from the sign-up sheet cell that produced this row.';

COMMENT ON COLUMN "public"."scholar_shift_assignments"."load_batch_id" IS
  'Diagnostics: identifies the ingest run that inserted this row.';

ALTER TABLE ONLY "public"."scholar_shift_assignments"
    ADD CONSTRAINT "scholar_shift_assignments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."scholar_shift_assignments"
    ADD CONSTRAINT "scholar_shift_assignments_scholar_id_fkey"
    FOREIGN KEY ("scholar_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."scholar_shift_assignments"
    ADD CONSTRAINT "scholar_shift_assignments_semester_id_fkey"
    FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id");

-- A scholar cannot hold two overlapping shifts of the same kind on the same
-- weekday. This is the one piece of business logic that lives in the schema;
-- everything else is deliberately in application code.
--
-- Partial on is_active so a deactivated assignment never blocks a new one.
-- btree_gist supplies the `=` operator classes for the scalar columns.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

ALTER TABLE ONLY "public"."scholar_shift_assignments"
    ADD CONSTRAINT "no_overlapping_shift_assignments"
    EXCLUDE USING "gist" (
        "scholar_id" WITH =,
        "semester_id" WITH =,
        "session_kind" WITH =,
        "day_of_week" WITH =,
        "public"."timerange"("start_time", "end_time") WITH &&
    ) WHERE ("is_active");

-- Matches the compliance read: .in("scholar_id", ids).eq("is_active", true)
CREATE INDEX "scholar_shift_assignments_scholar_active_idx"
    ON "public"."scholar_shift_assignments" USING "btree" ("scholar_id")
    WHERE ("is_active");

CREATE INDEX "scholar_shift_assignments_lookup_idx"
    ON "public"."scholar_shift_assignments" USING "btree" ("semester_id", "session_kind", "day_of_week", "start_time");

ALTER TABLE "public"."scholar_shift_assignments" ENABLE ROW LEVEL SECURITY;

-- Self-read resolves through profiles.id directly, because scholar_id IS
-- profiles.id here. (Sibling policies on daily_scholar_activity / whaf_form_logs
-- compare a roster uid against auth.uid()::text, which never matches; this table
-- deliberately does not copy that pattern.)
CREATE POLICY "authenticated_select_shift_assignments" ON "public"."scholar_shift_assignments"
  FOR SELECT TO "authenticated" USING (
    (("scholar_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
       FROM "public"."profiles"
      WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."app_role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'teamleader'::"text", 'developer'::"text"]))))))
  );

CREATE POLICY "developer_read_shift_assignments" ON "public"."scholar_shift_assignments"
  FOR SELECT TO "authenticated" USING ("public"."is_developer"());

-- The ingest script (service role) is the only writer; no authenticated
-- INSERT/UPDATE/DELETE policy exists by design.
CREATE POLICY "service_role_full_access" ON "public"."scholar_shift_assignments"
  TO "service_role" USING (true) WITH CHECK (true);

GRANT ALL ON TABLE "public"."scholar_shift_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."scholar_shift_assignments" TO "service_role";
-- Intentionally not granted to "anon": no public/kiosk path for shift assignments.
