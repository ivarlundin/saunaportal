-- Aufguss admin: inline schedule offsets + signup close time
-- Run in Supabase SQL Editor after aufguss.sql / aufguss-signup-async-result.sql.

-- ---------------------------------------------------------------------------
-- Night: when signup closes (time on night_date, Europe/Stockholm)
-- ---------------------------------------------------------------------------

alter table public.aufguss_nights
  add column if not exists signup_closes_at time;

update public.aufguss_nights
set signup_closes_at = time '17:00'
where signup_closes_at is null;

comment on column public.aufguss_nights.signup_closes_at is
  'Local time on night_date when signup ends (Europe/Stockholm). Status closed/setup still override.';

-- ---------------------------------------------------------------------------
-- Schedule offsets (admin markers; times are materialized into starts_at)
-- ---------------------------------------------------------------------------

create table if not exists public.aufguss_schedule_offsets (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null
    references public.aufguss_nights (id) on delete cascade,
  after_slot_id uuid not null
    references public.aufguss_slots (id) on delete cascade,
  minutes integer not null check (minutes <> 0),
  created_at timestamptz not null default now(),
  constraint aufguss_schedule_offsets_night_after_unique
    unique (night_id, after_slot_id)
);

create index if not exists aufguss_schedule_offsets_night_idx
  on public.aufguss_schedule_offsets (night_id);

comment on table public.aufguss_schedule_offsets is
  'Admin-only offset markers between slots. Applying/removing also shifts subsequent starts_at.';

grant select, insert, update, delete on public.aufguss_schedule_offsets to anon, authenticated;

alter table public.aufguss_schedule_offsets enable row level security;

drop policy if exists aufguss_schedule_offsets_select on public.aufguss_schedule_offsets;
create policy aufguss_schedule_offsets_select on public.aufguss_schedule_offsets
  for select using (true);

drop policy if exists aufguss_schedule_offsets_write on public.aufguss_schedule_offsets;
create policy aufguss_schedule_offsets_write on public.aufguss_schedule_offsets
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- RPC: offset all slots after a given slot (same night)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Helper: is signup currently open for a night row?
-- ---------------------------------------------------------------------------

create or replace function public.aufguss_night_signup_open(
  p_status text,
  p_night_date date,
  p_signup_closes_at time
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_status = 'signup_open'
    and (
      p_signup_closes_at is null
      or p_night_date is null
      or (
        (timezone('Europe/Stockholm', now())::timestamp)
        < ((p_night_date + p_signup_closes_at)::timestamp)
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Signup / cancel: enforce status + close time
-- ---------------------------------------------------------------------------

drop function if exists public.aufguss_signup(uuid, text, text);

create or replace function public.aufguss_signup(
  p_slot_id uuid,
  p_participant_id text,
  p_participant_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  night_status text;
  night_date date;
  closes_at time;
  cap integer;
  current_count bigint;
  cleaned_id text;
  cleaned_name text;
  result_row public.aufguss_signups;
begin
  cleaned_id := btrim(coalesce(p_participant_id, ''));
  cleaned_name := btrim(coalesce(p_participant_name, ''));

  if cleaned_id = '' or cleaned_name = '' then
    return jsonb_build_object(
      'ok', false,
      'error', 'participant_required',
      'message', 'participant id and name required'
    );
  end if;

  select n.status, n.night_date, n.signup_closes_at, p.capacity
  into night_status, night_date, closes_at, cap
  from public.aufguss_slots sl
  join public.aufguss_nights n on n.id = sl.night_id
  join public.aufguss_places p on p.id = sl.place_id
  where sl.id = p_slot_id
  for update of sl;

  if night_status is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'slot_not_found',
      'message', 'slot not found'
    );
  end if;

  if not public.aufguss_night_signup_open(night_status, night_date, closes_at) then
    return jsonb_build_object(
      'ok', false,
      'error', 'signup_closed',
      'message', 'signup closed'
    );
  end if;

  select count(*)
  into current_count
  from public.aufguss_signups
  where slot_id = p_slot_id;

  if current_count >= cap then
    return jsonb_build_object(
      'ok', false,
      'error', 'slot_full',
      'message', 'slot full',
      'signup_count', current_count,
      'capacity', cap
    );
  end if;

  insert into public.aufguss_signups (slot_id, participant_id, participant_name)
  values (p_slot_id, cleaned_id, cleaned_name)
  on conflict (slot_id, participant_id) do update
  set participant_name = excluded.participant_name
  returning * into result_row;

  return jsonb_build_object(
    'ok', true,
    'signup', to_jsonb(result_row),
    'signup_count', current_count + 1,
    'capacity', cap
  );
end;
$$;

revoke all on function public.aufguss_signup(uuid, text, text) from public;
grant execute on function public.aufguss_signup(uuid, text, text) to anon, authenticated;

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
  night_date date;
  closes_at time;
  cleaned_id text;
  deleted_count integer;
begin
  cleaned_id := btrim(coalesce(p_participant_id, ''));
  if cleaned_id = '' then
    raise exception 'participant id required';
  end if;

  select n.status, n.night_date, n.signup_closes_at
  into night_status, night_date, closes_at
  from public.aufguss_slots sl
  join public.aufguss_nights n on n.id = sl.night_id
  where sl.id = p_slot_id;

  if night_status is null then
    raise exception 'slot not found';
  end if;

  if not public.aufguss_night_signup_open(night_status, night_date, closes_at) then
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
