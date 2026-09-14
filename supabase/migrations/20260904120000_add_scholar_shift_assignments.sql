-- Standing weekly shift assignments for front desk and study sessions.
-- Planned occupancy only: who is supposed to be working when. Actual attendance
-- stays in front_desk_logs / study_session_logs and is compared against this on
-- read in session-log.service.ts, which already queries this table.
-- Loaded from the sign-up sheets by scripts/ingest-signups.sh. See issues #69, #70.

-- Range over time for the overlap constraint; Postgres ships tsrange and
-- daterange but has no built-in range over a bare time.
CREATE TYPE public.timerange AS RANGE (subtype = time without time zone);

CREATE TYPE public.session_kind AS ENUM ('front_desk', 'study_session');

-- btree_gist supplies the = operator classes for the scalar columns inside the
-- GiST exclusion constraint below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.scholar_shift_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scholar_id uuid NOT NULL,
  semester_id integer NOT NULL,
  session_kind public.session_kind NOT NULL,
  day_of_week smallint NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'google_sheet'::text,
  source_tab text,
  source_name text,
  match_method text,
  load_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scholar_shift_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT scholar_shift_assignments_scholar_id_fkey
    FOREIGN KEY (scholar_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT scholar_shift_assignments_semester_id_fkey
    FOREIGN KEY (semester_id) REFERENCES public.semesters (id),
  CONSTRAINT scholar_shift_assignments_dow_check CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT scholar_shift_assignments_time_check CHECK (end_time > start_time)
);

COMMENT ON TABLE public.scholar_shift_assignments IS
  'Standing weekly shift assignments (who is supposed to be working when), per semester, for front desk and study sessions. Planned occupancy only - NOT attendance. Compared against the session log tables in app code; nothing is precomputed. Loaded via scripts/ingest-signups.sh.';

COMMENT ON COLUMN public.scholar_shift_assignments.scholar_id IS
  'References profiles.id. The log tables key on scholar_uid, which matches profiles.student_id, so joining schedule to logs goes through profiles.';

COMMENT ON COLUMN public.scholar_shift_assignments.day_of_week IS
  'Postgres DOW: 0=Sunday .. 6=Saturday, matching getEasternDayOfWeek() in shared/eastern-time.ts. The sign-up sheets only populate 1..5.';

COMMENT ON COLUMN public.scholar_shift_assignments.is_active IS
  'Whether the assignment is in force. Compliance reads filter is_active = true, and the overlap constraint applies only to active rows.';

COMMENT ON COLUMN public.scholar_shift_assignments.source_tab IS
  'Diagnostics: workbook tab the row came from. Also scopes which rows a reload replaces.';

COMMENT ON COLUMN public.scholar_shift_assignments.source_name IS
  'Diagnostics: raw name fragment from the sign-up sheet cell that produced this row.';

COMMENT ON COLUMN public.scholar_shift_assignments.load_batch_id IS
  'Diagnostics: identifies the ingest run that inserted this row.';

ALTER TABLE public.scholar_shift_assignments OWNER TO postgres;

-- A scholar cannot hold two overlapping shifts of the same kind on the same
-- weekday. The one piece of business logic kept in the schema; the front desk
-- cap of three per slot is deliberately left to the admin UI. Partial on
-- is_active so a deactivated assignment never blocks a new one.
ALTER TABLE public.scholar_shift_assignments
  ADD CONSTRAINT no_overlapping_shift_assignments
  EXCLUDE USING gist (
    scholar_id WITH =,
    semester_id WITH =,
    session_kind WITH =,
    day_of_week WITH =,
    public.timerange(start_time, end_time) WITH &&
  ) WHERE (is_active);

-- Matches the compliance read: .in("scholar_id", ids).eq("is_active", true)
CREATE INDEX IF NOT EXISTS idx_scholar_shift_assignments_scholar_active
  ON public.scholar_shift_assignments USING btree (scholar_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_scholar_shift_assignments_lookup
  ON public.scholar_shift_assignments USING btree (semester_id, session_kind, day_of_week, start_time);

ALTER TABLE public.scholar_shift_assignments ENABLE ROW LEVEL SECURITY;

-- The ingest script (service role) is the only writer; there is deliberately no
-- authenticated INSERT/UPDATE/DELETE policy.
CREATE POLICY "service_role_full_access_scholar_shift_assignments"
  ON public.scholar_shift_assignments
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Self-read compares against profiles.id directly, because scholar_id IS
-- profiles.id here. Sibling policies on daily_scholar_activity / whaf_form_logs
-- compare a roster uid to auth.uid()::text, which never matches; that pattern is
-- deliberately not copied.
CREATE POLICY "authenticated_select_scholar_shift_assignments"
  ON public.scholar_shift_assignments
  FOR SELECT
  TO authenticated
  USING (
    scholar_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.app_role = ANY (
          ARRAY[
            'admin'::text,
            'staff'::text,
            'teamleader'::text,
            'team_leader'::text,
            'developer'::text,
            'exec'::text
          ]
        )
    )
  );

CREATE POLICY "developer_read_scholar_shift_assignments"
  ON public.scholar_shift_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_developer());

-- No anon grant: there is no public/kiosk path for shift assignments.
GRANT ALL ON TABLE public.scholar_shift_assignments TO authenticated;
GRANT ALL ON TABLE public.scholar_shift_assignments TO service_role;
