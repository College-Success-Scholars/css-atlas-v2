DROP POLICY IF EXISTS "Enable read access for all users" ON public.mcf_form_logs;
CREATE POLICY mcf_select_own_or_leaders ON public.mcf_form_logs
  FOR SELECT TO authenticated
  USING (
    mentor_uid = (SELECT auth.uid())::text
    OR mentee_uid = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.app_role = ANY (ARRAY['admin','staff','team_leader','developer'])
    )
  );

DROP POLICY IF EXISTS "Enable read access for all users" ON public.wpl_form_logs;
CREATE POLICY wpl_select_own_or_leaders ON public.wpl_form_logs
  FOR SELECT TO authenticated
  USING (
    scholar_uid = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.app_role = ANY (ARRAY['admin','staff','team_leader','developer'])
    )
  );