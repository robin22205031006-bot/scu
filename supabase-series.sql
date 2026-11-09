-- Series / story arcs: series table + per-series character status bridge.
CREATE TABLE IF NOT EXISTS public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.series_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL,
  character_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'Unknown',
  role_in_series text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT series_characters_pair_key UNIQUE (series_id, character_id),
  CONSTRAINT series_characters_series_fkey
    FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE,
  CONSTRAINT series_characters_character_fkey
    FOREIGN KEY (character_id) REFERENCES public.entities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS series_characters_series_idx
  ON public.series_characters (series_id);
CREATE INDEX IF NOT EXISTS series_characters_character_idx
  ON public.series_characters (character_id);

ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read series" ON public.series;
CREATE POLICY "public read series" ON public.series
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read series_characters" ON public.series_characters;
CREATE POLICY "public read series_characters" ON public.series_characters
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff insert series" ON public.series;
CREATE POLICY "staff insert series" ON public.series
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff update series" ON public.series;
CREATE POLICY "staff update series" ON public.series
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete series" ON public.series;
CREATE POLICY "staff delete series" ON public.series
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff insert series_characters" ON public.series_characters;
CREATE POLICY "staff insert series_characters" ON public.series_characters
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff update series_characters" ON public.series_characters;
CREATE POLICY "staff update series_characters" ON public.series_characters
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete series_characters" ON public.series_characters;
CREATE POLICY "staff delete series_characters" ON public.series_characters
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT ON public.series TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT SELECT ON public.series_characters TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.series_characters TO authenticated;

-- Merge preservation: when merge_entities() removes the secondary entity, its
-- series_characters rows would cascade away. Re-point them to the primary first
-- and drop duplicate (series_id, character_id) pairs. Run this BEFORE the RPC
-- (the merge dialog does this client-side; this function is a server-side helper).
CREATE OR REPLACE FUNCTION public.remap_series_characters(p_primary uuid, p_secondary uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.series_characters') IS NULL THEN RETURN; END IF;
  IF p_primary IS NULL OR p_secondary IS NULL OR p_primary = p_secondary THEN RETURN; END IF;
  DELETE FROM public.series_characters a
  USING public.series_characters b
  WHERE a.character_id = p_secondary
    AND b.character_id = p_primary
    AND a.series_id = b.series_id;
  UPDATE public.series_characters
    SET character_id = p_primary
    WHERE character_id = p_secondary;
END;
$$;

REVOKE ALL ON FUNCTION public.remap_series_characters(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remap_series_characters(uuid, uuid) TO authenticated, service_role;
