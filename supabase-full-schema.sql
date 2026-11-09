-- ============================================================================
-- SCU ARCHIVE — FULL CONSOLIDATED SCHEMA
-- Safe to paste into Supabase SQL Editor at any time.
-- Every statement is idempotent: CREATE ... IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS.
-- Existing data and policies on pre-existing tables are NOT touched.
-- ============================================================================

-- ---------- 0) Extensions ----------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- 1) Enum types ----------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.entity_kind AS ENUM ('character', 'organization', 'clan', 'bloodline', 'faction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 2) Core archive tables ----------
CREATE TABLE IF NOT EXISTS public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.entity_kind NOT NULL,
  name text NOT NULL,
  alias text,
  role text,
  status text NOT NULL DEFAULT 'Active',
  category text,
  description text NOT NULL DEFAULT '',
  image_url text,
  sketches text[] NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_fields text[] NOT NULL DEFAULT '{}',
  parent_id uuid,
  abilities text[] NOT NULL DEFAULT '{}',
  beast_traits text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

-- New columns for databases created before this migration:
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS alias text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS sketches text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS stats jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS locked_fields text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS abilities text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS beast_traits text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS character_tier text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS animation_style text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS theme_color text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS accent_glow text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS theme_song_url text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  ALTER TABLE public.entities
    ADD CONSTRAINT entities_parent_fkey
    FOREIGN KEY (parent_id) REFERENCES public.entities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS entities_parent_idx ON public.entities (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS entities_kind_idx ON public.entities (kind);
CREATE INDEX IF NOT EXISTS entities_name_idx ON public.entities (name);

CREATE TABLE IF NOT EXISTS public.lore_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  text text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lore_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS lore_notes_entity_idx ON public.lore_notes (entity_id);

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  era text,
  series text,
  impact integer NOT NULL DEFAULT 5,
  sort_order integer NOT NULL DEFAULT 0,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS timeline_events_sort_idx ON public.timeline_events (sort_order);

CREATE TABLE IF NOT EXISTS public.ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;

-- ---------- 3) Community / auth tables ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_key ON public.user_roles (user_id, role);

CREATE TABLE IF NOT EXISTS public.banned_users (
  user_id uuid PRIMARY KEY,
  banned_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.banned_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS comments_post_idx ON public.comments (post_id);

CREATE TABLE IF NOT EXISTS public.post_votes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log (created_at DESC);

CREATE TABLE IF NOT EXISTS public.vault_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_path text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  downloadable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

-- ---------- 4) Series / story arcs ----------
CREATE TABLE IF NOT EXISTS public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.series_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Unknown',
  role_in_series text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT series_characters_pair_key UNIQUE (series_id, character_id)
);
ALTER TABLE public.series_characters ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS series_characters_series_idx ON public.series_characters (series_id);
CREATE INDEX IF NOT EXISTS series_characters_character_idx ON public.series_characters (character_id);
CREATE UNIQUE INDEX IF NOT EXISTS series_characters_pair_key ON public.series_characters (series_id, character_id);

-- ---------- 5) Memberships / relations / hierarchy ----------
CREATE TABLE IF NOT EXISTS public.entity_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Current',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_memberships_pair_key UNIQUE (character_id, group_id)
);
ALTER TABLE public.entity_memberships ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS entity_memberships_character_idx ON public.entity_memberships (character_id);
CREATE INDEX IF NOT EXISTS entity_memberships_group_idx ON public.entity_memberships (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS entity_memberships_pair_key ON public.entity_memberships (character_id, group_id);

CREATE TABLE IF NOT EXISTS public.entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  rel text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_relations_pair_key UNIQUE (source_id, target_id, rel),
  CONSTRAINT entity_relations_rel_check
    CHECK (rel IN ('commands', 'ally', 'rival', 'mentor', 'kin'))
);
ALTER TABLE public.entity_relations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS entity_relations_source_idx ON public.entity_relations (source_id);
CREATE INDEX IF NOT EXISTS entity_relations_target_idx ON public.entity_relations (target_id);
CREATE UNIQUE INDEX IF NOT EXISTS entity_relations_pair_key ON public.entity_relations (source_id, target_id, rel);

CREATE TABLE IF NOT EXISTS public.character_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id_1 uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  character_id_2 uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_relationships_pair_key
    UNIQUE (character_id_1, character_id_2, relationship_type),
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
ALTER TABLE public.character_relationships ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS character_relationships_c1_idx ON public.character_relationships (character_id_1);
CREATE INDEX IF NOT EXISTS character_relationships_c2_idx ON public.character_relationships (character_id_2);
CREATE UNIQUE INDEX IF NOT EXISTS character_relationships_pair_key
  ON public.character_relationships (character_id_1, character_id_2, relationship_type);

-- ---------- 6) App settings / map / episodes ----------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.map_locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS map_locations_name_idx ON public.map_locations (name);

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
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS episodes_status_idx ON public.episodes (status);

-- ---------- 7) PDF vault + vector chunks ----------
CREATE TABLE IF NOT EXISTS public.pdf_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'processing',
  chunk_count integer NOT NULL DEFAULT 0,
  CONSTRAINT pdf_vault_status_check CHECK (status IN ('processing', 'ready', 'error'))
);
ALTER TABLE public.pdf_vault ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS pdf_vault_uploaded_idx ON public.pdf_vault (uploaded_at DESC);

CREATE TABLE IF NOT EXISTS public.pdf_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id uuid NOT NULL REFERENCES public.pdf_vault(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content_text text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_chunks_pair_key UNIQUE (pdf_id, chunk_index)
);
ALTER TABLE public.pdf_chunks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS pdf_chunks_pdf_idx ON public.pdf_chunks (pdf_id);
CREATE UNIQUE INDEX IF NOT EXISTS pdf_chunks_pair_key ON public.pdf_chunks (pdf_id, chunk_index);
CREATE INDEX IF NOT EXISTS pdf_chunks_embedding_idx
  ON public.pdf_chunks USING hnsw (embedding vector_cosine_ops);

-- ---------- 8) Helper functions ----------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role)
      OR public.has_role(_uid, 'moderator'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_banned(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.banned_users WHERE user_id = _uid);
$$;

-- Superadmin bootstrap: grant 'admin' role on signup for the fixed email,
-- and mirror auth.users into public.profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'zananrobin@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- 9) Vector similarity search (chat RAG) ----------
CREATE OR REPLACE FUNCTION public.match_pdf_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 8
)
RETURNS TABLE (
  pdf_id uuid,
  file_name text,
  chunk_index integer,
  content_text text,
  similarity double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.pdf_id, v.file_name, c.chunk_index, c.content_text,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.pdf_chunks c
  JOIN public.pdf_vault v ON v.id = c.pdf_id
  WHERE c.embedding IS NOT NULL
    AND v.status = 'ready'
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 50);
$$;
REVOKE ALL ON FUNCTION public.match_pdf_chunks(vector, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_pdf_chunks(vector, integer) TO authenticated, anon;

-- ---------- 10) merge_entities(): non-destructive entity merge ----------
CREATE OR REPLACE FUNCTION public.merge_entities(primary_id uuid, secondary_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.entities%ROWTYPE;
  s public.entities%ROWTYPE;
  notes_moved integer;
  merged_alias text;
  merged_role text;
  merged_desc text;
  dropped_fields text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'zananrobin@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Only admins can merge entities';
  END IF;
  IF primary_id = secondary_id THEN
    RAISE EXCEPTION 'Cannot merge an entity into itself';
  END IF;

  SELECT * INTO p FROM public.entities WHERE id = primary_id;
  SELECT * INTO s FROM public.entities WHERE id = secondary_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Primary entity % not found', primary_id; END IF;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Secondary entity % not found', secondary_id; END IF;

  UPDATE public.lore_notes SET entity_id = primary_id WHERE entity_id = secondary_id;
  GET DIAGNOSTICS notes_moved = ROW_COUNT;

  IF to_regclass('public.entity_memberships') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM public.entity_memberships a
      USING public.entity_memberships b
      WHERE a.character_id = $1 AND b.character_id = $2
        AND a.group_id = b.group_id
    $q$ USING secondary_id, primary_id;
    EXECUTE $q$
      DELETE FROM public.entity_memberships a
      USING public.entity_memberships b
      WHERE a.group_id = $1 AND b.group_id = $2
        AND a.character_id = b.character_id
    $q$ USING secondary_id, primary_id;
    EXECUTE 'UPDATE public.entity_memberships SET character_id = $1 WHERE character_id = $2'
      USING primary_id, secondary_id;
    EXECUTE 'UPDATE public.entity_memberships SET group_id = $1 WHERE group_id = $2'
      USING primary_id, secondary_id;
  END IF;

  IF to_regclass('public.series_characters') IS NOT NULL THEN
    PERFORM public.remap_series_characters(primary_id, secondary_id);
  END IF;

  -- Remap typed character relationships onto the primary entity.
  IF to_regclass('public.character_relationships') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM public.character_relationships a
      USING public.character_relationships b
      WHERE a.character_id_1 = $1 AND a.character_id_2 = $2
         OR a.character_id_1 = $2 AND a.character_id_2 = $1
    $q$ USING primary_id, secondary_id;
    EXECUTE 'UPDATE public.character_relationships SET character_id_1 = $1 WHERE character_id_1 = $2'
      USING primary_id, secondary_id;
    EXECUTE 'UPDATE public.character_relationships SET character_id_2 = $1 WHERE character_id_2 = $2'
      USING primary_id, secondary_id;
  END IF;

  -- Reparent children of the secondary entity onto the primary.
  UPDATE public.entities SET parent_id = primary_id
    WHERE parent_id = secondary_id AND id <> primary_id;

  SELECT string_agg(DISTINCT v, ' · ' ORDER BY v) INTO merged_alias
  FROM unnest(ARRAY[
    NULLIF(p.alias, ''),
    NULLIF(s.alias, ''),
    NULLIF(s.name, '')
  ]) AS t(v)
  WHERE v IS NOT NULL
    AND lower(v) <> lower(p.name);

  SELECT string_agg(DISTINCT v, ' · ' ORDER BY v) INTO merged_role
  FROM unnest(ARRAY[NULLIF(p.role, ''), NULLIF(s.role, '')]) AS t(v)
  WHERE v IS NOT NULL;

  merged_desc := CASE
    WHEN COALESCE(s.description, '') = '' THEN p.description
    WHEN COALESCE(p.description, '') = '' THEN s.description
    WHEN position(s.description IN p.description) > 0 THEN p.description
    ELSE p.description || E'\n\n[Merged Info]:\n' || s.description
  END;

  dropped_fields := concat_ws(' | ',
    CASE WHEN s.kind IS DISTINCT FROM p.kind THEN format('kind=%s', s.kind) END,
    CASE WHEN s.status IS DISTINCT FROM p.status THEN format('status=%s', s.status) END,
    CASE WHEN s.category IS DISTINCT FROM p.category THEN format('category=%s', s.category) END
  );

  UPDATE public.entities SET
    alias = merged_alias,
    role = merged_role,
    category = COALESCE(p.category, s.category),
    description = merged_desc,
    image_url = COALESCE(p.image_url, s.image_url),
    sketches = (
      SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[])
      FROM unnest(COALESCE(p.sketches, '{}'::text[]) || COALESCE(s.sketches, '{}'::text[])) AS x
    ),
    abilities = (
      SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[])
      FROM unnest(COALESCE(p.abilities, '{}'::text[]) || COALESCE(s.abilities, '{}'::text[])) AS x
    ),
    beast_traits = (
      SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[])
      FROM unnest(COALESCE(p.beast_traits, '{}'::text[]) || COALESCE(s.beast_traits, '{}'::text[])) AS x
    ),
    stats = CASE
      WHEN jsonb_typeof(COALESCE(p.stats::jsonb, '{}'::jsonb)) = 'object'
       AND jsonb_typeof(COALESCE(s.stats::jsonb, '{}'::jsonb)) = 'object'
        THEN COALESCE(s.stats::jsonb, '{}'::jsonb) || COALESCE(p.stats::jsonb, '{}'::jsonb)
      ELSE COALESCE(p.stats::jsonb, s.stats::jsonb)
    END,
    locked_fields = (
      SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[])
      FROM unnest(COALESCE(p.locked_fields, '{}'::text[]) || COALESCE(s.locked_fields, '{}'::text[])) AS x
    ),
    updated_at = now()
  WHERE id = primary_id;

  INSERT INTO public.lore_notes (entity_id, text, source)
  VALUES (
    primary_id,
    format(
      '[merge] Merged "%s" into this entry. %s lore note(s) transferred.%s',
      s.name,
      notes_moved,
      CASE WHEN dropped_fields <> '' THEN format(' Secondary-only fields: %s.', dropped_fields) ELSE '' END
    ),
    'Admin merge'
  );

  DELETE FROM public.entities WHERE id = secondary_id;

  RETURN jsonb_build_object(
    'primary_id', primary_id,
    'merged_id', secondary_id,
    'merged_name', s.name,
    'notes_moved', notes_moved,
    'dropped_fields', dropped_fields
  );
END;
$$;
REVOKE ALL ON FUNCTION public.merge_entities(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_entities(uuid, uuid) TO anon, authenticated, service_role;

-- ---------- 11) remap_series_characters() ----------
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

-- ============================================================================
-- RLS POLICIES — new feature tables only.
-- Policies for the original community/archive tables already exist in the
-- live database and are intentionally NOT recreated here.
-- ============================================================================

-- Public reads
DROP POLICY IF EXISTS "public read series" ON public.series;
CREATE POLICY "public read series" ON public.series FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read series_characters" ON public.series_characters;
CREATE POLICY "public read series_characters" ON public.series_characters FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read entity_memberships" ON public.entity_memberships;
CREATE POLICY "public read entity_memberships" ON public.entity_memberships FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read entity_relations" ON public.entity_relations;
CREATE POLICY "public read entity_relations" ON public.entity_relations FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read character_relationships" ON public.character_relationships;
CREATE POLICY "public read character_relationships" ON public.character_relationships FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read map_locations" ON public.map_locations;
CREATE POLICY "public read map_locations" ON public.map_locations FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read app_settings" ON public.app_settings;
CREATE POLICY "public read app_settings" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read pdf_vault" ON public.pdf_vault;
CREATE POLICY "public read pdf_vault" ON public.pdf_vault FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read published episodes" ON public.episodes;
CREATE POLICY "public read published episodes" ON public.episodes FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "public read vault_documents" ON public.vault_documents;
CREATE POLICY "public read vault_documents" ON public.vault_documents
  FOR SELECT USING (is_public = true OR auth.role() = 'authenticated');

-- Staff writes (admin role or hardcoded superadmin email)
DO $$
DECLARE
  t text;
  staff_tables text[] := ARRAY[
    'series', 'series_characters', 'entity_memberships', 'entity_relations',
    'character_relationships', 'map_locations', 'app_settings',
    'pdf_vault', 'pdf_chunks', 'vault_documents', 'entities',
    'lore_notes', 'timeline_events', 'ingest_jobs', 'banned_words', 'posts'
  ];
BEGIN
  FOREACH t IN ARRAY staff_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "staff insert %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "staff insert %I" ON public.%I FOR INSERT TO authenticated
       WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role)
                   OR lower(auth.jwt() ->> ''email'') = ''zananrobin@gmail.com'')', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "staff update %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "staff update %I" ON public.%I FOR UPDATE TO authenticated
       USING (public.has_role(auth.uid(), ''admin''::public.app_role)
              OR lower(auth.jwt() ->> ''email'') = ''zananrobin@gmail.com'')
       WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role)
                   OR lower(auth.jwt() ->> ''email'') = ''zananrobin@gmail.com'')', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "staff delete %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "staff delete %I" ON public.%I FOR DELETE TO authenticated
       USING (public.has_role(auth.uid(), ''admin''::public.app_role)
              OR lower(auth.jwt() ->> ''email'') = ''zananrobin@gmail.com'')', t, t);
  END LOOP;
END $$;

-- Episodes: staff can also read drafts.
DROP POLICY IF EXISTS "staff read episodes" ON public.episodes;
CREATE POLICY "staff read episodes" ON public.episodes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com');

-- pdf_chunks: staff-only direct reads (chat uses the security-definer RPC).
DROP POLICY IF EXISTS "staff read pdf_chunks" ON public.pdf_chunks;
CREATE POLICY "staff read pdf_chunks" ON public.pdf_chunks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com');

-- Community tables keep member-write access.
DROP POLICY IF EXISTS "members insert posts" ON public.posts;
CREATE POLICY "members insert posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "members update own posts" ON public.posts;
CREATE POLICY "members update own posts" ON public.posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "members delete own posts" ON public.posts;
CREATE POLICY "members delete own posts" ON public.posts FOR DELETE TO authenticated
  USING (author_id = auth.uid());
DROP POLICY IF EXISTS "public read posts" ON public.posts;
CREATE POLICY "public read posts" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "members insert comments" ON public.comments;
CREATE POLICY "members insert comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "members delete own comments" ON public.comments;
CREATE POLICY "members delete own comments" ON public.comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());
DROP POLICY IF EXISTS "public read comments" ON public.comments;
CREATE POLICY "public read comments" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "members insert post_votes" ON public.post_votes;
CREATE POLICY "members insert post_votes" ON public.post_votes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "members delete own post_votes" ON public.post_votes;
CREATE POLICY "members delete own post_votes" ON public.post_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "public read post_votes" ON public.post_votes;
CREATE POLICY "public read post_votes" ON public.post_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read banned_words" ON public.banned_words;
CREATE POLICY "public read banned_words" ON public.banned_words FOR SELECT USING (true);
DROP POLICY IF EXISTS "staff read banned_users" ON public.banned_users;
CREATE POLICY "staff read banned_users" ON public.banned_users FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com');
DROP POLICY IF EXISTS "staff write banned_users" ON public.banned_users;
CREATE POLICY "staff write banned_users" ON public.banned_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com')
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
              OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com');
DROP POLICY IF EXISTS "staff read activity_log" ON public.activity_log;
CREATE POLICY "staff read activity_log" ON public.activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com');
DROP POLICY IF EXISTS "members insert activity_log" ON public.activity_log;
CREATE POLICY "members insert activity_log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- Profiles: readable by authenticated members, writable only for own row.
DROP POLICY IF EXISTS "members read profiles" ON public.profiles;
CREATE POLICY "members read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles: users may read their own rows; staff manage all.
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "staff read user_roles" ON public.user_roles;
CREATE POLICY "staff read user_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com');

-- ---------- 12) Grants ----------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.entities, public.lore_notes, public.timeline_events, public.series,
  public.series_characters, public.entity_memberships, public.entity_relations,
  public.character_relationships, public.map_locations, public.app_settings,
  public.pdf_vault, public.episodes, public.vault_documents, public.posts,
  public.comments, public.post_votes, public.banned_words, public.profiles
  TO anon, authenticated;
GRANT SELECT ON public.user_roles, public.banned_users, public.pdf_chunks,
  public.ingest_jobs, public.activity_log TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.entities, public.lore_notes, public.timeline_events,
  public.series, public.series_characters, public.entity_memberships,
  public.entity_relations, public.character_relationships, public.map_locations,
  public.app_settings, public.pdf_vault, public.pdf_chunks, public.episodes,
  public.vault_documents, public.ingest_jobs, public.banned_words, public.banned_users,
  public.user_roles TO authenticated;
GRANT INSERT ON public.posts, public.comments, public.post_votes, public.activity_log TO authenticated;
GRANT UPDATE, DELETE ON public.posts, public.comments TO authenticated;
GRANT DELETE ON public.post_votes TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
