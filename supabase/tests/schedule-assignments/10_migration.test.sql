-- Legacy conversion, constraints, privileges, helper functions.
BEGIN;

DO $$
DECLARE
  v_cw date := t.cw();
  n int;
BEGIN
  -- legacy active rows keep ids and become semester-wide intervals
  SELECT count(*) INTO n FROM public.scholar_shift_assignments;
  PERFORM t.assert(n = 3, 'three legacy active rows survive in the main table, got ' || n);

  PERFORM t.assert(
    (SELECT effective_from = v_cw - 28 AND effective_until = v_cw + 84
       FROM public.scholar_shift_assignments WHERE id = '00000000-0000-0000-0000-0000000000a1'),
    'active semester row spans [start, end+1)');
  PERFORM t.assert(
    (SELECT effective_from = v_cw - 140 AND effective_until = v_cw - 62
       FROM public.scholar_shift_assignments WHERE id = '00000000-0000-0000-0000-0000000000b1'),
    'old semester active row spans its own semester');

  -- legacy inactive rows are archived unchanged, not given invented validity
  PERFORM t.assert((SELECT count(*) FROM public.scholar_shift_assignments_legacy_inactive) = 2, 'two inactive rows archived');
  PERFORM t.assert(NOT EXISTS (SELECT 1 FROM public.scholar_shift_assignments WHERE id IN
    ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1')), 'inactive rows left the main table');

  -- revisions exist for every scholar and semester that had an active row, and only those
  PERFORM t.assert(t.revision('S1', 902) = 0, 'S1 revision row at 0');
  PERFORM t.assert(t.revision('S2', 901) = 0, 'S2 old semester revision row at 0');
  PERFORM t.assert(t.revision('S3', 902) IS NULL, 'no revision row for a scholar with only inactive rows');

  -- is_active is retired
  PERFORM t.assert(NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scholar_shift_assignments' AND column_name = 'is_active'), 'is_active column removed');

  -- structural constraints
  PERFORM t.assert(t.sqlstate_of($q$INSERT INTO public.scholar_shift_assignments
    (scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, effective_from, effective_until)
    VALUES ('S2', 902, 'front_desk', 1, '09:00', '10:00', current_date, current_date)$q$) = '23514', 'empty effective range rejected');
  PERFORM t.assert(t.sqlstate_of($q$INSERT INTO public.scholar_shift_assignments
    (scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, effective_from, effective_until)
    VALUES ('S1', 902, 'study_session', 1, '10:00', '12:00', current_date, current_date + 7)$q$) = '23P01', 'overlapping weekly time and dates rejected');
  PERFORM t.assert(t.sqlstate_of(format($q$INSERT INTO public.scholar_shift_assignments
    (scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, effective_from, effective_until)
    VALUES ('S1', 902, 'study_session', 1, '10:00', '12:00', %L, %L)$q$, v_cw - 100, v_cw - 90)) = 'OK', 'same weekly time in a disjoint date window is allowed');
  PERFORM t.assert(t.sqlstate_of($q$INSERT INTO public.scholar_shift_assignments
    (scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, effective_from, effective_until)
    VALUES ('S1', 902, 'study_session', 1, '12:00', '13:00', current_date, current_date + 7)$q$) = 'OK', 'adjacent time (end = next start) allowed');
END $$;

-- Eastern Monday computation across both DST changes
DO $$
BEGIN
  PERFORM t.assert(public.eastern_week_start('2026-03-09 03:59:59+00') = '2026-03-02', 'Sunday 23:59:59 EST before spring forward');
  PERFORM t.assert(public.eastern_week_start('2026-03-09 04:00:00+00') = '2026-03-09', 'Monday 00:00 EDT after spring forward');
  PERFORM t.assert(public.eastern_week_start('2026-11-02 04:59:59+00') = '2026-10-26', 'Sunday 23:59:59 EDT before fall back');
  PERFORM t.assert(public.eastern_week_start('2026-11-02 05:00:00+00') = '2026-11-02', 'Monday 00:00 EST after fall back');
  PERFORM t.assert(public.eastern_week_start('2026-11-01 06:30:00+00') = '2026-10-26', 'Sunday during the repeated hour');
END $$;

-- Direct DML and exposure
DO $$
BEGIN
  PERFORM t.login('11111111-1111-1111-1111-111111111111');
  PERFORM t.assert(t.sqlstate_of($q$INSERT INTO public.scholar_shift_assignments
    (scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, effective_from, effective_until)
    VALUES ('S2', 902, 'front_desk', 1, '09:00', '10:00', current_date, current_date + 7)$q$) = '42501', 'TL cannot INSERT directly');
  PERFORM t.assert(t.sqlstate_of($q$UPDATE public.scholar_shift_assignments SET effective_until = effective_from + 1$q$) = '42501', 'TL cannot UPDATE directly');
  PERFORM t.assert(t.sqlstate_of($q$DELETE FROM public.scholar_shift_assignments$q$) = '42501', 'TL cannot DELETE directly');
  PERFORM t.assert(t.sqlstate_of($q$TRUNCATE public.scholar_shift_assignments$q$) = '42501', 'TL cannot TRUNCATE');
  PERFORM t.assert(t.sqlstate_of($q$SELECT * FROM public.scholar_schedule_revisions$q$) = '42501', 'TL cannot read revisions table');
  PERFORM t.assert(t.sqlstate_of($q$INSERT INTO public.scholar_schedule_revisions (scholar_id, semester_id) VALUES ('S2', 902)$q$) = '42501', 'TL cannot write revisions');
  PERFORM t.assert(t.sqlstate_of($q$UPDATE public.scholar_schedule_revisions SET revision = 99$q$) = '42501', 'TL cannot bump revisions');
  PERFORM t.assert(t.sqlstate_of($q$SELECT public.parse_schedule_shifts('[]')$q$) = '42501', 'internal helpers are not callable');
  PERFORM t.assert(t.sqlstate_of($q$SELECT public.build_schedule_snapshot(current_date, NULL, NULL)$q$) = '42501', 'snapshot builder is not callable');
  PERFORM t.logout();

  PERFORM t.login('44444444-4444-4444-4444-444444444444');
  PERFORM t.assert(t.sqlstate_of($q$DELETE FROM public.scholar_shift_assignments$q$) = '42501', 'admin policy no longer writes');
  PERFORM t.logout();

  PERFORM t.become('anon');
  PERFORM t.assert(t.sqlstate_of($q$SELECT * FROM public.scholar_shift_assignments$q$) = '42501', 'anon cannot read assignments');
  PERFORM t.assert(t.sqlstate_of($q$SELECT public.get_schedule_snapshot(current_date)$q$) = '42501', 'anon cannot call read RPC');
  PERFORM t.assert(t.sqlstate_of($q$SELECT public.replace_scholar_schedule_from_week('S1', 902, current_date, 0, '[]')$q$) = '42501', 'anon cannot call write RPC');
  PERFORM t.logout();

  PERFORM t.become('service_role');
  PERFORM t.assert(t.sqlstate_of($q$SELECT count(*) FROM public.scholar_shift_assignments$q$) = 'OK', 'service role can read for detectors');
  PERFORM t.assert(t.sqlstate_of($q$DELETE FROM public.scholar_shift_assignments$q$) = '42501', 'service role cannot delete');
  PERFORM t.assert(t.sqlstate_of($q$UPDATE public.scholar_shift_assignments SET semester_id = semester_id$q$) = '42501', 'service role cannot update');
  PERFORM t.assert(t.sqlstate_of($q$SELECT public.replace_scholar_schedule_from_week('S1', 902, current_date, 0, '[]')$q$) = '42501', 'service role cannot impersonate a team leader (no auth.uid)');
  PERFORM t.logout();

  -- other signed-in users keep read-only access, as before
  PERFORM t.login('22222222-2222-2222-2222-222222222222');
  PERFORM t.assert(t.sqlstate_of($q$SELECT count(*) FROM public.scholar_shift_assignments$q$) = 'OK', 'scholar can still read assignments');
  PERFORM t.logout();
END $$;

-- Functions must pin search_path and never be executable by PUBLIC
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(p.proname, ',') INTO bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('eastern_week_start', 'parse_schedule_shifts', 'build_schedule_snapshot', 'get_schedule_snapshot', 'replace_scholar_schedule_from_week')
    AND (p.proconfig IS NULL OR NOT (array_to_string(p.proconfig, ',') LIKE 'search_path=""%'))
    ;
  PERFORM t.assert(bad IS NULL, 'search_path pinned on: ' || coalesce(bad, ''));

  PERFORM t.assert(NOT has_function_privilege('anon', 'public.replace_scholar_schedule_from_week(text,integer,date,bigint,jsonb)', 'EXECUTE'), 'anon has no write RPC EXECUTE');
  PERFORM t.assert(has_function_privilege('authenticated', 'public.replace_scholar_schedule_from_week(text,integer,date,bigint,jsonb)', 'EXECUTE'), 'authenticated has write RPC EXECUTE');
  PERFORM t.assert(NOT has_function_privilege('anon', 'public.get_schedule_snapshot(date,text,integer)', 'EXECUTE'), 'anon has no read RPC EXECUTE');
  PERFORM t.assert((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.scholar_shift_assignments'::regclass), 'RLS on assignments');
  PERFORM t.assert((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.scholar_schedule_revisions'::regclass), 'RLS on revisions');
  PERFORM t.assert((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.scholar_shift_assignments_legacy_inactive'::regclass), 'RLS on legacy archive');
END $$;

ROLLBACK;
