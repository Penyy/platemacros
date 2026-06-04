ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_targets_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_macro_targets jsonb;