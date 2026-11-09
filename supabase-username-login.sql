-- Username-first login support.
-- display_name doubles as the unique username. Run once in the Supabase SQL editor.

-- 1) Lookup helper: resolves a username to the account email (anon-callable,
--    returns only the email — no other profile data leaks).
CREATE OR REPLACE FUNCTION public.lookup_login_email(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE lower(trim(display_name)) = lower(trim(p_username))
    AND email IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_login_email(text) TO anon, authenticated;

-- 2) Uniqueness guard: usernames must be unique (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_key
  ON public.profiles (lower(display_name))
  WHERE display_name IS NOT NULL;
