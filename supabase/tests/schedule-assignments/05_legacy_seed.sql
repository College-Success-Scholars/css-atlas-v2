-- Runs BEFORE the effective-dated migration to prove legacy rows convert correctly.
-- cw = the current Eastern Monday, computed inline because eastern_week_start does not exist yet.
BEGIN;

CREATE TEMP TABLE seed_cw AS
  SELECT date_trunc('week', now() AT TIME ZONE 'America/New_York')::date AS cw;

INSERT INTO public.user_roster (uid, first_name, last_name, status, program_role, cohort, fd_required, ss_required) VALUES
  ('S1', 'Sam', 'One', 'enrolled', 'Scholar', 2025, 120, 120),
  ('S2', 'Sue', 'Two', 'graduated', 'Scholar', NULL, NULL, NULL),
  ('S3', 'Sol', 'Three', NULL, 'Scholar', NULL, NULL, NULL),
  ('S4', 'Sky', 'Four', 'inactive', 'Scholar', NULL, 0, 0),
  ('TL1', 'Tess', 'Lead', 'enrolled', 'Team Leader', 2023, 0, 0);

INSERT INTO public.semesters (id, name, start_date, end_date, is_active)
SELECT 901, 'Old semester', cw - 140, cw - 63, false FROM seed_cw
UNION ALL
SELECT 902, 'Active semester', cw - 28, cw + 83, true FROM seed_cw;

INSERT INTO public.scholar_shift_assignments
  (id, scholar_id, semester_id, session_kind, day_of_week, start_time, end_time, is_active) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'S1', 902, 'front_desk',    1, '09:00', '11:00', true),
  ('00000000-0000-0000-0000-0000000000a2', 'S1', 902, 'study_session', 2, '14:00', '16:00', true),
  ('00000000-0000-0000-0000-0000000000a3', 'S1', 902, 'front_desk',    3, '10:00', '11:00', false),
  ('00000000-0000-0000-0000-0000000000b1', 'S2', 901, 'front_desk',    4, '09:00', '10:00', true),
  ('00000000-0000-0000-0000-0000000000c1', 'S3', 902, 'study_session', 5, '12:00', '13:00', false);

COMMIT;
