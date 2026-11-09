-- entity_relations: directed bonds for the Clan & Lineage graph
--
--   rel = 'commands' | 'ally' | 'rival' | 'mentor' | 'kin'
--   source_id / target_id -> entities.id (either side may be any kind)
--
-- Public read; writes restricted to admins / superadmin.
-- Run in Supabase Dashboard -> SQL Editor (or Lovable -> Supabase -> SQL).

CREATE TABLE IF NOT EXISTS public.entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  target_id uuid NOT NULL,
  rel text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_relations_pair_key UNIQUE (source_id, target_id, rel),
  CONSTRAINT entity_relations_source_fkey
    FOREIGN KEY (source_id) REFERENCES public.entities(id) ON DELETE CASCADE,
  CONSTRAINT entity_relations_target_fkey
    FOREIGN KEY (target_id) REFERENCES public.entities(id) ON DELETE CASCADE,
  CONSTRAINT entity_relations_rel_check
    CHECK (rel IN ('commands', 'ally', 'rival', 'mentor', 'kin'))
);

CREATE INDEX IF NOT EXISTS entity_relations_source_idx ON public.entity_relations (source_id);
CREATE INDEX IF NOT EXISTS entity_relations_target_idx ON public.entity_relations (target_id);

ALTER TABLE public.entity_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read entity_relations" ON public.entity_relations;
CREATE POLICY "public read entity_relations" ON public.entity_relations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff insert entity_relations" ON public.entity_relations;
CREATE POLICY "staff insert entity_relations" ON public.entity_relations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff update entity_relations" ON public.entity_relations;
CREATE POLICY "staff update entity_relations" ON public.entity_relations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete entity_relations" ON public.entity_relations;
CREATE POLICY "staff delete entity_relations" ON public.entity_relations
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT ON public.entity_relations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.entity_relations TO authenticated;
