-- Per-character ability assignments scoped to series/season with power level 1-5.
-- Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.character_abilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  ability_key text NOT NULL,
  series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  season_number integer,
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS character_abilities_entity_idx ON public.character_abilities(entity_id);

ALTER TABLE public.character_abilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read character_abilities" ON public.character_abilities;
CREATE POLICY "members read character_abilities" ON public.character_abilities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "members insert character_abilities" ON public.character_abilities;
CREATE POLICY "members insert character_abilities" ON public.character_abilities FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "members update character_abilities" ON public.character_abilities;
CREATE POLICY "members update character_abilities" ON public.character_abilities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "members delete character_abilities" ON public.character_abilities;
CREATE POLICY "members delete character_abilities" ON public.character_abilities FOR DELETE TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_abilities TO authenticated;

-- Arc role per series membership (protagonist / antagonist / antihero / support / legend / cameo / lead / custom)
ALTER TABLE public.series_characters
  ADD COLUMN IF NOT EXISTS arc_role text;
