
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  type text,
  rating int,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_message_len CHECK (char_length(message) BETWEEN 5 AND 2000),
  CONSTRAINT feedback_rating_range CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  CONSTRAINT feedback_type_valid CHECK (type IS NULL OR type IN ('bug','suggestion','other'))
);

GRANT INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX feedback_user_created_idx ON public.feedback(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.feedback_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hourly_count int;
  daily_count int;
  dup_count int;
BEGIN
  SELECT count(*) INTO hourly_count
    FROM public.feedback
    WHERE user_id = NEW.user_id
      AND created_at > now() - interval '1 hour';
  IF hourly_count >= 3 THEN
    RAISE EXCEPTION 'Limit: maks. 3 opinie na godzinę' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO daily_count
    FROM public.feedback
    WHERE user_id = NEW.user_id
      AND created_at > now() - interval '1 day';
  IF daily_count >= 10 THEN
    RAISE EXCEPTION 'Limit: maks. 10 opinii na dobę' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO dup_count
    FROM public.feedback
    WHERE user_id = NEW.user_id
      AND message = NEW.message
      AND created_at > now() - interval '10 minutes';
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Już wysłałeś identyczną opinię niedawno' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER feedback_rate_limit_trg
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_rate_limit();
