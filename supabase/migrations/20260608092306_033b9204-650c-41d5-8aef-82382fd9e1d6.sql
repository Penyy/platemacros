CREATE OR REPLACE FUNCTION public.reset_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.food_entries WHERE user_id = uid;
  DELETE FROM public.foods        WHERE user_id = uid;
  DELETE FROM public.daily_burned WHERE user_id = uid;

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
$$;

REVOKE ALL ON FUNCTION public.reset_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_user_data() TO authenticated;