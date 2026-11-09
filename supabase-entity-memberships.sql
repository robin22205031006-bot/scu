-- entity_memberships: bidirectional character <-> group links
--
--   character_id -> entities.id (kind = 'character')
--   group_id     -> entities.id (kind = 'organization' | 'clan' | 'bloodline' | 'faction')
--   status       -> 'Current' | 'Former' (free text, editable)
--
-- Public read (same as entities); writes restricted to admins / superadmin.
-- Run in Supabase Dashboard -> SQL Editor (or Lovable -> Supabase -> SQL).

CREATE TABLE IF NOT EXISTS public.entity_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL,
  group_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'Current',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_memberships_pair_key UNIQUE (character_id, group_id),
  CONSTRAINT entity_memberships_character_fkey
    FOREIGN KEY (character_id) REFERENCES public.entities(id) ON DELETE CASCADE,
  CONSTRAINT entity_memberships_group_fkey
    FOREIGN KEY (group_id) REFERENCES public.entities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS entity_memberships_character_idx
  ON public.entity_memberships (character_id);
CREATE INDEX IF NOT EXISTS entity_memberships_group_idx
  ON public.entity_memberships (group_id);

ALTER TABLE public.entity_memberships ENABLE ROW LEVEL SECURITY;

-- Anyone can read memberships (the archive is publicly browsable).
DROP POLICY IF EXISTS "public read entity_memberships" ON public.entity_memberships;
CREATE POLICY "public read entity_memberships" ON public.entity_memberships
  FOR SELECT USING (true);

-- Writes: authenticated admins or the hardcoded superadmin only.
DROP POLICY IF EXISTS "staff insert entity_memberships" ON public.entity_memberships;
CREATE POLICY "staff insert entity_memberships" ON public.entity_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff update entity_memberships" ON public.entity_memberships;
CREATE POLICY "staff update entity_memberships" ON public.entity_memberships
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete entity_memberships" ON public.entity_memberships;
CREATE POLICY "staff delete entity_memberships" ON public.entity_memberships
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT ON public.entity_memberships TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.entity_memberships TO authenticated;
