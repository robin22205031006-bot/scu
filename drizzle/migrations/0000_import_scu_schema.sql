CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.entity_kind AS ENUM ('character', 'organization', 'clan', 'bloodline', 'faction'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.entity_kind NOT NULL,
  name text NOT NULL,
  alias text, role text,
  status text NOT NULL DEFAULT 'Active',
  category text,
  description text NOT NULL DEFAULT '',
  image_url text,
  sketches text[] NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_fields text[] NOT NULL DEFAULT '{}',
  parent_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  abilities text[] NOT NULL DEFAULT '{}',
  beast_traits text[] NOT NULL DEFAULT '{}',
  character_tier text, animation_style text, theme_color text, accent_glow text, theme_song_url text,
  card_theme text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entities_parent_idx ON public.entities (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX entities_kind_idx ON public.entities (kind);
CREATE INDEX entities_name_idx ON public.entities (name);

CREATE TABLE public.lore_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  text text NOT NULL, source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lore_notes_entity_idx ON public.lore_notes (entity_id);

CREATE TABLE public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, description text NOT NULL DEFAULT '',
  era text, series text,
  impact integer NOT NULL DEFAULT 5, sort_order integer NOT NULL DEFAULT 0,
  source text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX timeline_events_sort_idx ON public.timeline_events (sort_order);

CREATE TABLE public.ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL, summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text, display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_display_name_key ON public.profiles (lower(display_name)) WHERE display_name IS NOT NULL;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE INDEX user_roles_user_idx ON public.user_roles (user_id);

CREATE TABLE public.banned_users (
  user_id uuid PRIMARY KEY, banned_by uuid, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.banned_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid(), author_name text,
  title text NOT NULL, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(), author_name text,
  body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON public.comments (post_id);
CREATE TABLE public.post_votes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_created_idx ON public.activity_log (created_at DESC);
CREATE TABLE public.vault_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, file_path text NOT NULL,
  is_public boolean NOT NULL DEFAULT true, downloadable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, description text NOT NULL DEFAULT '',
  cover_image_url text,
  genres text[] NOT NULL DEFAULT '{}', season_count integer,
  season_names text[] NOT NULL DEFAULT '{}', timeline_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.series_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Unknown', role_in_series text,
  arc_role text, card_theme text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT series_characters_pair_key UNIQUE (series_id, character_id)
);
CREATE INDEX series_characters_series_idx ON public.series_characters (series_id);
CREATE INDEX series_characters_character_idx ON public.series_characters (character_id);
CREATE TABLE public.entity_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Current',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_memberships_pair_key UNIQUE (character_id, group_id)
);
CREATE INDEX entity_memberships_character_idx ON public.entity_memberships (character_id);
CREATE INDEX entity_memberships_group_idx ON public.entity_memberships (group_id);
CREATE TABLE public.entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  rel text NOT NULL, label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_relations_pair_key UNIQUE (source_id, target_id, rel),
  CONSTRAINT entity_relations_rel_check CHECK (rel IN ('commands', 'ally', 'rival', 'mentor', 'kin'))
);
CREATE INDEX entity_relations_source_idx ON public.entity_relations (source_id);
CREATE INDEX entity_relations_target_idx ON public.entity_relations (target_id);
CREATE TABLE public.character_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id_1 uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  character_id_2 uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_relationships_pair_key UNIQUE (character_id_1, character_id_2, relationship_type),
  CONSTRAINT character_relationships_distinct_check CHECK (character_id_1 <> character_id_2),
  CONSTRAINT character_relationships_type_check CHECK (relationship_type IN (
    'father_son','mother_daughter','parent_child','brother_sister','brother_brother','sister_sister','siblings',
    'lovers','spouses','best_friends','rivals','mentor_student','ally','enemy'))
);
CREATE INDEX character_relationships_c1_idx ON public.character_relationships (character_id_1);
CREATE INDEX character_relationships_c2_idx ON public.character_relationships (character_id_2);
CREATE TABLE public.app_settings (
  key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.map_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pos_x double precision NOT NULL DEFAULT 50, pos_y double precision NOT NULL DEFAULT 50,
  era text, faction text,
  report text NOT NULL DEFAULT '', battles text NOT NULL DEFAULT '', sentinels text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT map_locations_coords_check CHECK (pos_x >= 0 AND pos_x <= 100 AND pos_y >= 0 AND pos_y <= 100)
);
CREATE INDEX map_locations_name_idx ON public.map_locations (name);
CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, body text NOT NULL DEFAULT '', series text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT episodes_status_check CHECK (status IN ('draft', 'published'))
);
CREATE INDEX episodes_status_idx ON public.episodes (status);
CREATE TABLE public.pdf_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL, storage_path text NOT NULL, uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'processing', chunk_count integer NOT NULL DEFAULT 0,
  CONSTRAINT pdf_vault_status_check CHECK (status IN ('processing', 'ready', 'error'))
);
CREATE INDEX pdf_vault_uploaded_idx ON public.pdf_vault (uploaded_at DESC);
CREATE TABLE public.pdf_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id uuid NOT NULL REFERENCES public.pdf_vault(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL, content_text text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_chunks_pair_key UNIQUE (pdf_id, chunk_index)
);
CREATE INDEX pdf_chunks_pdf_idx ON public.pdf_chunks (pdf_id);
CREATE INDEX pdf_chunks_embedding_idx ON public.pdf_chunks USING hnsw (embedding vector_cosine_ops);
CREATE TABLE public.character_abilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  ability_key text NOT NULL,
  series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  season_number integer,
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX character_abilities_entity_idx ON public.character_abilities(entity_id);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.entities, public.lore_notes, public.timeline_events, public.series,
  public.series_characters, public.entity_memberships, public.entity_relations,
  public.character_relationships, public.map_locations, public.app_settings,
  public.pdf_vault, public.episodes, public.vault_documents, public.posts,
  public.comments, public.post_votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_uid, 'admin'::public.app_role) OR public.has_role(_uid, 'moderator'::public.app_role); $$;
CREATE OR REPLACE FUNCTION public.is_banned(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.banned_users WHERE user_id = _uid); $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  IF lower(NEW.email) = 'zananrobin@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.lookup_login_email(p_username text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT email FROM public.profiles WHERE lower(trim(display_name)) = lower(trim(p_username)) AND email IS NOT NULL LIMIT 1; $$;
REVOKE ALL ON FUNCTION public.lookup_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_login_email(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.match_pdf_chunks(query_embedding vector(1536), match_count integer DEFAULT 8)
RETURNS TABLE (pdf_id uuid, file_name text, chunk_index integer, content_text text, similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.pdf_id, v.file_name, c.chunk_index, c.content_text, 1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.pdf_chunks c JOIN public.pdf_vault v ON v.id = c.pdf_id
  WHERE c.embedding IS NOT NULL AND v.status = 'ready'
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 50);
$$;
REVOKE ALL ON FUNCTION public.match_pdf_chunks(vector, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_pdf_chunks(vector, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.remap_series_characters(p_primary uuid, p_secondary uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_primary IS NULL OR p_secondary IS NULL OR p_primary = p_secondary THEN RETURN; END IF;
  DELETE FROM public.series_characters a USING public.series_characters b
  WHERE a.character_id = p_secondary AND b.character_id = p_primary AND a.series_id = b.series_id;
  UPDATE public.series_characters SET character_id = p_primary WHERE character_id = p_secondary;
END;
$$;
REVOKE ALL ON FUNCTION public.remap_series_characters(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remap_series_characters(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.merge_entities(primary_id uuid, secondary_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.entities%ROWTYPE; s public.entities%ROWTYPE;
  notes_moved integer; merged_alias text; merged_role text; merged_desc text; dropped_fields text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can merge entities';
  END IF;
  IF primary_id = secondary_id THEN RAISE EXCEPTION 'Cannot merge an entity into itself'; END IF;
  SELECT * INTO p FROM public.entities WHERE id = primary_id;
  SELECT * INTO s FROM public.entities WHERE id = secondary_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Primary entity % not found', primary_id; END IF;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Secondary entity % not found', secondary_id; END IF;

  UPDATE public.lore_notes SET entity_id = primary_id WHERE entity_id = secondary_id;
  GET DIAGNOSTICS notes_moved = ROW_COUNT;

  DELETE FROM public.entity_memberships a USING public.entity_memberships b
    WHERE a.character_id = secondary_id AND b.character_id = primary_id AND a.group_id = b.group_id;
  DELETE FROM public.entity_memberships a USING public.entity_memberships b
    WHERE a.group_id = secondary_id AND b.group_id = primary_id AND a.character_id = b.character_id;
  UPDATE public.entity_memberships SET character_id = primary_id WHERE character_id = secondary_id;
  UPDATE public.entity_memberships SET group_id = primary_id WHERE group_id = secondary_id;

  PERFORM public.remap_series_characters(primary_id, secondary_id);

  DELETE FROM public.character_relationships a
    WHERE (a.character_id_1 = primary_id AND a.character_id_2 = secondary_id)
       OR (a.character_id_1 = secondary_id AND a.character_id_2 = primary_id);
  UPDATE public.character_relationships SET character_id_1 = primary_id WHERE character_id_1 = secondary_id;
  UPDATE public.character_relationships SET character_id_2 = primary_id WHERE character_id_2 = secondary_id;

  UPDATE public.entities SET parent_id = primary_id WHERE parent_id = secondary_id AND id <> primary_id;

  SELECT string_agg(DISTINCT v, ' · ' ORDER BY v) INTO merged_alias
  FROM unnest(ARRAY[NULLIF(p.alias, ''), NULLIF(s.alias, ''), NULLIF(s.name, '')]) AS t(v)
  WHERE v IS NOT NULL AND lower(v) <> lower(p.name);
  SELECT string_agg(DISTINCT v, ' · ' ORDER BY v) INTO merged_role
  FROM unnest(ARRAY[NULLIF(p.role, ''), NULLIF(s.role, '')]) AS t(v) WHERE v IS NOT NULL;
  merged_desc := CASE
    WHEN COALESCE(s.description, '') = '' THEN p.description
    WHEN COALESCE(p.description, '') = '' THEN s.description
    WHEN position(s.description IN p.description) > 0 THEN p.description
    ELSE p.description || E'\n\n[Merged Info]:\n' || s.description
  END;
  dropped_fields := concat_ws(' | ',
    CASE WHEN s.kind IS DISTINCT FROM p.kind THEN format('kind=%s', s.kind) END,
    CASE WHEN s.status IS DISTINCT FROM p.status THEN format('status=%s', s.status) END,
    CASE WHEN s.category IS DISTINCT FROM p.category THEN format('category=%s', s.category) END);

  UPDATE public.entities SET
    alias = merged_alias, role = merged_role,
    category = COALESCE(p.category, s.category),
    description = merged_desc,
    image_url = COALESCE(p.image_url, s.image_url),
    sketches = (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[]) FROM unnest(p.sketches || s.sketches) AS x),
    abilities = (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[]) FROM unnest(p.abilities || s.abilities) AS x),
    beast_traits = (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[]) FROM unnest(p.beast_traits || s.beast_traits) AS x),
    stats = CASE WHEN jsonb_typeof(p.stats) = 'object' AND jsonb_typeof(s.stats) = 'object'
                 THEN s.stats || p.stats ELSE COALESCE(p.stats, s.stats) END,
    locked_fields = (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[]) FROM unnest(p.locked_fields || s.locked_fields) AS x),
    updated_at = now()
  WHERE id = primary_id;

  INSERT INTO public.lore_notes (entity_id, text, source)
  VALUES (primary_id, format('[merge] Merged "%s" into this entry. %s lore note(s) transferred.%s', s.name, notes_moved,
    CASE WHEN dropped_fields <> '' THEN format(' Secondary-only fields: %s.', dropped_fields) ELSE '' END), 'Admin merge');

  DELETE FROM public.entities WHERE id = secondary_id;
  RETURN jsonb_build_object('primary_id', primary_id, 'merged_id', secondary_id, 'merged_name', s.name,
    'notes_moved', notes_moved, 'dropped_fields', dropped_fields);
END;
$$;
REVOKE ALL ON FUNCTION public.merge_entities(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_entities(uuid, uuid) TO authenticated, service_role;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['entities','lore_notes','timeline_events','series','series_characters',
    'entity_memberships','entity_relations','character_relationships','map_locations','app_settings',
    'posts','comments','post_votes'] LOOP
    EXECUTE format('CREATE POLICY "public read %s" ON public.%I FOR SELECT USING (true)', t, t);
  END LOOP;
END $$;
CREATE POLICY "public read published episodes" ON public.episodes FOR SELECT USING (status = 'published');
CREATE POLICY "public read vault_documents" ON public.vault_documents FOR SELECT USING (is_public = true OR auth.role() = 'authenticated');
CREATE POLICY "signed-in read pdf_vault" ON public.pdf_vault FOR SELECT TO authenticated USING (true);
CREATE POLICY "members read character_abilities" ON public.character_abilities FOR SELECT TO authenticated USING (true);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['series','series_characters','entity_memberships','entity_relations',
    'character_relationships','map_locations','app_settings','pdf_vault','pdf_chunks','vault_documents',
    'entities','lore_notes','timeline_events','ingest_jobs','banned_words','character_abilities','episodes'] LOOP
    EXECUTE format('CREATE POLICY "staff insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "staff update %s" ON public.%I FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "staff delete %s" ON public.%I FOR DELETE TO authenticated USING (public.is_staff(auth.uid()))', t, t);
  END LOOP;
END $$;
CREATE POLICY "staff read episodes" ON public.episodes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read pdf_chunks" ON public.pdf_chunks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read ingest_jobs" ON public.ingest_jobs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read banned_words" ON public.banned_words FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read banned_users" ON public.banned_users FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write banned_users" ON public.banned_users FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff read activity_log" ON public.activity_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "posts insert own" ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND NOT public.is_banned(auth.uid()));
CREATE POLICY "posts update own" ON public.posts FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "posts delete own or staff" ON public.posts FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "comments insert own" ON public.comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND NOT public.is_banned(auth.uid()));
CREATE POLICY "comments update own" ON public.comments FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments delete own or staff" ON public.comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "votes insert own" ON public.post_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "votes delete own" ON public.post_votes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "activity insert own" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles owner or staff read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));