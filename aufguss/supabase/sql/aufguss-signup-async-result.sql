-- Update aufguss_signup to return jsonb { ok, error?, message?, signup? }
-- so the live client can await a clear fully-booked error state.
-- Run in Supabase SQL Editor after deploying the frontend change.

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

  select n.status, p.capacity
  into night_status, cap
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

  if night_status <> 'signup_open' then
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
