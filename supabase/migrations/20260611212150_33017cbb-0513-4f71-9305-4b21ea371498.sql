
CREATE TABLE public.day_offs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, DELETE ON public.day_offs TO authenticated;
GRANT ALL ON public.day_offs TO service_role;

ALTER TABLE public.day_offs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_offs_select" ON public.day_offs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "day_offs_insert" ON public.day_offs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "day_offs_delete" ON public.day_offs FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reset_user_data()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.food_entries WHERE user_id = uid;
  DELETE FROM public.foods        WHERE user_id = uid;
  DELETE FROM public.daily_burned WHERE user_id = uid;
  DELETE FROM public.day_offs     WHERE user_id = uid;

  UPDATE public.profiles SET
    goal_kcal = 2200,
    goal_protein = 130,
    goal_carbs = 250,
    goal_fat = 70,
    consider_burned = false,
    activity_profile = NULL,
    weekly_targets_enabled = false,
    weekly_macro_targets = NULL,
    assistant_settings = NULL
  WHERE id = uid;
END;
$function$;
