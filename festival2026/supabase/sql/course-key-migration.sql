-- Migrate the course answer key into festival2026_courses and remove the legacy course_keys table.
-- Run this after you have verified the existing festival2026_courses table structure.

BEGIN;

ALTER TABLE public.festival2026_courses
  ADD COLUMN IF NOT EXISTS course_key text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'festival2026_course_keys'
  ) THEN
    UPDATE public.festival2026_courses AS c
    SET course_key = k.key
    FROM public.festival2026_course_keys AS k
    WHERE c.slug = k.slug
      AND c.course_key IS NULL
      AND k.key IS NOT NULL;

    DROP TABLE IF EXISTS public.festival2026_course_keys;
  END IF;
END $$;

-- Optional: enforce the key after you have backfilled all rows.
-- ALTER TABLE public.festival2026_courses
--   ALTER COLUMN course_key SET NOT NULL;

COMMIT;
