-- Per-entity and per-series-season card canvas theme overrides.
-- Values are theme keys understood by AbilityCardCanvas (e.g. "beast", "water", "fire").
-- Run once in the Supabase SQL editor.

ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS card_theme text;

ALTER TABLE public.series_characters
  ADD COLUMN IF NOT EXISTS card_theme text;
