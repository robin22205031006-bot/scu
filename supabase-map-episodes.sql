-- ============================================================
-- SCU ARCHIVE — Tactical Map pins + Episode drafts
-- Safe to run repeatedly (IF NOT EXISTS / OR REPLACE / DROP+CREATE)
-- ============================================================

-- ---------- 1) map_locations: tactical map pins ----------
CREATE TABLE IF NOT EXISTS public.map_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pos_x double precision NOT NULL DEFAULT 50,
  pos_y double precision NOT NULL DEFAULT 50,
  era text,
  faction text,
  report text NOT NULL DEFAULT '',
  battles text NOT NULL DEFAULT '',
  sentinels text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT map_locations_coords_check
    CHECK (pos_x >= 0 AND pos_x <= 100 AND pos_y >= 0 AND pos_y <= 100)
);

CREATE INDEX IF NOT EXISTS map_locations_name_idx ON public.map_locations (name);

ALTER TABLE public.map_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read map_locations" ON public.map_locations;
CREATE POLICY "public read map_locations" ON public.map_locations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff insert map_locations" ON public.map_locations;
CREATE POLICY "staff insert map_locations" ON public.map_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff update map_locations" ON public.map_locations;
CREATE POLICY "staff update map_locations" ON public.map_locations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete map_locations" ON public.map_locations;
CREATE POLICY "staff delete map_locations" ON public.map_locations
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT ON public.map_locations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.map_locations TO authenticated;

-- ---------- 2) episodes: admin-drafted story chapters ----------
CREATE TABLE IF NOT EXISTS public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  series text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT episodes_status_check CHECK (status IN ('draft', 'published'))
);

CREATE INDEX IF NOT EXISTS episodes_status_idx ON public.episodes (status);

ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

-- Public can read published episodes only; drafts are staff-only.
DROP POLICY IF EXISTS "public read published episodes" ON public.episodes;
CREATE POLICY "public read published episodes" ON public.episodes
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "staff read episodes" ON public.episodes;
CREATE POLICY "staff read episodes" ON public.episodes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff insert episodes" ON public.episodes;
CREATE POLICY "staff insert episodes" ON public.episodes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff update episodes" ON public.episodes;
CREATE POLICY "staff update episodes" ON public.episodes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete episodes" ON public.episodes;
CREATE POLICY "staff delete episodes" ON public.episodes
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT ON public.episodes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
