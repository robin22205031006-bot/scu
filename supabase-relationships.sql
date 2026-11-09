-- ============================================================
-- SCU ARCHIVE — Character relationships + org hierarchy
-- Safe to run repeatedly.
-- ============================================================

-- ---------- 1) character_relationships: typed bonds between characters ----------
CREATE TABLE IF NOT EXISTS public.character_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id_1 uuid NOT NULL,
  character_id_2 uuid NOT NULL,
  relationship_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_relationships_pair_key
    UNIQUE (character_id_1, character_id_2, relationship_type),
  CONSTRAINT character_relationships_c1_fkey
    FOREIGN KEY (character_id_1) REFERENCES public.entities(id) ON DELETE CASCADE,
  CONSTRAINT character_relationships_c2_fkey
    FOREIGN KEY (character_id_2) REFERENCES public.entities(id) ON DELETE CASCADE,
  CONSTRAINT character_relationships_distinct_check
    CHECK (character_id_1 <> character_id_2),
  CONSTRAINT character_relationships_type_check
    CHECK (relationship_type IN (
      'father_son', 'mother_daughter', 'parent_child',
      'brother_sister', 'brother_brother', 'sister_sister', 'siblings',
      'lovers', 'spouses', 'best_friends', 'rivals',
      'mentor_student', 'ally', 'enemy'
    ))
);

CREATE INDEX IF NOT EXISTS character_relationships_c1_idx ON public.character_relationships (character_id_1);
CREATE INDEX IF NOT EXISTS character_relationships_c2_idx ON public.character_relationships (character_id_2);

ALTER TABLE public.character_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read character_relationships" ON public.character_relationships;
CREATE POLICY "public read character_relationships" ON public.character_relationships
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff insert character_relationships" ON public.character_relationships;
CREATE POLICY "staff insert character_relationships" ON public.character_relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff update character_relationships" ON public.character_relationships;
CREATE POLICY "staff update character_relationships" ON public.character_relationships
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete character_relationships" ON public.character_relationships;
CREATE POLICY "staff delete character_relationships" ON public.character_relationships
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT ON public.character_relationships TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.character_relationships TO authenticated;

-- ---------- 2) entities.parent_id: branch org / sub-faction hierarchy ----------
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS entities_parent_idx ON public.entities (parent_id)
  WHERE parent_id IS NOT NULL;
