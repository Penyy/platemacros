ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS fiber_g numeric,
  ADD COLUMN IF NOT EXISTS sugars_g numeric,
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric,
  ADD COLUMN IF NOT EXISTS sodium_mg numeric;

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS fiber_g numeric,
  ADD COLUMN IF NOT EXISTS sugars_g numeric,
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric,
  ADD COLUMN IF NOT EXISTS sodium_mg numeric;