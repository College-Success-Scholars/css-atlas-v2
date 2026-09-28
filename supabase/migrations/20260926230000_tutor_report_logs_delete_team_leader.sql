-- Allow TL+ to delete single tutor_report_logs rows via the Express JWT client
-- (DELETE /api/tutor-reports/:id). Keeps admin_delete_tutor_logs (admin/staff);
-- permissive policies are OR'd, so scholars remain blocked.

CREATE POLICY "team_leader_delete_tutor_logs"
  ON public.tutor_report_logs
  FOR DELETE
  TO authenticated
  USING (public.is_team_leader_or_above());
