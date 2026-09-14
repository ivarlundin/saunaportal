-- Run in Supabase SQL Editor.
-- Adds a password hash column for the existing participant table and ensures aliases stay unique.

ALTER TABLE public.festival2026_deltagare
  ADD COLUMN IF NOT EXISTS password_hash text;

-- Existing data may already contain duplicate aliases.
-- Make those aliases unique first so the later unique index can be created successfully.
WITH ranked_aliases AS (
  SELECT
    id,
    alias,
    row_number() OVER (
      PARTITION BY alias
      ORDER BY id
    ) AS alias_rank
  FROM public.festival2026_deltagare
  WHERE alias IS NOT NULL
)
UPDATE public.festival2026_deltagare AS d
SET alias = d.alias || '-' || ranked_aliases.alias_rank
FROM ranked_aliases
WHERE d.id = ranked_aliases.id
  AND ranked_aliases.alias_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS festival2026_deltagare_alias_key
  ON public.festival2026_deltagare (alias);

-- Optional: keep old rows valid by leaving password_hash nullable until users sign up again.
-- Existing rows without a password_hash will not be able to log in.
