-- Team leaders can add/remove their own mentee assignments from Settings.
--
-- Reads already work through:
--   - "Mentors can read their own mentee relationships" (mentor_id = auth.uid())
--   - "team_leader_read_mentor_mentee" (is_team_leader_or_above())
--
-- Writes were developer-only (20260903053000_developer_write_user_roster.sql).
-- These policies scope writes to the caller's own assignments and only allow
-- enrolled scholars to be added. The existing mentor_mentee_sync trigger keeps
-- profiles.mentee_count and user_roster.mentee_uids/mentee_count in sync.

DROP POLICY IF EXISTS team_leader_insert_own_mentor_mentee ON public.mentor_mentee;
CREATE POLICY team_leader_insert_own_mentor_mentee ON public.mentor_mentee
  FOR INSERT
  TO authenticated
  WITH CHECK (
    mentor_id = (SELECT auth.uid())
    AND public.is_team_leader_or_above()
    AND EXISTS (
      SELECT 1
      FROM public.user_roster ur
      WHERE ur.uid = mentee_uid
        AND lower(ur.status) = 'enrolled'
        AND lower(ur.program_role) = 'scholar'
    )
  );

DROP POLICY IF EXISTS team_leader_delete_own_mentor_mentee ON public.mentor_mentee;
CREATE POLICY team_leader_delete_own_mentor_mentee ON public.mentor_mentee
  FOR DELETE
  TO authenticated
  USING (
    mentor_id = (SELECT auth.uid())
    AND public.is_team_leader_or_above()
  );
