/* Fix: Anmäl dig fails with column reference "night_id" is ambiguous.
   Cause: PL/pgSQL variable night_id clashed with aufguss_slots.night_id.
   Run this once in Supabase SQL Editor. */

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
  v_night_id uuid;
  night_status text;
  night_date date;
  closes_at time;
  signup_control text;
  slot_kind text;
  max_signups integer;
  cap integer;
  current_count bigint;
  participant_count bigint;
  cleaned_id text;
  cleaned_name text;
  already_signed boolean;
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

  select
    sl.night_id,
    n.status,
    n.night_date,
    n.signup_closes_at,
    n.signup_control,
    sl.slot_kind,
    n.max_signups_per_participant,
    p.capacity
  into
    v_night_id,
    night_status,
    night_date,
    closes_at,
    signup_control,
    slot_kind,
    max_signups,
    cap
  from public.aufguss_slots sl
  join public.aufguss_nights n on n.id = sl.night_id
  left join public.aufguss_places p on p.id = sl.place_id
  where sl.id = p_slot_id
  for update of sl;

  if night_status is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'slot_not_found',
      'message', 'slot not found'
    );
  end if;

  if coalesce(slot_kind, 'signup') <> 'signup' then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_bookable',
      'message', 'slot is not bookable'
    );
  end if;

  if not public.aufguss_night_signup_open(night_status, night_date, closes_at, signup_control) then
    return jsonb_build_object(
      'ok', false,
      'error', 'signup_closed',
      'message', 'signup closed'
    );
  end if;

  if cap is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'slot_not_found',
      'message', 'slot place missing'
    );
  end if;

  select exists (
    select 1
    from public.aufguss_signups s
    where s.slot_id = p_slot_id
      and s.participant_id = cleaned_id
  )
  into already_signed;

  if not already_signed then
    select count(*)
    into participant_count
    from public.aufguss_signups s
    join public.aufguss_slots sl2 on sl2.id = s.slot_id
    where s.participant_id = cleaned_id
      and sl2.night_id = v_night_id
      and coalesce(sl2.slot_kind, 'signup') = 'signup';

    if participant_count >= coalesce(max_signups, 4) then
      return jsonb_build_object(
        'ok', false,
        'error', 'signup_limit',
        'message', 'participant signup limit reached',
        'limit', coalesce(max_signups, 4),
        'signup_count', participant_count
      );
    end if;
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
    'signup_count', current_count + case when already_signed then 0 else 1 end,
    'capacity', cap
  );
end;
$$;

revoke all on function public.aufguss_signup(uuid, text, text) from public;
grant execute on function public.aufguss_signup(uuid, text, text) to anon, authenticated;
