DROP POLICY IF EXISTS day_offs_select ON public.day_offs;
DROP POLICY IF EXISTS day_offs_insert ON public.day_offs;
DROP POLICY IF EXISTS day_offs_delete ON public.day_offs;
CREATE POLICY day_offs_select ON public.day_offs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY day_offs_insert ON public.day_offs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY day_offs_delete ON public.day_offs FOR DELETE TO authenticated USING (user_id = auth.uid());