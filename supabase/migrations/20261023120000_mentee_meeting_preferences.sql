-- Meeting preference (weekday + program-local time) per team-leader <-> mentee
-- pair. This is the ONLY new persistent state in the mentee review redesign.
--
-- Keyed by the natural pair identities (mentor_id -> profiles.id,
-- mentee_uid -> user_roster.uid) rather than mentor_mentee.id, because roster
-- sync deletes and reinserts mentor_mentee rows.
--
-- Not applied by the change author. Apply with `supabase db push` (staging,
-- then prod) after review, then regenerate types:
--   npm run db:types --prefix backend

CREATE TABLE IF NOT EXISTS "public"."mentee_meeting_preferences" (
  "mentor_id" "uuid" NOT NULL,
  "mentee_uid" "text" NOT NULL,
  "weekday" smallint NOT NULL,
  "meeting_time" time without time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "mentee_meeting_preferences_weekday_check"
    CHECK ("weekday" >= 1 AND "weekday" <= 7),
  CONSTRAINT "mentee_meeting_preferences_minute_check"
    CHECK (EXTRACT(SECOND FROM "meeting_time") = 0),
  CONSTRAINT "mentee_meeting_preferences_pkey"
    PRIMARY KEY ("mentor_id", "mentee_uid"),
  CONSTRAINT "mentee_meeting_preferences_mentor_id_fkey"
    FOREIGN KEY ("mentor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "mentee_meeting_preferences_mentee_uid_fkey"
    FOREIGN KEY ("mentee_uid") REFERENCES "public"."user_roster"("uid") ON DELETE CASCADE
);

ALTER TABLE "public"."mentee_meeting_preferences" OWNER TO "postgres";

COMMENT ON TABLE "public"."mentee_meeting_preferences" IS
  'Optional weekly meeting weekday (ISO 1-7) + program-local time per TL-mentee pair. Keyed by natural pair identities so roster sync cannot erase it (re-adding the identical pair recovers its setting).';

-- Maintain updated_at on save.
CREATE OR REPLACE FUNCTION "public"."set_mentee_meeting_preference_updated_at"() RETURNS "trigger"
  LANGUAGE "plpgsql"
  AS $$
BEGIN
  NEW."updated_at" = "now"();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_mentee_meeting_preference_updated_at"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "set_mentee_meeting_preference_updated_at" ON "public"."mentee_meeting_preferences";

CREATE TRIGGER "set_mentee_meeting_preference_updated_at"
  BEFORE UPDATE ON "public"."mentee_meeting_preferences"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_mentee_meeting_preference_updated_at"();

ALTER TABLE "public"."mentee_meeting_preferences" ENABLE ROW LEVEL SECURITY;

-- Owner identity is bound to auth.uid(); the WITH CHECK clauses prevent
-- reassigning the owner key. Every command also requires a permitted role and
-- an active mentor_mentee assignment, so an admin's review access never grants
-- overwriting another TL's preference.
DROP POLICY IF EXISTS "meeting_preferences_select_owner" ON "public"."mentee_meeting_preferences";

CREATE POLICY "meeting_preferences_select_owner"
  ON "public"."mentee_meeting_preferences"
  FOR SELECT
  TO "authenticated"
  USING (
    "mentor_id" = (SELECT auth.uid())
    AND public.is_team_leader_or_above()
    AND EXISTS (
      SELECT 1 FROM public.mentor_mentee mm
      WHERE mm."mentor_id" = (SELECT auth.uid()) AND mm."mentee_uid" = "mentee_uid"
    )
  );

DROP POLICY IF EXISTS "meeting_preferences_insert_owner" ON "public"."mentee_meeting_preferences";

CREATE POLICY "meeting_preferences_insert_owner"
  ON "public"."mentee_meeting_preferences"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (
    "mentor_id" = (SELECT auth.uid())
    AND public.is_team_leader_or_above()
    AND EXISTS (
      SELECT 1 FROM public.mentor_mentee mm
      WHERE mm."mentor_id" = (SELECT auth.uid()) AND mm."mentee_uid" = "mentee_uid"
    )
  );

-- UPDATE checks the old row (USING) and the new row (WITH CHECK).
DROP POLICY IF EXISTS "meeting_preferences_update_owner" ON "public"."mentee_meeting_preferences";

CREATE POLICY "meeting_preferences_update_owner"
  ON "public"."mentee_meeting_preferences"
  FOR UPDATE
  TO "authenticated"
  USING (
    "mentor_id" = (SELECT auth.uid())
    AND public.is_team_leader_or_above()
    AND EXISTS (
      SELECT 1 FROM public.mentor_mentee mm
      WHERE mm."mentor_id" = (SELECT auth.uid()) AND mm."mentee_uid" = "mentee_uid"
    )
  )
  WITH CHECK (
    "mentor_id" = (SELECT auth.uid())
    AND public.is_team_leader_or_above()
    AND EXISTS (
      SELECT 1 FROM public.mentor_mentee mm
      WHERE mm."mentor_id" = (SELECT auth.uid()) AND mm."mentee_uid" = "mentee_uid"
    )
  );

GRANT SELECT, INSERT, UPDATE ON "public"."mentee_meeting_preferences" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."mentee_meeting_preferences" TO "service_role";
GRANT ALL ON "public"."mentee_meeting_preferences" TO "postgres";
