-- Run in the Supabase SQL editor before deploying this update.
CREATE TABLE IF NOT EXISTS public.usage_counters (
  key text PRIMARY KEY,
  used integer NOT NULL,
  resets_at timestamptz NOT NULL
);
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.consume_usage(usage_key text, max_usage integer, window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE counter integer;
BEGIN
  INSERT INTO usage_counters(key, used, resets_at)
  VALUES (usage_key, 1, now() + make_interval(secs => window_seconds))
  ON CONFLICT (key) DO UPDATE SET
    used = CASE WHEN usage_counters.resets_at <= now() THEN 1 ELSE usage_counters.used + 1 END,
    resets_at = CASE WHEN usage_counters.resets_at <= now() THEN now() + make_interval(secs => window_seconds) ELSE usage_counters.resets_at END
  WHERE usage_counters.resets_at <= now() OR usage_counters.used < max_usage
  RETURNING used INTO counter;
  RETURN counter IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_usage(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_usage(text, integer, integer) TO service_role;
