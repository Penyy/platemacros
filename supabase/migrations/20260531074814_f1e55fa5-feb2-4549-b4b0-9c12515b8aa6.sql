-- Helper: updated_at trigger function (re-used)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- profiles: 1 row per auth user (id == auth.users.id)
-- =====================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_kcal INTEGER NOT NULL DEFAULT 2200,
  goal_protein NUMERIC NOT NULL DEFAULT 130,
  goal_carbs NUMERIC NOT NULL DEFAULT 250,
  goal_fat NUMERIC NOT NULL DEFAULT 70,
  theme TEXT NOT NULL DEFAULT 'system',
  consider_burned BOOLEAN NOT NULL DEFAULT false,
  activity_profile JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users delete own profile"
  ON public.profiles FOR DELETE TO authenticated
  USING (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- food_entries: logged meal items
-- =====================================================================
CREATE TABLE public.food_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
  name TEXT NOT NULL,
  grams NUMERIC,
  kcal NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  sub_items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_food_entries_user_date ON public.food_entries(user_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_entries TO authenticated;
GRANT ALL ON public.food_entries TO service_role;

ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own entries"
  ON public.food_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own entries"
  ON public.food_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own entries"
  ON public.food_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own entries"
  ON public.food_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================================
-- foods: user's product library (per 100 g)
-- =====================================================================
CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kcal_100 NUMERIC NOT NULL DEFAULT 0,
  protein_100 NUMERIC NOT NULL DEFAULT 0,
  carbs_100 NUMERIC NOT NULL DEFAULT 0,
  fat_100 NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_foods_user ON public.foods(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.foods TO authenticated;
GRANT ALL ON public.foods TO service_role;

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own foods"
  ON public.foods FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own foods"
  ON public.foods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own foods"
  ON public.foods FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own foods"
  ON public.foods FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================================
-- daily_burned: burned kcal per day
-- =====================================================================
CREATE TABLE public.daily_burned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  burned_kcal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_daily_burned_user_date ON public.daily_burned(user_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_burned TO authenticated;
GRANT ALL ON public.daily_burned TO service_role;

ALTER TABLE public.daily_burned ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own burned"
  ON public.daily_burned FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own burned"
  ON public.daily_burned FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own burned"
  ON public.daily_burned FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own burned"
  ON public.daily_burned FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
