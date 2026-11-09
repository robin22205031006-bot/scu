-- merge_entities(primary_id, secondary_id)
-- Full non-destructive deep merge of a duplicate entity into a primary entity.
--
--   * lore_notes are re-pointed to the primary (the only FK referencing entities)
--   * text fields are combined with a "[Merged Info]" separator, deduplicated
--   * alias/role values are unioned (the secondary's NAME is preserved as an alias)
--   * sketches / locked_fields arrays are unioned and deduplicated
--   * stats JSONB is merged with explicit ::jsonb casts (primary wins conflicts)
--   * secondary-only field values (kind/status/category) are preserved in an
--     audit lore_note before the secondary row is deleted
--
-- Admin-only: caller must be 'admin' in user_roles or the superadmin email.
-- Run in Supabase Dashboard -> SQL Editor (or Lovable -> Supabase -> SQL).

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

  -- 1) Re-map every reference to the secondary onto the primary.
  --    lore_notes.entity_id is the only foreign key into entities.
  UPDATE public.lore_notes SET entity_id = primary_id WHERE entity_id = secondary_id;
  GET DIAGNOSTICS notes_moved = ROW_COUNT;

  -- 1b) Re-home entity memberships when the table exists. Rows that would
  --     collide with an existing primary link are dropped first (the link
  --     itself is preserved on the primary side).
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

  -- 2) Deep-merge fields. The secondary's NAME is kept as an alias so no
  --    identity is lost (e.g. merging "Aariz" into "Aariz Maddox").
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

  -- Field values that can't be represented on the primary are preserved verbatim
  -- in the audit note below so nothing is silently dropped.
  dropped_fields := concat_ws(' | ',
    CASE WHEN s.kind IS DISTINCT FROM p.kind THEN format('kind=%s', s.kind) END,
    CASE WHEN s.status IS DISTINCT FROM p.status THEN format('status=%s', s.status) END,
    CASE WHEN s.category IS DISTINCT FROM p.category THEN format('category=%s', s.category) END
  );

  -- 3) Write the merged row back to the primary.
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

  -- 4) Audit trail: merge record + any secondary-only field values.
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

  -- 5) Only now remove the secondary row — everything is already re-homed.
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
