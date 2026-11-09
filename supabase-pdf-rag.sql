-- ============================================================
-- SCU ARCHIVE — PDF Vault RAG (pgvector chunks + metadata)
-- Requires the `vector` extension (enabled below).
-- Embeddings: 1536-dim (gemini-embedding-001 outputDimensionality).
-- Safe to run repeatedly.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- 1) pdf_vault: document metadata ----------
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

CREATE INDEX IF NOT EXISTS pdf_vault_uploaded_idx ON public.pdf_vault (uploaded_at DESC);

ALTER TABLE public.pdf_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read pdf_vault" ON public.pdf_vault;
CREATE POLICY "public read pdf_vault" ON public.pdf_vault FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff insert pdf_vault" ON public.pdf_vault;
CREATE POLICY "staff insert pdf_vault" ON public.pdf_vault FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff update pdf_vault" ON public.pdf_vault;
CREATE POLICY "staff update pdf_vault" ON public.pdf_vault FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete pdf_vault" ON public.pdf_vault;
CREATE POLICY "staff delete pdf_vault" ON public.pdf_vault FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT ON public.pdf_vault TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pdf_vault TO authenticated;

-- ---------- 2) pdf_chunks: vector-indexed text segments ----------
CREATE TABLE IF NOT EXISTS public.pdf_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content_text text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_chunks_pdf_fkey
    FOREIGN KEY (pdf_id) REFERENCES public.pdf_vault(id) ON DELETE CASCADE,
  CONSTRAINT pdf_chunks_pair_key UNIQUE (pdf_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS pdf_chunks_pdf_idx ON public.pdf_chunks (pdf_id);

ALTER TABLE public.pdf_chunks ENABLE ROW LEVEL SECURITY;

-- Chunks are only readable by staff directly; the chat path uses the
-- security-definer match_pdf_chunks() RPC below.
DROP POLICY IF EXISTS "staff read pdf_chunks" ON public.pdf_chunks;
CREATE POLICY "staff read pdf_chunks" ON public.pdf_chunks FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff insert pdf_chunks" ON public.pdf_chunks;
CREATE POLICY "staff insert pdf_chunks" ON public.pdf_chunks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

DROP POLICY IF EXISTS "staff delete pdf_chunks" ON public.pdf_chunks;
CREATE POLICY "staff delete pdf_chunks" ON public.pdf_chunks FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(auth.jwt() ->> 'email') = 'zananrobin@gmail.com'
  );

GRANT SELECT, INSERT, DELETE ON public.pdf_chunks TO authenticated;

-- Optional HNSW index for fast approximate nearest-neighbour search.
-- Run separately if the table grows large:
-- CREATE INDEX IF NOT EXISTS pdf_chunks_embedding_idx
--   ON public.pdf_chunks USING hnsw (embedding vector_cosine_ops);

-- ---------- 3) match_pdf_chunks: vector similarity search ----------
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
