-- Aufguss schedule app (aufguss/) — LSE SaunaFestival 2026
-- Run in Supabase SQL Editor before using admin.html / live.html.
-- Project: https://nicpgzkkyktzphkyzhfl.supabase.co

-- ---------------------------------------------------------------------------
-- Places (capacity drives how many can sign up per slot)
-- ---------------------------------------------------------------------------

create table if not exists public.aufguss_places (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  capacity integer not null check (capacity > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.aufguss_places is
  'Physical spots for Aufguss sessions (Stora bastun, Lilla bastun, Tältet).';

comment on column public.aufguss_places.capacity is
  'Max participants that can sign up for a slot at this place.';

-- ---------------------------------------------------------------------------
-- Nights (one evening of Aufguss; status gates signup vs live schedule)
-- ---------------------------------------------------------------------------

create table if not exists public.aufguss_nights (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Aufguss-kväll',
  night_date date,
  status text not null default 'signup_open'
    check (status in ('setup', 'signup_open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.aufguss_nights is
  'A festival night. signup_open = participants can book; closed = live schedule only.';

-- ---------------------------------------------------------------------------
-- Slots (posts / sessions)
-- ---------------------------------------------------------------------------

create table if not exists public.aufguss_slots (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null
    references public.aufguss_nights (id) on delete cascade,
  place_id uuid not null
    references public.aufguss_places (id) on delete restrict,
  name text not null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 15
    check (duration_minutes > 0),
  bastuolja text not null default '',
  aufgussmeister text not null default '',
  intensity integer not null default 3
    check (intensity between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aufguss_slots_night_starts_idx
  on public.aufguss_slots (night_id, starts_at);

comment on table public.aufguss_slots is
  'Scheduled Aufguss posts for a night.';

comment on column public.aufguss_slots.bastuolja is
  'Sauna oil / scent used for the slot.';

comment on column public.aufguss_slots.aufgussmeister is
  'Name of the Aufgussmeister leading the slot.';

-- ---------------------------------------------------------------------------
-- Signups
-- ---------------------------------------------------------------------------

create table if not exists public.aufguss_signups (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null
    references public.aufguss_slots (id) on delete cascade,
  participant_id text not null,
  participant_name text not null,
  created_at timestamptz not null default now(),
  constraint aufguss_signups_participant_id_check
    check (btrim(participant_id) <> ''),
  constraint aufguss_signups_participant_name_check
    check (btrim(participant_name) <> ''),
  constraint aufguss_signups_slot_participant_unique
    unique (slot_id, participant_id)
);

create index if not exists aufguss_signups_slot_idx
  on public.aufguss_signups (slot_id);

create index if not exists aufguss_signups_participant_idx
  on public.aufguss_signups (participant_id);

comment on table public.aufguss_signups is
  'Participant bookings for Aufguss slots. participant_id comes from live.html URL.';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.aufguss_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aufguss_nights_touch_updated_at on public.aufguss_nights;
create trigger aufguss_nights_touch_updated_at
  before update on public.aufguss_nights
  for each row
  execute function public.aufguss_touch_updated_at();

drop trigger if exists aufguss_slots_touch_updated_at on public.aufguss_slots;
create trigger aufguss_slots_touch_updated_at
  before update on public.aufguss_slots
  for each row
  execute function public.aufguss_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Seed places (idempotent)
-- ---------------------------------------------------------------------------

insert into public.aufguss_places (name, capacity, sort_order)
values
  ('Stora bastun', 12, 1),
  ('Lilla bastun', 6, 2),
  ('Tältet', 20, 3)
on conflict (name) do update
set
  capacity = excluded.capacity,
  sort_order = excluded.sort_order;

-- Seed a default night if none exist
insert into public.aufguss_nights (title, night_date, status)
select 'SaunaFestival 2026 — Aufguss', current_date, 'signup_open'
where not exists (select 1 from public.aufguss_nights);

-- ---------------------------------------------------------------------------
-- Helper: signup count + capacity for a slot
-- ---------------------------------------------------------------------------

create or replace function public.aufguss_slot_capacity(p_slot_id uuid)
returns table (
  signup_count bigint,
  capacity integer,
  places_left integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.aufguss_signups s where s.slot_id = p_slot_id) as signup_count,
    p.capacity,
    greatest(p.capacity - (select count(*) from public.aufguss_signups s where s.slot_id = p_slot_id), 0)::integer as places_left
  from public.aufguss_slots sl
  join public.aufguss_places p on p.id = sl.place_id
  where sl.id = p_slot_id;
$$;

revoke all on function public.aufguss_slot_capacity(uuid) from public;
grant execute on function public.aufguss_slot_capacity(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: sign up for a slot (capacity + night status enforced)
-- ---------------------------------------------------------------------------

create or replace function public.aufguss_signup(
  p_slot_id uuid,
  p_participant_id text,
  p_participant_name text
)
returns public.aufguss_signups
language plpgsql
security definer
set search_path = public
as $$
declare
  night_status text;
  cap integer;
  current_count bigint;
  cleaned_id text;
  cleaned_name text;
  result_row public.aufguss_signups;
begin
  cleaned_id := btrim(coalesce(p_participant_id, ''));
  cleaned_name := btrim(coalesce(p_participant_name, ''));

  if cleaned_id = '' or cleaned_name = '' then
    raise exception 'participant id and name required';
  end if;

  select n.status
  into night_status
  from public.aufguss_slots sl
  join public.aufguss_nights n on n.id = sl.night_id
  where sl.id = p_slot_id;

  if night_status is null then
    raise exception 'slot not found';
  end if;

  if night_status <> 'signup_open' then
    raise exception 'signup closed';
  end if;

  select p.capacity
  into cap
  from public.aufguss_slots sl
  join public.aufguss_places p on p.id = sl.place_id
  where sl.id = p_slot_id;

  select count(*)
  into current_count
  from public.aufguss_signups
  where slot_id = p_slot_id;

  if current_count >= cap then
    raise exception 'slot full';
  end if;

  insert into public.aufguss_signups (slot_id, participant_id, participant_name)
  values (p_slot_id, cleaned_id, cleaned_name)
  on conflict (slot_id, participant_id) do update
  set participant_name = excluded.participant_name
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.aufguss_signup(uuid, text, text) from public;
grant execute on function public.aufguss_signup(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cancel own signup (only while signup_open)
-- ---------------------------------------------------------------------------

create or replace function public.aufguss_cancel_signup(
  p_slot_id uuid,
  p_participant_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  night_status text;
  cleaned_id text;
  deleted_count integer;
begin
  cleaned_id := btrim(coalesce(p_participant_id, ''));
  if cleaned_id = '' then
    raise exception 'participant id required';
  end if;

  select n.status
  into night_status
  from public.aufguss_slots sl
  join public.aufguss_nights n on n.id = sl.night_id
  where sl.id = p_slot_id;

  if night_status is null then
    raise exception 'slot not found';
  end if;

  if night_status <> 'signup_open' then
    raise exception 'signup closed';
  end if;

  delete from public.aufguss_signups
  where slot_id = p_slot_id
    and participant_id = cleaned_id;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.aufguss_cancel_signup(uuid, text) from public;
grant execute on function public.aufguss_cancel_signup(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: offset all slot start times for a night by N minutes
-- ---------------------------------------------------------------------------

create or replace function public.aufguss_offset_night(
  p_night_id uuid,
  p_minutes integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if p_minutes is null or p_minutes = 0 then
    return 0;
  end if;

  update public.aufguss_slots
  set starts_at = starts_at + make_interval(mins => p_minutes)
  where night_id = p_night_id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.aufguss_offset_night(uuid, integer) from public;
grant execute on function public.aufguss_offset_night(uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- View: slots with place + signup counts (handy for clients)
-- ---------------------------------------------------------------------------

create or replace view public.aufguss_slots_enriched as
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

grant select, insert, update, delete on public.aufguss_places to anon, authenticated;
grant select, insert, update, delete on public.aufguss_nights to anon, authenticated;
grant select, insert, update, delete on public.aufguss_slots to anon, authenticated;
grant select, insert, update, delete on public.aufguss_signups to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS — family event; admin gated in frontend (password tallbarr).
-- Open read; writes allowed for schedule management + signups via RPC preferred.
-- ---------------------------------------------------------------------------

alter table public.aufguss_places enable row level security;
alter table public.aufguss_nights enable row level security;
alter table public.aufguss_slots enable row level security;
alter table public.aufguss_signups enable row level security;

drop policy if exists aufguss_places_select on public.aufguss_places;
create policy aufguss_places_select on public.aufguss_places
  for select to anon, authenticated using (true);

drop policy if exists aufguss_places_write on public.aufguss_places;
create policy aufguss_places_write on public.aufguss_places
  for all to anon, authenticated using (true) with check (true);

drop policy if exists aufguss_nights_select on public.aufguss_nights;
create policy aufguss_nights_select on public.aufguss_nights
  for select to anon, authenticated using (true);

drop policy if exists aufguss_nights_write on public.aufguss_nights;
create policy aufguss_nights_write on public.aufguss_nights
  for all to anon, authenticated using (true) with check (true);

drop policy if exists aufguss_slots_select on public.aufguss_slots;
create policy aufguss_slots_select on public.aufguss_slots
  for select to anon, authenticated using (true);

drop policy if exists aufguss_slots_write on public.aufguss_slots;
create policy aufguss_slots_write on public.aufguss_slots
  for all to anon, authenticated using (true) with check (true);

drop policy if exists aufguss_signups_select on public.aufguss_signups;
create policy aufguss_signups_select on public.aufguss_signups
  for select to anon, authenticated using (true);

drop policy if exists aufguss_signups_insert on public.aufguss_signups;
create policy aufguss_signups_insert on public.aufguss_signups
  for insert to anon, authenticated with check (true);

drop policy if exists aufguss_signups_delete on public.aufguss_signups;
create policy aufguss_signups_delete on public.aufguss_signups
  for delete to anon, authenticated using (true);

drop policy if exists aufguss_signups_update on public.aufguss_signups;
create policy aufguss_signups_update on public.aufguss_signups
  for update to anon, authenticated using (true) with check (true);

-- Realtime (optional — ignore errors if already added)
do $$
begin
  alter publication supabase_realtime add table public.aufguss_slots;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.aufguss_signups;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.aufguss_nights;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
