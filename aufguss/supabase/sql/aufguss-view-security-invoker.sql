-- Fix: aufguss_slots_enriched Security Definer warning in Supabase.
-- Run once in SQL Editor (or click Autofix on the view).
-- Safe for family-event open RLS — only changes who the view runs as.

create or replace view public.aufguss_slots_enriched
with (security_invoker = true)
as
select
  sl.id,
  sl.night_id,
  sl.place_id,
  sl.name,
  sl.starts_at,
  sl.duration_minutes,
  sl.bastuolja,
  sl.aufgussmeister,
  sl.intensity,
  sl.created_at,
  sl.updated_at,
  p.name as place_name,
  p.capacity as place_capacity,
  p.sort_order as place_sort_order,
  (select count(*)::integer from public.aufguss_signups s where s.slot_id = sl.id) as signup_count,
  greatest(
    p.capacity - (select count(*)::integer from public.aufguss_signups s where s.slot_id = sl.id),
    0
  ) as places_left
from public.aufguss_slots sl
join public.aufguss_places p on p.id = sl.place_id;

grant select on public.aufguss_slots_enriched to anon, authenticated;
