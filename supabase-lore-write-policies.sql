-- Lore write policies for the SCU archive sync (adminLoreSync / syncLoreExport / applyLore).
--
-- IMPORTANT: run this in Supabase Dashboard -> SQL Editor (or Lovable -> Supabase -> SQL)
-- for the project backing this app. It cannot be executed from the repo.
--
-- These policies allow writes ONLY to admins (user_roles 'admin') and the
-- hardcoded superadmin zananrobin@gmail.com — NOT to anonymous/public callers.
-- The superadmin email check mirrors src/lib/roles.ts so the account can write
-- even before its user_roles row exists.
--
-- If you truly need a temporary public-write escape hatch, see the commented
-- block at the bottom — do not leave it enabled in production.

-- ---------- entities ----------
DROP POLICY IF EXISTS "staff insert entities" ON public.entities;
DROP POLICY IF EXISTS "staff update entities" ON public.entities;
CREATE POLICY "staff insert entities" ON public.entities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );
CREATE POLICY "staff update entities" ON public.entities
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

-- ---------- lore_notes ----------
DROP POLICY IF EXISTS "staff insert lore_notes" ON public.lore_notes;
DROP POLICY IF EXISTS "staff update lore_notes" ON public.lore_notes;
CREATE POLICY "staff insert lore_notes" ON public.lore_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );
CREATE POLICY "staff update lore_notes" ON public.lore_notes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

-- ---------- timeline_events ----------
DROP POLICY IF EXISTS "staff insert timeline_events" ON public.timeline_events;
DROP POLICY IF EXISTS "staff update timeline_events" ON public.timeline_events;
CREATE POLICY "staff insert timeline_events" ON public.timeline_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );
CREATE POLICY "staff update timeline_events" ON public.timeline_events
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

-- ---------- ingest_jobs (sync writes a summary row) ----------
DROP POLICY IF EXISTS "staff insert ingest_jobs" ON public.ingest_jobs;
CREATE POLICY "staff insert ingest_jobs" ON public.ingest_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

-- ---------------------------------------------------------------------------
-- TEMPORARY public-write escape hatch (NOT recommended — anyone with the
-- publishable key could then modify the archive). Uncomment only if the
-- staff policies above cannot be applied:
--
-- CREATE POLICY "temp public insert entities" ON public.entities FOR INSERT WITH CHECK (true);
-- CREATE POLICY "temp public update entities" ON public.entities FOR UPDATE USING (true) WITH CHECK (true);
-- (repeat for lore_notes, timeline_events, ingest_jobs)
-- ---------------------------------------------------------------------------
