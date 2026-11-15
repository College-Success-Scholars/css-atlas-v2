-- Team leader schedule management.
--
-- scholar_shift_assignments becomes an effective-dated timeline instead of an
-- is_active flag. Every change is made through public.replace_scholar_schedule_from_week,
-- which truncates or replaces rows from an Eastern Monday onward and never touches
-- earlier weeks. Direct DML on the assignment and revision tables is revoked.
--
-- Legacy active rows become [semester.start_date, semester.end_date + 1).
-- Legacy inactive rows carry no known validity window, so they are copied unchanged
-- to scholar_shift_assignments_legacy_inactive instead of being given a made-up one.

-- ---------------------------------------------------------------------------
-- Legacy inactive rows
-- ---------------------------------------------------------------------------

CREATE TABLE public.scholar_shift_assignments_legacy_inactive (
  id           uuid                     NOT NULL PRIMARY KEY,
  scholar_id   text                     NOT NULL REFERENCES public.user_roster (uid) ON DELETE CASCADE,
  semester_id  integer                  NOT NULL REFERENCES public.semesters (id) ON DELETE CASCADE,
  session_kind public.session_kind      NOT NULL,
  day_of_week  smallint                 NOT NULL,
  start_time   time without time zone   NOT NULL,
  end_time     time without time zone   NOT NULL,
  created_at   timestamp with time zone NOT NULL,
  archived_at  timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.scholar_shift_assignments_legacy_inactive (
  id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, created_at
)
SELECT id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, created_at
FROM public.scholar_shift_assignments
WHERE NOT is_active;

DELETE FROM public.scholar_shift_assignments WHERE NOT is_active;

ALTER TABLE public.scholar_shift_assignments_legacy_inactive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legacy_inactive_assignments_select_team_leader"
  ON public.scholar_shift_assignments_legacy_inactive
  FOR SELECT
  TO authenticated
  USING (public.is_team_leader_or_above());

REVOKE ALL ON public.scholar_shift_assignments_legacy_inactive FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.scholar_shift_assignments_legacy_inactive TO authenticated;

-- ---------------------------------------------------------------------------
-- Effective-dated assignments
-- ---------------------------------------------------------------------------

ALTER TABLE public.scholar_shift_assignments DROP CONSTRAINT no_overlapping_shift_assignments;
DROP INDEX public.idx_shift_assignments_scholar;
DROP INDEX public.idx_shift_assignments_semester_kind;

ALTER TABLE public.scholar_shift_assignments
  ADD COLUMN effective_from  date,
  ADD COLUMN effective_until date;

UPDATE public.scholar_shift_assignments a
SET effective_from = s.start_date,
    effective_until = s.end_date + 1
FROM public.semesters s
WHERE s.id = a.semester_id;

ALTER TABLE public.scholar_shift_assignments
  ALTER COLUMN effective_from SET NOT NULL,
  ALTER COLUMN effective_until SET NOT NULL,
  ADD CONSTRAINT scholar_shift_assignments_effective_order CHECK (effective_until > effective_from),
  DROP COLUMN is_active;

ALTER TABLE public.scholar_shift_assignments
  ADD COLUMN effective_dates daterange
    GENERATED ALWAYS AS (daterange(effective_from, effective_until, '[)')) STORED;

ALTER TABLE public.scholar_shift_assignments
  ADD CONSTRAINT no_overlapping_shift_assignments
  EXCLUDE USING gist (scholar_id WITH =, week_minute_range WITH &&, effective_dates WITH &&);

CREATE INDEX idx_shift_assignments_scholar_effective
  ON public.scholar_shift_assignments (scholar_id, semester_id, effective_from, effective_until);

CREATE INDEX idx_shift_assignments_effective_window
  ON public.scholar_shift_assignments (semester_id, day_of_week, effective_from, effective_until);

COMMENT ON COLUMN public.scholar_shift_assignments.effective_from IS 'First Eastern calendar date the weekly shift applies (inclusive).';
COMMENT ON COLUMN public.scholar_shift_assignments.effective_until IS 'Eastern calendar date the weekly shift stops applying (exclusive).';

-- ---------------------------------------------------------------------------
-- Revisions: one optimistic-lock row per scholar and semester
-- ---------------------------------------------------------------------------

CREATE TABLE public.scholar_schedule_revisions (
  scholar_id  text                     NOT NULL REFERENCES public.user_roster (uid) ON DELETE CASCADE,
  semester_id integer                  NOT NULL REFERENCES public.semesters (id) ON DELETE CASCADE,
  revision    bigint                   NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_by  uuid,
  PRIMARY KEY (scholar_id, semester_id)
);

INSERT INTO public.scholar_schedule_revisions (scholar_id, semester_id)
SELECT DISTINCT scholar_id, semester_id FROM public.scholar_shift_assignments;

ALTER TABLE public.scholar_schedule_revisions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Privileges: reads stay open to signed-in users, writes only via the RPC
-- ---------------------------------------------------------------------------

DROP POLICY "scholar_shift_assignments_write_admin" ON public.scholar_shift_assignments;

REVOKE ALL ON public.scholar_shift_assignments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.scholar_shift_assignments TO authenticated, service_role;

REVOKE ALL ON public.scholar_schedule_revisions FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers (not callable through the Data API)
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.eastern_week_start(p_at timestamp with time zone)
  RETURNS date
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path = ''
  AS $$
  SELECT pg_catalog.date_trunc('week', p_at AT TIME ZONE 'America/New_York')::date
$$;

CREATE FUNCTION public.parse_schedule_shifts(p_shifts jsonb)
  RETURNS TABLE (
    ord      integer,
    kind     public.session_kind,
    dow      smallint,
    start_at time without time zone,
    end_at   time without time zone
  )
  LANGUAGE plpgsql
  STABLE
  SET search_path = ''
  AS $$
DECLARE
  v_el    jsonb;
  v_i     integer := 0;
  v_day   numeric;
  v_kind  text;
  v_start text;
  v_end   text;
BEGIN
  IF p_shifts IS NULL OR pg_catalog.jsonb_typeof(p_shifts) <> 'array' THEN
    RAISE EXCEPTION 'shifts must be an array' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_array_length(p_shifts) > 100 THEN
    RAISE EXCEPTION 'shifts must contain at most 100 entries' USING ERRCODE = '22023';
  END IF;

  FOR v_el IN SELECT e.value FROM pg_catalog.jsonb_array_elements(p_shifts) AS e LOOP
    v_i := v_i + 1;
    IF pg_catalog.jsonb_typeof(v_el) <> 'object' THEN
      RAISE EXCEPTION 'shifts[%] must be an object', v_i - 1 USING ERRCODE = '22023';
    END IF;

    IF pg_catalog.jsonb_typeof(v_el -> 'kind') IS DISTINCT FROM 'string'
       OR (v_el ->> 'kind') NOT IN ('front_desk', 'study_session') THEN
      RAISE EXCEPTION 'shifts[%].kind must be front_desk or study_session', v_i - 1 USING ERRCODE = '22023';
    END IF;
    v_kind := v_el ->> 'kind';

    IF pg_catalog.jsonb_typeof(v_el -> 'dayOfWeek') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'shifts[%].dayOfWeek must be an integer 0-6', v_i - 1 USING ERRCODE = '22023';
    END IF;
    v_day := (v_el ->> 'dayOfWeek')::numeric;
    IF v_day <> pg_catalog.trunc(v_day) OR v_day < 0 OR v_day > 6 THEN
      RAISE EXCEPTION 'shifts[%].dayOfWeek must be an integer 0-6', v_i - 1 USING ERRCODE = '22023';
    END IF;

    v_start := v_el ->> 'startTime';
    v_end := v_el ->> 'endTime';
    IF pg_catalog.jsonb_typeof(v_el -> 'startTime') IS DISTINCT FROM 'string'
       OR v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$' THEN
      RAISE EXCEPTION 'shifts[%].startTime must be HH:MM', v_i - 1 USING ERRCODE = '22023';
    END IF;
    IF pg_catalog.jsonb_typeof(v_el -> 'endTime') IS DISTINCT FROM 'string'
       OR v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$' THEN
      RAISE EXCEPTION 'shifts[%].endTime must be HH:MM', v_i - 1 USING ERRCODE = '22023';
    END IF;
    IF v_end::time <= v_start::time THEN
      RAISE EXCEPTION 'shifts[%]: endTime must be after startTime', v_i - 1 USING ERRCODE = '22023';
    END IF;

    ord := v_i - 1;
    kind := v_kind::public.session_kind;
    dow := v_day::smallint;
    start_at := v_start::time;
    end_at := v_end::time;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- One statement, so rows and revisions come from a single snapshot.
CREATE FUNCTION public.build_schedule_snapshot(
  p_week_start  date,
  p_scholar_id  text,
  p_semester_id integer
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path = ''
  AS $$
  WITH sem AS (
    SELECT s.id, s.name, s.start_date, s.end_date
    FROM public.semesters s
    WHERE (p_semester_id IS NOT NULL AND s.id = p_semester_id)
       OR (p_semester_id IS NULL AND s.is_active)
    ORDER BY s.start_date DESC
    LIMIT 1
  ),
  people AS (
    SELECT DISTINCT r.uid
    FROM public.user_roster r
    WHERE r.uid IS NOT NULL
      AND pg_catalog.lower(pg_catalog.btrim(r.program_role)) = 'scholar'
      AND (p_scholar_id IS NULL OR r.uid = p_scholar_id)
  ),
  week_shifts AS (
    SELECT a.scholar_id,
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'id', a.id,
               'kind', a.session_kind,
               'dayOfWeek', a.day_of_week,
               'startTime', pg_catalog.to_char(a.start_time, 'HH24:MI'),
               'endTime', pg_catalog.to_char(a.end_time, 'HH24:MI'),
               'effectiveFrom', a.effective_from,
               'effectiveUntil', a.effective_until
             )
             ORDER BY a.day_of_week, a.start_time, a.session_kind
           ) AS shifts
    FROM public.scholar_shift_assignments a
    JOIN sem ON sem.id = a.semester_id
    WHERE a.effective_from < p_week_start + 7
      AND a.effective_until > p_week_start
      AND (p_scholar_id IS NULL OR a.scholar_id = p_scholar_id)
    GROUP BY a.scholar_id
  )
  SELECT pg_catalog.jsonb_build_object(
    'semester', (
      SELECT pg_catalog.jsonb_build_object(
        'id', sem.id, 'name', sem.name, 'startDate', sem.start_date, 'endDate', sem.end_date
      )
      FROM sem
    ),
    'currentWeekStart', public.eastern_week_start(pg_catalog.now()),
    'weekStart', p_week_start,
    'scholars', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'uid', p.uid,
          'revision', COALESCE(rv.revision, 0),
          'shifts', COALESCE(ws.shifts, '[]'::jsonb)
        )
        ORDER BY p.uid
      )
      FROM people p
      CROSS JOIN sem
      LEFT JOIN public.scholar_schedule_revisions rv
        ON rv.scholar_id = p.uid AND rv.semester_id = sem.id
      LEFT JOIN week_shifts ws ON ws.scholar_id = p.uid
    ), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------------
-- Read RPC
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.get_schedule_snapshot(
  p_week_start  date,
  p_scholar_id  text DEFAULT NULL,
  p_semester_id integer DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.app_role IN ('team_leader', 'developer')
  ) THEN
    RAISE EXCEPTION 'Team leader or above required' USING ERRCODE = '42501';
  END IF;
  IF p_week_start IS NULL THEN
    RAISE EXCEPTION 'weekStart is required' USING ERRCODE = '22023';
  END IF;
  RETURN public.build_schedule_snapshot(p_week_start, p_scholar_id, p_semester_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Only writer
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.replace_scholar_schedule_from_week(
  p_scholar_id           text,
  p_semester_id          integer,
  p_effective_week_start date,
  p_expected_revision    bigint,
  p_shifts               jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_semester     public.semesters%ROWTYPE;
  v_current_week date := public.eastern_week_start(pg_catalog.now());
  v_from         date;
  v_until        date;
  v_revision     bigint;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_actor AND p.app_role IN ('team_leader', 'developer')
  ) THEN
    RAISE EXCEPTION 'Team leader or above required' USING ERRCODE = '42501';
  END IF;
  IF p_scholar_id IS NULL OR pg_catalog.btrim(p_scholar_id) = '' THEN
    RAISE EXCEPTION 'scholarUid is required' USING ERRCODE = '22023';
  END IF;
  IF p_semester_id IS NULL OR p_effective_week_start IS NULL OR p_expected_revision IS NULL THEN
    RAISE EXCEPTION 'semesterId, effectiveWeekStart and expectedRevision are required' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.date_part('isodow', p_effective_week_start) <> 1 THEN
    RAISE EXCEPTION 'effectiveWeekStart must be a Monday' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.parse_schedule_shifts(p_shifts);

  IF EXISTS (
    SELECT 1
    FROM public.parse_schedule_shifts(p_shifts) a
    JOIN public.parse_schedule_shifts(p_shifts) b ON a.ord < b.ord
    WHERE pg_catalog.int4range(
            a.dow * 1440 + (pg_catalog.date_part('hour', a.start_at)::integer * 60 + pg_catalog.date_part('minute', a.start_at)::integer),
            a.dow * 1440 + (pg_catalog.date_part('hour', a.end_at)::integer * 60 + pg_catalog.date_part('minute', a.end_at)::integer)
          ) && pg_catalog.int4range(
            b.dow * 1440 + (pg_catalog.date_part('hour', b.start_at)::integer * 60 + pg_catalog.date_part('minute', b.start_at)::integer),
            b.dow * 1440 + (pg_catalog.date_part('hour', b.end_at)::integer * 60 + pg_catalog.date_part('minute', b.end_at)::integer)
          )
  ) THEN
    RAISE EXCEPTION 'Shifts overlap each other' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roster r
    WHERE r.uid = p_scholar_id
      AND pg_catalog.lower(pg_catalog.btrim(r.program_role)) = 'scholar'
  ) THEN
    RAISE EXCEPTION 'Scholar is not on the roster' USING ERRCODE = 'CS404';
  END IF;

  SELECT * INTO v_semester FROM public.semesters s WHERE s.id = p_semester_id FOR SHARE;
  IF NOT FOUND OR NOT v_semester.is_active THEN
    RAISE EXCEPTION 'Schedules can only be changed in the active semester' USING ERRCODE = 'CS422';
  END IF;
  IF p_effective_week_start < v_current_week THEN
    RAISE EXCEPTION 'effectiveWeekStart % is before the current Eastern week %', p_effective_week_start, v_current_week
      USING ERRCODE = 'CS422';
  END IF;
  IF p_effective_week_start > v_semester.end_date OR p_effective_week_start + 6 < v_semester.start_date THEN
    RAISE EXCEPTION 'effectiveWeekStart is outside the semester' USING ERRCODE = 'CS422';
  END IF;
  v_from := GREATEST(p_effective_week_start, v_semester.start_date);
  v_until := v_semester.end_date + 1;

  INSERT INTO public.scholar_schedule_revisions (scholar_id, semester_id)
  VALUES (p_scholar_id, p_semester_id)
  ON CONFLICT (scholar_id, semester_id) DO NOTHING;

  SELECT r.revision INTO v_revision
  FROM public.scholar_schedule_revisions r
  WHERE r.scholar_id = p_scholar_id AND r.semester_id = p_semester_id
  FOR UPDATE;

  IF v_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Schedule changed since it was loaded (current revision %)', v_revision
      USING ERRCODE = 'CS409', DETAIL = v_revision::text;
  END IF;

  -- Rows that start on or after the boundary are superseded, except an identical row
  -- already in effect on the boundary date.
  DELETE FROM public.scholar_shift_assignments a
  WHERE a.scholar_id = p_scholar_id
    AND a.semester_id = p_semester_id
    AND a.effective_until > v_from
    AND a.effective_from >= v_from
    AND NOT (
      a.effective_from = v_from
      AND EXISTS (
        SELECT 1 FROM public.parse_schedule_shifts(p_shifts) s
        WHERE s.kind = a.session_kind AND s.dow = a.day_of_week
          AND s.start_at = a.start_time AND s.end_at = a.end_time
      )
    );

  -- Rows in effect before the boundary stop at the boundary unless they are kept.
  UPDATE public.scholar_shift_assignments a
  SET effective_until = v_from
  WHERE a.scholar_id = p_scholar_id
    AND a.semester_id = p_semester_id
    AND a.effective_from < v_from
    AND a.effective_until > v_from
    AND NOT EXISTS (
      SELECT 1 FROM public.parse_schedule_shifts(p_shifts) s
      WHERE s.kind = a.session_kind AND s.dow = a.day_of_week
        AND s.start_at = a.start_time AND s.end_at = a.end_time
    );

  -- Identical rows in effect on the boundary keep their id and run to the semester end.
  UPDATE public.scholar_shift_assignments a
  SET effective_until = v_until
  WHERE a.scholar_id = p_scholar_id
    AND a.semester_id = p_semester_id
    AND a.effective_from <= v_from
    AND a.effective_until > v_from
    AND a.effective_until <> v_until;

  INSERT INTO public.scholar_shift_assignments (
    scholar_id, semester_id, session_kind, day_of_week, start_time, end_time,
    effective_from, effective_until
  )
  SELECT p_scholar_id, p_semester_id, s.kind, s.dow, s.start_at, s.end_at, v_from, v_until
  FROM public.parse_schedule_shifts(p_shifts) s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.scholar_shift_assignments a
    WHERE a.scholar_id = p_scholar_id
      AND a.semester_id = p_semester_id
      AND a.effective_from <= v_from
      AND a.effective_until > v_from
      AND a.session_kind = s.kind AND a.day_of_week = s.dow
      AND a.start_time = s.start_at AND a.end_time = s.end_at
  );

  UPDATE public.scholar_schedule_revisions r
  SET revision = r.revision + 1, updated_at = pg_catalog.now(), updated_by = v_actor
  WHERE r.scholar_id = p_scholar_id AND r.semester_id = p_semester_id;

  RETURN public.build_schedule_snapshot(p_effective_week_start, p_scholar_id, p_semester_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.eastern_week_start(timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.parse_schedule_shifts(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.build_schedule_snapshot(date, text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_schedule_snapshot(date, text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.replace_scholar_schedule_from_week(text, integer, date, bigint, jsonb) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_schedule_snapshot(date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_scholar_schedule_from_week(text, integer, date, bigint, jsonb) TO authenticated;
