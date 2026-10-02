-- Signup control mode: scheduled | force_open | force_closed | setup
-- Run after aufguss-admin-offsets-and-close-time.sql

alter table public.aufguss_nights
  add column if not exists signup_control text;

update public.aufguss_nights
set signup_control = case
  when status = 'setup' then 'setup'
  when status = 'closed' then 'force_closed'
  else 'scheduled'
end
where signup_control is null;

alter table public.aufguss_nights
  alter column signup_control set default 'scheduled';

alter table public.aufguss_nights
  drop constraint if exists aufguss_nights_signup_control_check;

alter table public.aufguss_nights
  add constraint aufguss_nights_signup_control_check
  check (signup_control in ('scheduled', 'force_open', 'force_closed', 'setup'));

comment on column public.aufguss_nights.signup_control is
  'scheduled = open until signup_closes_at; force_open/force_closed ignore the clock; setup = hidden.';

-- Helper: is signup currently open?
drop function if exists public.aufguss_night_signup_open(text, date, time);
drop function if exists public.aufguss_night_signup_open(text, date, time, text);

create or replace function public.aufguss_night_signup_open(
  p_status text,
  p_night_date date,
  p_signup_closes_at time,
  p_signup_control text default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_signup_control, case
      when p_status = 'setup' then 'setup'
      when p_status = 'closed' then 'force_closed'
      else 'scheduled'
    end) = 'setup' then false
    when coalesce(p_signup_control, case
      when p_status = 'setup' then 'setup'
      when p_status = 'closed' then 'force_closed'
      else 'scheduled'
    end) = 'force_closed' then false
    when coalesce(p_signup_control, case
      when p_status = 'setup' then 'setup'
      when p_status = 'closed' then 'force_closed'
      else 'scheduled'
    end) = 'force_open' then true
    else (
      p_status = 'signup_open'
      and (
        p_signup_closes_at is null
        or p_night_date is null
        or (
          (timezone('Europe/Stockholm', now())::timestamp)
          < ((p_night_date + p_signup_closes_at)::timestamp)
        )
      )
    )
  end;
$$;

-- Update signup RPC to pass signup_control
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
  signup_control text;
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

  select n.status, n.night_date, n.signup_closes_at, n.signup_control, p.capacity
  into night_status, night_date, closes_at, signup_control, cap
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

  if not public.aufguss_night_signup_open(night_status, night_date, closes_at, signup_control) then
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
  signup_control text;
  cleaned_id text;
  deleted_count integer;
begin
  cleaned_id := btrim(coalesce(p_participant_id, ''));
  if cleaned_id = '' then
    raise exception 'participant id required';
  end if;

  select n.status, n.night_date, n.signup_closes_at, n.signup_control
  into night_status, night_date, closes_at, signup_control
  from public.aufguss_slots sl
  join public.aufguss_nights n on n.id = sl.night_id
  where sl.id = p_slot_id;

  if night_status is null then
    raise exception 'slot not found';
  end if;

  if not public.aufguss_night_signup_open(night_status, night_date, closes_at, signup_control) then
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
