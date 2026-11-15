-- Behavior of get_schedule_snapshot and replace_scholar_schedule_from_week.
BEGIN;

-- Authorization --------------------------------------------------------------
DO $$
DECLARE
  v_cw date := t.cw();
  v_fd jsonb := t.sh('front_desk', 1, '09:00', '11:00');
BEGIN
  PERFORM t.login('22222222-2222-2222-2222-222222222222');
  PERFORM t.assert(t.sqlstate_of(format('SELECT t.replace(%L, %L, 0, %L)', 'S2', v_cw, jsonb_build_array(v_fd))) = '42501', 'scholar role cannot write');
  PERFORM t.assert(t.sqlstate_of(format('SELECT public.get_schedule_snapshot(%L)', v_cw)) = '42501', 'scholar role cannot read the board RPC');
  PERFORM t.logout();

  PERFORM t.login('33333333-3333-3333-3333-333333333333');
  PERFORM t.assert(t.sqlstate_of(format('SELECT t.replace(%L, %L, 0, %L)', 'S2', v_cw, jsonb_build_array(v_fd))) = '42501', 'user without a profile cannot write');
  PERFORM t.logout();

  PERFORM t.login_no_sub();
  PERFORM t.assert(t.sqlstate_of(format('SELECT t.replace(%L, %L, 0, %L)', 'S2', v_cw, jsonb_build_array(v_fd))) = '42501', 'jwt without sub cannot write');
  PERFORM t.logout();

  -- roles come from profiles, not from a client-supplied claim
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated', 'app_role', 'admin')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM t.assert(t.sqlstate_of(format('SELECT t.replace(%L, %L, 0, %L)', 'S2', v_cw, jsonb_build_array(v_fd))) = '42501', 'forged app_role claim is ignored');
  PERFORM t.logout();

  PERFORM t.assert((SELECT count(*) FROM public.scholar_shift_assignments WHERE scholar_id = 'S2') = 1, 'denied calls changed nothing');
END $$;

-- Validation and rollback ----------------------------------------------------
DO $$
DECLARE
  v_cw date := t.cw();
  v_before bigint;
  v_rows bigint;
  v_ok jsonb := jsonb_build_array(t.sh('front_desk', 1, '09:00', '11:00'));
  v_case record;
BEGIN
  PERFORM t.login('11111111-1111-1111-1111-111111111111');
  v_before := t.revision('S1');
  SELECT count(*) INTO v_rows FROM public.scholar_shift_assignments;

  FOR v_case IN SELECT * FROM (VALUES
    ('overlap FD/SS same day', 'S1', 902, v_cw, 0, jsonb_build_array(t.sh('front_desk', 1, '09:00', '11:00'), t.sh('study_session', 1, '10:00', '12:00')), '22023'),
    ('duplicate identical shifts', 'S1', 902, v_cw, 0, jsonb_build_array(t.sh('front_desk', 1, '09:00', '11:00'), t.sh('front_desk', 1, '09:00', '11:00')), '22023'),
    ('day 7', 'S1', 902, v_cw, 0, jsonb_build_array(t.sh('front_desk', 7, '09:00', '11:00')), '22023'),
    ('fractional day', 'S1', 902, v_cw, 0, jsonb_build_array(jsonb_build_object('kind','front_desk','dayOfWeek',1.5,'startTime','09:00','endTime','10:00')), '22023'),
    ('string day', 'S1', 902, v_cw, 0, jsonb_build_array(jsonb_build_object('kind','front_desk','dayOfWeek','1','startTime','09:00','endTime','10:00')), '22023'),
    ('bad kind', 'S1', 902, v_cw, 0, jsonb_build_array(t.sh('tutoring', 1, '09:00', '11:00')), '22023'),
    ('bad time', 'S1', 902, v_cw, 0, jsonb_build_array(t.sh('front_desk', 1, '9:00', '11:00')), '22023'),
    ('24:00', 'S1', 902, v_cw, 0, jsonb_build_array(t.sh('front_desk', 1, '09:00', '24:00')), '22023'),
    ('end before start', 'S1', 902, v_cw, 0, jsonb_build_array(t.sh('front_desk', 1, '11:00', '09:00')), '22023'),
    ('end equals start', 'S1', 902, v_cw, 0, jsonb_build_array(t.sh('front_desk', 1, '11:00', '11:00')), '22023'),
    ('not an array', 'S1', 902, v_cw, 0, '{"kind":"front_desk"}'::jsonb, '22023'),
    ('null shifts', 'S1', 902, v_cw, 0, NULL, '22023'),
    ('non-object entry', 'S1', 902, v_cw, 0, '[1]'::jsonb, '22023'),
    ('Tuesday week start', 'S1', 902, v_cw + 1, 0, v_ok, '22023'),
    ('past week', 'S1', 902, v_cw - 7, 0, v_ok, 'CS422'),
    ('inactive semester', 'S1', 901, v_cw, 0, v_ok, 'CS422'),
    ('unknown semester', 'S1', 12345, v_cw, 0, v_ok, 'CS422'),
    ('week after semester', 'S1', 902, v_cw + 7 * 13, 0, v_ok, 'CS422'),
    ('unknown scholar', 'NOPE', 902, v_cw, 0, v_ok, 'CS404'),
    ('non-scholar roster member', 'TL1', 902, v_cw, 0, v_ok, 'CS404'),
    ('stale revision', 'S1', 902, v_cw, 7, v_ok, 'CS409'),
    ('negative revision', 'S1', 902, v_cw, -1, v_ok, 'CS409')
  ) AS c(label, uid, sem, wk, rev, shifts, code) LOOP
    PERFORM t.assert(
      t.sqlstate_of(format('SELECT public.replace_scholar_schedule_from_week(%L, %s, %L, %s, %L)',
        v_case.uid, v_case.sem, v_case.wk, v_case.rev, v_case.shifts)) = v_case.code,
      'validation case: ' || v_case.label);
  END LOOP;

  PERFORM t.assert(t.sqlstate_of(format('SELECT public.replace_scholar_schedule_from_week(NULL, 902, %L, 0, %L)', v_cw, v_ok)) = '22023', 'null scholar');
  PERFORM t.assert(t.sqlstate_of(format('SELECT public.replace_scholar_schedule_from_week(%L, 902, %L, NULL, %L)', 'S1', v_cw, v_ok)) = '22023', 'null expected revision');
  PERFORM t.logout();

  PERFORM t.assert(t.revision('S1') = v_before, 'rejected calls left the revision alone');
  PERFORM t.assert((SELECT count(*) FROM public.scholar_shift_assignments) = v_rows, 'rejected calls changed no rows');
  PERFORM t.assert((SELECT count(*) FROM public.scholar_schedule_revisions WHERE scholar_id = 'NOPE') = 0, 'unknown scholar got no revision row');
END $$;

-- Add, move, remove, clear, restore ------------------------------------------
DO $$
DECLARE
  v_cw date := t.cw();
  v_a1 uuid := '00000000-0000-0000-0000-0000000000a1';
  v_a2 uuid := '00000000-0000-0000-0000-0000000000a2';
  v_snap jsonb;
  v_fridays uuid;
  v_base text;
BEGIN
  PERFORM t.login('11111111-1111-1111-1111-111111111111');

  PERFORM t.assert(t.week_shifts('S1', v_cw) = 'front_desk:1:09:00-11:00,study_session:2:14:00-16:00', 'baseline snapshot this week');

  -- identical save keeps ids, extends nothing earlier, bumps revision
  v_snap := t.replace('S1', v_cw, 0, jsonb_build_array(t.sh('front_desk', 1, '09:00', '11:00'), t.sh('study_session', 2, '14:00', '16:00')));
  PERFORM t.assert((v_snap -> 'scholars' -> 0 ->> 'revision')::bigint = 1, 'revision returned');
  PERFORM t.assert((SELECT count(*) FROM public.scholar_shift_assignments WHERE scholar_id = 'S1') = 2, 'identical save adds no rows');
  PERFORM t.assert((SELECT effective_from = v_cw - 28 FROM public.scholar_shift_assignments WHERE id = v_a1), 'identical save keeps the original start');

  -- add a Friday FD
  PERFORM t.replace('S1', v_cw, 1, jsonb_build_array(
    t.sh('front_desk', 1, '09:00', '11:00'), t.sh('study_session', 2, '14:00', '16:00'), t.sh('front_desk', 5, '13:00', '15:00')));
  PERFORM t.assert(t.week_shifts('S1', v_cw - 7) = 'front_desk:1:09:00-11:00,study_session:2:14:00-16:00', 'past week is untouched by an add');
  PERFORM t.assert(t.week_shifts('S1', v_cw) = 'front_desk:1:09:00-11:00,study_session:2:14:00-16:00,front_desk:5:13:00-15:00', 'current week has the add');
  PERFORM t.assert(t.week_shifts('S1', v_cw + 21) = t.week_shifts('S1', v_cw), 'future weeks have the add');
  PERFORM t.assert((SELECT effective_from = v_cw AND effective_until = v_cw + 84 FROM public.scholar_shift_assignments WHERE session_kind = 'front_desk' AND day_of_week = 5 AND scholar_id = 'S1'), 'new row runs from the Monday to semester end');
  SELECT id INTO v_fridays FROM public.scholar_shift_assignments WHERE session_kind = 'front_desk' AND day_of_week = 5 AND scholar_id = 'S1';

  -- move Monday FD to 10:00-12:00 and the Friday FD to Thursday
  PERFORM t.replace('S1', v_cw, 2, jsonb_build_array(
    t.sh('front_desk', 1, '10:00', '12:00'), t.sh('study_session', 2, '14:00', '16:00'), t.sh('front_desk', 4, '13:00', '15:00')));
  PERFORM t.assert(t.week_shifts('S1', v_cw - 1 - 6) = 'front_desk:1:09:00-11:00,study_session:2:14:00-16:00', 'last week still shows the old Monday');
  PERFORM t.assert(t.week_shifts('S1', v_cw) = 'front_desk:1:10:00-12:00,study_session:2:14:00-16:00,front_desk:4:13:00-15:00', 'current week shows the moves');
  PERFORM t.assert((SELECT effective_until = v_cw FROM public.scholar_shift_assignments WHERE id = v_a1), 'moved row is truncated at the Monday, keeping its id and past');
  PERFORM t.assert(NOT EXISTS (SELECT 1 FROM public.scholar_shift_assignments WHERE id = v_fridays), 'a row that started at the boundary and moved is removed');
  PERFORM t.assert((SELECT effective_until = v_cw + 84 FROM public.scholar_shift_assignments WHERE id = v_a2), 'unchanged row keeps its id and runs on');

  -- remove the SS
  PERFORM t.replace('S1', v_cw, 3, jsonb_build_array(t.sh('front_desk', 1, '10:00', '12:00'), t.sh('front_desk', 4, '13:00', '15:00')));
  PERFORM t.assert(t.week_shifts('S1', v_cw) = 'front_desk:1:10:00-12:00,front_desk:4:13:00-15:00', 'removed shift is gone this week');
  PERFORM t.assert(t.week_shifts('S1', v_cw - 7) = 'front_desk:1:09:00-11:00,study_session:2:14:00-16:00', 'removed shift remains in history');
  PERFORM t.assert((SELECT effective_until = v_cw FROM public.scholar_shift_assignments WHERE id = v_a2), 'removed row truncated at the Monday');

  -- plan a future change, then restore the tail by saving the current schedule from an earlier Monday
  PERFORM t.replace('S1', v_cw + 14, 4, jsonb_build_array(t.sh('front_desk', 2, '08:00', '09:00')));
  PERFORM t.assert(t.week_shifts('S1', v_cw + 7) = 'front_desk:1:10:00-12:00,front_desk:4:13:00-15:00', 'week before the planned change is unchanged');
  PERFORM t.assert(t.week_shifts('S1', v_cw + 14) = 'front_desk:2:08:00-09:00', 'planned week shows the new plan');
  PERFORM t.assert(t.week_shifts('S1', v_cw + 70) = 'front_desk:2:08:00-09:00', 'plan runs to semester end');
  PERFORM t.assert((SELECT count(*) FROM public.scholar_shift_assignments WHERE scholar_id = 'S1' AND effective_from = v_cw + 14) = 1, 'one planned row');

  PERFORM t.replace('S1', v_cw + 7, 5, jsonb_build_array(t.sh('front_desk', 1, '10:00', '12:00'), t.sh('front_desk', 4, '13:00', '15:00')));
  PERFORM t.assert(t.week_shifts('S1', v_cw + 70) = 'front_desk:1:10:00-12:00,front_desk:4:13:00-15:00', 'saving from an earlier Monday replaces the whole planned tail');
  PERFORM t.assert((SELECT count(*) FROM public.scholar_shift_assignments WHERE scholar_id = 'S1' AND effective_from >= v_cw + 7) = 0, 'no superseded future rows remain');
  PERFORM t.assert((SELECT count(*) FROM public.scholar_shift_assignments WHERE scholar_id = 'S1' AND effective_from <= v_cw AND effective_until = v_cw + 84 AND session_kind = 'front_desk') = 2, 'current rows were extended instead of duplicated');

  -- clear
  PERFORM t.replace('S1', v_cw, 6, '[]'::jsonb);
  PERFORM t.assert(t.week_shifts('S1', v_cw) = '', 'clear empties this week');
  PERFORM t.assert(t.week_shifts('S1', v_cw + 28) = '', 'clear empties future weeks');
  PERFORM t.assert(t.week_shifts('S1', v_cw - 7) = 'front_desk:1:09:00-11:00,study_session:2:14:00-16:00', 'clear keeps history');
  PERFORM t.assert(t.revision('S1') = 7, 'clear bumps the revision');
  PERFORM t.assert((SELECT jsonb_array_length(public.get_schedule_snapshot(v_cw, 'S1') -> 'scholars') = 1), 'cleared scholar still listed');

  -- a scholar with no rows and no revision row: empty array creates the revision row
  PERFORM t.assert(t.revision('S4') IS NULL, 'S4 has no revision row yet');
  PERFORM t.replace('S4', v_cw, 0, '[]'::jsonb);
  PERFORM t.assert(t.revision('S4') = 1, 'first empty save creates and bumps the revision row');
  PERFORM t.logout();
END $$;

-- Target needs nothing but a roster row; board lists everyone ----------------
DO $$
DECLARE
  v_cw date := t.cw();
  v_snap jsonb;
BEGIN
  PERFORM t.login('11111111-1111-1111-1111-111111111111');
  PERFORM t.replace('S3', v_cw, 0, jsonb_build_array(t.sh('study_session', 3, '15:00', '16:30')));
  PERFORM t.assert(t.week_shifts('S3', v_cw) = 'study_session:3:15:00-16:30', 'roster-only scholar (no profile, no cohort, no hours) can be scheduled');
  PERFORM t.replace('S2', v_cw, 0, jsonb_build_array(t.sh('front_desk', 0, '12:00', '13:00')));
  PERFORM t.assert(t.week_shifts('S2', v_cw) = 'front_desk:0:12:00-13:00', 'Sunday shift works for a graduated roster row');

  v_snap := public.get_schedule_snapshot(v_cw);
  PERFORM t.assert((SELECT count(*) FROM jsonb_array_elements(v_snap -> 'scholars')) = (SELECT count(DISTINCT uid) FROM public.user_roster WHERE uid IS NOT NULL AND lower(btrim(program_role)) = 'scholar'), 'board lists every scholar and excludes non-scholars');
  PERFORM t.assert((v_snap -> 'semester' ->> 'id')::int = 902, 'board names the active semester');
  PERFORM t.assert((v_snap ->> 'currentWeekStart')::date = v_cw, 'board reports the server Eastern Monday');

  -- unknown semester yields an empty board, not an error
  PERFORM t.assert(jsonb_array_length(public.get_schedule_snapshot(v_cw, NULL, 424242) -> 'scholars') = 0, 'unknown semester board is empty');
  PERFORM t.logout();
END $$;

-- Semester clipping ---------------------------------------------------------
DO $$
DECLARE
  v_cw date := t.cw();
BEGIN
  UPDATE public.semesters SET start_date = v_cw + 2, end_date = v_cw + 9 WHERE id = 902;
  DELETE FROM public.scholar_shift_assignments;
  PERFORM t.login('11111111-1111-1111-1111-111111111111');
  PERFORM t.replace('S1', v_cw, t.revision('S1'), jsonb_build_array(t.sh('front_desk', 3, '10:00', '11:00')));
  PERFORM t.logout();
  PERFORM t.assert((SELECT effective_from = v_cw + 2 AND effective_until = v_cw + 10 FROM public.scholar_shift_assignments WHERE scholar_id = 'S1'), 'effective window clipped to semester dates');

  PERFORM t.login('11111111-1111-1111-1111-111111111111');
  PERFORM t.assert(t.sqlstate_of(format('SELECT t.replace(%L, %L, %s, %L)', 'S1', v_cw + 14, t.revision('S1'), '[]')) = 'CS422', 'week starting after semester end rejected');
  PERFORM t.logout();
END $$;

ROLLBACK;
