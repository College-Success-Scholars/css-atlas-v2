-- Test helpers. Everything lives in schema t and is dropped with the throwaway database.
CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO PUBLIC;

CREATE FUNCTION t.assert(ok boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT FAILED: %', msg; END IF;
END $$;

CREATE FUNCTION t.login(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE FUNCTION t.login_no_sub() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE FUNCTION t.become(p_role text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', p_role)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
END $$;

CREATE FUNCTION t.logout() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- Runs sql as the current role and returns 'OK' or the SQLSTATE; the failed statement is rolled back.
CREATE FUNCTION t.sqlstate_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;

CREATE FUNCTION t.sh(p_kind text, p_dow int, p_start text, p_end text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('kind', p_kind, 'dayOfWeek', p_dow, 'startTime', p_start, 'endTime', p_end)
$$;

CREATE FUNCTION t.cw() RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT public.eastern_week_start(now()) $$;
GRANT EXECUTE ON FUNCTION t.cw() TO PUBLIC;

-- Calls the RPC as the current role: returns the snapshot jsonb.
CREATE FUNCTION t.replace(p_uid text, p_week date, p_rev bigint, p_shifts jsonb, p_sem int DEFAULT 902)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.replace_scholar_schedule_from_week(p_uid, p_sem, p_week, p_rev, p_shifts)
$$;

-- Shift list of one scholar for one week as a compact comparable string.
CREATE FUNCTION t.week_shifts(p_uid text, p_week date) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(s ->> 'kind' || ':' || (s ->> 'dayOfWeek') || ':' || (s ->> 'startTime') || '-' || (s ->> 'endTime'), ',' ORDER BY (s ->> 'dayOfWeek')::int, s ->> 'startTime'), '')
  FROM jsonb_array_elements(
    (SELECT sc -> 'shifts' FROM jsonb_array_elements(public.get_schedule_snapshot(p_week, p_uid) -> 'scholars') sc LIMIT 1)
  ) s
$$;

CREATE FUNCTION t.revision(p_uid text, p_sem int DEFAULT 902) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT revision FROM public.scholar_schedule_revisions WHERE scholar_id = p_uid AND semester_id = p_sem
$$;

-- The baseline handle_new_user trigger is irrelevant here and only logs warnings.
ALTER TABLE auth.users DISABLE TRIGGER USER;

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'tl@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'scholar@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'noprofile@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'admin@example.test');

INSERT INTO public.profiles (id, first_name, last_name, student_id, app_role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tess', 'Lead', 'TL1', 'team_leader'),
  ('22222222-2222-2222-2222-222222222222', 'Sam', 'One', 'S1', 'scholar'),
  ('44444444-4444-4444-4444-444444444444', 'Ada', 'Min', NULL, 'admin');
