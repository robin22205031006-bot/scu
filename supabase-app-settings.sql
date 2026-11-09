-- Admin-controlled typography & theme settings (single JSON document per key).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read app_settings" ON public.app_settings;
CREATE POLICY "public read app_settings" ON public.app_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff write app_settings" ON public.app_settings;
CREATE POLICY "staff write app_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
