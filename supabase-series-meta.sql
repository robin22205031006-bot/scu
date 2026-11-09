-- Series metadata: genres, season structure, timeline notes.
-- Run once in the Supabase SQL editor.

ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS season_count integer,
  ADD COLUMN IF NOT EXISTS season_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timeline_note text;
