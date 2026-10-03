/* Allow schedule delay BEFORE the first slot.
   after_slot_id NULL = leading offset (shifts the whole night).
   Run in Supabase SQL Editor. */

alter table public.aufguss_schedule_offsets
  alter column after_slot_id drop not null;

alter table public.aufguss_schedule_offsets
  drop constraint if exists aufguss_schedule_offsets_night_after_unique;

drop index if exists aufguss_schedule_offsets_night_after_unique;

create unique index if not exists aufguss_schedule_offsets_night_after_unique
  on public.aufguss_schedule_offsets (night_id, after_slot_id)
  where after_slot_id is not null;

create unique index if not exists aufguss_schedule_offsets_night_leading_unique
  on public.aufguss_schedule_offsets (night_id)
  where after_slot_id is null;

comment on table public.aufguss_schedule_offsets is
  'Admin-only offset markers. after_slot_id NULL = before first slot; otherwise after that slot. Applying/removing shifts subsequent starts_at.';

create or replace function public.aufguss_offset_after_slot(
  p_night_id uuid,
  p_after_slot_id uuid,
  p_minutes integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  anchor_starts timestamptz;
  updated_count integer;
begin
  if p_minutes is null or p_minutes = 0 then
    return 0;
  end if;

  -- NULL after_slot_id = delay before the first entry: shift every slot.
  if p_after_slot_id is null then
    update public.aufguss_slots
    set starts_at = starts_at + make_interval(mins => p_minutes)
    where night_id = p_night_id;

    get diagnostics updated_count = row_count;
    return updated_count;
  end if;

  select starts_at
  into anchor_starts
  from public.aufguss_slots
  where id = p_after_slot_id
    and night_id = p_night_id;

  if anchor_starts is null then
    raise exception 'anchor slot not found';
  end if;

  update public.aufguss_slots
  set starts_at = starts_at + make_interval(mins => p_minutes)
  where night_id = p_night_id
    and starts_at > anchor_starts;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.aufguss_offset_after_slot(uuid, uuid, integer) from public;
grant execute on function public.aufguss_offset_after_slot(uuid, uuid, integer) to anon, authenticated;
