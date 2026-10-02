-- Live event polls (omröstning) — separate from forum polls.
-- Run in Supabase SQL Editor before using omrostning.html.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.festival2026_omrostning_polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  options jsonb not null default '[]'::jsonb,
  allow_text_response boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'closed')),
  created_by uuid references public.festival2026_deltagare (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  live_at timestamptz,
  closed_at timestamptz
);

comment on table public.festival2026_omrostning_polls is
  'Event polls for omrostning.html: draft (admin only), live (voting), closed (hidden from participants).';

comment on column public.festival2026_omrostning_polls.options is
  'JSON array of option labels, e.g. ["Ja","Nej"]. May be empty when allow_text_response is the only input.';

create table if not exists public.festival2026_omrostning_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null
    references public.festival2026_omrostning_polls (id) on delete cascade,
  participant_id uuid not null
    references public.festival2026_deltagare (id) on delete cascade,
  option_index integer,
  text_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint festival2026_omrostning_responses_option_index_check
    check (option_index is null or option_index >= 0),
  constraint festival2026_omrostning_responses_has_answer_check
    check (
      option_index is not null
      or (text_response is not null and btrim(text_response) <> '')
    )
);

create unique index if not exists festival2026_omrostning_responses_poll_participant_unique
  on public.festival2026_omrostning_responses (poll_id, participant_id);

create index if not exists festival2026_omrostning_polls_status_idx
  on public.festival2026_omrostning_polls (status, updated_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.festival2026_is_forum_admin(p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.festival2026_deltagare d
    where d.id = p_participant_id
      and d.is_forum_admin is true
  );
$$;

revoke all on function public.festival2026_is_forum_admin(uuid) from public;
grant execute on function public.festival2026_is_forum_admin(uuid) to anon, authenticated;

create or replace function public.festival2026_touch_omrostning_poll_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists festival2026_omrostning_polls_touch_updated_at
  on public.festival2026_omrostning_polls;

create trigger festival2026_omrostning_polls_touch_updated_at
  before update on public.festival2026_omrostning_polls
  for each row
  execute function public.festival2026_touch_omrostning_poll_updated_at();

drop trigger if exists festival2026_omrostning_responses_touch_updated_at
  on public.festival2026_omrostning_responses;

create trigger festival2026_omrostning_responses_touch_updated_at
  before update on public.festival2026_omrostning_responses
  for each row
  execute function public.festival2026_touch_omrostning_poll_updated_at();

-- ---------------------------------------------------------------------------
-- RPC: admin list (draft, live, closed)
-- ---------------------------------------------------------------------------

create or replace function public.list_omrostning_polls_admin(
  acting_participant_id uuid
)
returns setof public.festival2026_omrostning_polls
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.festival2026_is_forum_admin(acting_participant_id) then
    raise exception 'not forum admin';
  end if;

  return query
  select *
  from public.festival2026_omrostning_polls
  order by updated_at desc;
end;
$$;

revoke all on function public.list_omrostning_polls_admin(uuid) from public;
grant execute on function public.list_omrostning_polls_admin(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create or update poll (admin)
-- ---------------------------------------------------------------------------

create or replace function public.save_omrostning_poll_admin(
  acting_participant_id uuid,
  poll_id uuid,
  poll_title text,
  poll_options jsonb,
  allow_text_response boolean,
  poll_status text default 'draft'
)
returns public.festival2026_omrostning_polls
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_title text;
  cleaned_options jsonb;
  normalized_status text;
  option_count integer;
  result_row public.festival2026_omrostning_polls;
begin
  if not public.festival2026_is_forum_admin(acting_participant_id) then
    raise exception 'not forum admin';
  end if;

  cleaned_title := btrim(coalesce(poll_title, ''));
  if cleaned_title = '' then
    raise exception 'title required';
  end if;

  cleaned_options := coalesce(poll_options, '[]'::jsonb);
  if jsonb_typeof(cleaned_options) <> 'array' then
    raise exception 'options must be a json array';
  end if;

  select count(*)::integer
  into option_count
  from jsonb_array_elements_text(cleaned_options) as opt
  where btrim(opt) <> '';

  normalized_status := coalesce(poll_status, 'draft');
  if normalized_status not in ('draft', 'live', 'closed') then
    raise exception 'invalid status';
  end if;

  if option_count < 2 and not coalesce(allow_text_response, false) then
    raise exception 'need at least two options or text responses enabled';
  end if;

  if poll_id is null then
    insert into public.festival2026_omrostning_polls (
      title,
      options,
      allow_text_response,
      status,
      created_by,
      live_at,
      closed_at
    )
    values (
      cleaned_title,
      (
        select coalesce(jsonb_agg(btrim(value)), '[]'::jsonb)
        from jsonb_array_elements_text(cleaned_options) as t(value)
        where btrim(value) <> ''
      ),
      coalesce(allow_text_response, false),
      normalized_status,
      acting_participant_id,
      case when normalized_status = 'live' then now() else null end,
      case when normalized_status = 'closed' then now() else null end
    )
    returning * into result_row;
  else
    update public.festival2026_omrostning_polls p
    set
      title = cleaned_title,
      options = (
        select coalesce(jsonb_agg(btrim(value)), '[]'::jsonb)
        from jsonb_array_elements_text(cleaned_options) as t(value)
        where btrim(value) <> ''
      ),
      allow_text_response = coalesce(allow_text_response, false),
      status = normalized_status,
      live_at = case
        when normalized_status = 'live' and p.live_at is null then now()
        else p.live_at
      end,
      closed_at = case
        when normalized_status = 'closed' and p.closed_at is null then now()
        else p.closed_at
      end
    where p.id = poll_id
    returning * into result_row;

    if result_row.id is null then
      raise exception 'poll not found';
    end if;
  end if;

  return result_row;
end;
$$;

revoke all on function public.save_omrostning_poll_admin(uuid, uuid, text, jsonb, boolean, text) from public;
grant execute on function public.save_omrostning_poll_admin(uuid, uuid, text, jsonb, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: set status only (go live / close)
-- ---------------------------------------------------------------------------

create or replace function public.set_omrostning_poll_status_admin(
  acting_participant_id uuid,
  poll_id uuid,
  new_status text
)
returns public.festival2026_omrostning_polls
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.festival2026_omrostning_polls;
begin
  if not public.festival2026_is_forum_admin(acting_participant_id) then
    raise exception 'not forum admin';
  end if;

  if new_status not in ('draft', 'live', 'closed') then
    raise exception 'invalid status';
  end if;

  update public.festival2026_omrostning_polls p
  set
    status = new_status,
    live_at = case
      when new_status = 'live' and p.live_at is null then now()
      else p.live_at
    end,
    closed_at = case
      when new_status = 'closed' and p.closed_at is null then now()
      else p.closed_at
    end
  where p.id = poll_id
  returning * into result_row;

  if result_row.id is null then
    raise exception 'poll not found';
  end if;

  return result_row;
end;
$$;

revoke all on function public.set_omrostning_poll_status_admin(uuid, uuid, text) from public;
grant execute on function public.set_omrostning_poll_status_admin(uuid, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: submit or update vote (participants)
-- ---------------------------------------------------------------------------

create or replace function public.submit_omrostning_response(
  acting_participant_id uuid,
  target_poll_id uuid,
  selected_option_index integer,
  response_text text
)
returns public.festival2026_omrostning_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  poll_row public.festival2026_omrostning_polls;
  option_count integer;
  cleaned_text text;
  result_row public.festival2026_omrostning_responses;
begin
  if acting_participant_id is null or target_poll_id is null then
    raise exception 'missing ids';
  end if;

  if not exists (
    select 1
    from public.festival2026_deltagare d
    where d.id = acting_participant_id
  ) then
    raise exception 'unknown participant';
  end if;

  select *
  into poll_row
  from public.festival2026_omrostning_polls
  where id = target_poll_id;

  if poll_row.id is null then
    raise exception 'poll not found';
  end if;

  if poll_row.status <> 'live' then
    raise exception 'poll not live';
  end if;

  option_count := jsonb_array_length(coalesce(poll_row.options, '[]'::jsonb));
  cleaned_text := btrim(coalesce(response_text, ''));

  if option_count > 0 then
    if selected_option_index is null then
      raise exception 'option required';
    end if;

    if selected_option_index < 0 or selected_option_index >= option_count then
      raise exception 'invalid option';
    end if;
  else
    selected_option_index := null;
  end if;

  if poll_row.allow_text_response then
    if option_count = 0 and cleaned_text = '' then
      raise exception 'text required';
    end if;
  elsif cleaned_text <> '' then
    raise exception 'text not allowed';
  end if;

  if option_count = 0 and not poll_row.allow_text_response then
    raise exception 'poll misconfigured';
  end if;

  insert into public.festival2026_omrostning_responses (
    poll_id,
    participant_id,
    option_index,
    text_response
  )
  values (
    target_poll_id,
    acting_participant_id,
    selected_option_index,
    case when cleaned_text = '' then null else cleaned_text end
  )
  on conflict (poll_id, participant_id)
  do update set
    option_index = excluded.option_index,
    text_response = excluded.text_response,
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.submit_omrostning_response(uuid, uuid, integer, text) from public;
grant execute on function public.submit_omrostning_response(uuid, uuid, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS (read live polls; responses readable for results UI)
-- ---------------------------------------------------------------------------

alter table public.festival2026_omrostning_polls enable row level security;
alter table public.festival2026_omrostning_responses enable row level security;

drop policy if exists festival2026_omrostning_polls_select_live
  on public.festival2026_omrostning_polls;

create policy festival2026_omrostning_polls_select_live
  on public.festival2026_omrostning_polls
  for select
  to anon, authenticated
  using (status = 'live');

drop policy if exists festival2026_omrostning_responses_select
  on public.festival2026_omrostning_responses;

create policy festival2026_omrostning_responses_select
  on public.festival2026_omrostning_responses
  for select
  to anon, authenticated
  using (true);

grant select on public.festival2026_omrostning_polls to anon, authenticated;
grant select on public.festival2026_omrostning_responses to anon, authenticated;
