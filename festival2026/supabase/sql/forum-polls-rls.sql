-- Poll rules for festival2026_forum_posts (RLS + triggers)
-- Run after forum-polls.sql (and forum-admin-delete.sql for is_forum_admin).
--
-- The festival client uses the anon key and sends participant_id from the browser.
-- RESTRICTIVE RLS policies AND with your existing permissive policies; triggers
-- enforce the same rules even if RLS is wide open.

-- ---------------------------------------------------------------------------
-- 1) Trigger helpers (integrity)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_forum_poll_post_rules()
returns trigger
language plpgsql
as $$
declare
  parent_row public.festival2026_forum_posts%rowtype;
  option_count integer;
  expected_label text;
begin
  if tg_op = 'UPDATE' then
    if old.is_poll is distinct from new.is_poll
      or old.poll_options is distinct from new.poll_options then
      if not exists (
        select 1
        from public.festival2026_deltagare d
        where d.id = new.participant_id
          and d.is_forum_admin is true
      ) then
        raise exception 'only forum admins can change poll metadata';
      end if;
    end if;

    if old.poll_option_index is not null then
      if new.participant_id is distinct from old.participant_id
        or new.is_child_post is distinct from old.is_child_post then
        raise exception 'cannot reassign poll vote';
      end if;

      if new.is_poll is distinct from old.is_poll
        or new.poll_options is distinct from old.poll_options then
        raise exception 'invalid poll vote update';
      end if;
    end if;
  end if;

  if new.is_child_post is null then
    if coalesce(new.is_poll, false) then
      if not exists (
        select 1
        from public.festival2026_deltagare d
        where d.id = new.participant_id
          and d.is_forum_admin is true
      ) then
        raise exception 'only forum admins can create polls';
      end if;

      if new.poll_options is null
        or jsonb_typeof(new.poll_options) <> 'array'
        or jsonb_array_length(new.poll_options) < 2 then
        raise exception 'poll must have at least 2 options';
      end if;

      new.poll_option_index := null;
    else
      new.is_poll := false;
      new.poll_options := null;
      new.poll_option_index := null;
    end if;

    return new;
  end if;

  select *
  into parent_row
  from public.festival2026_forum_posts
  where id = new.is_child_post;

  if not found then
    raise exception 'parent post not found';
  end if;

  if coalesce(parent_row.is_poll, false) then
    if new.poll_option_index is null then
      raise exception 'poll posts do not accept text replies; use a vote row';
    end if;

    if parent_row.poll_options is null
      or jsonb_typeof(parent_row.poll_options) <> 'array' then
      raise exception 'poll parent has no options';
    end if;

    option_count := jsonb_array_length(parent_row.poll_options);

    if new.poll_option_index < 0
      or new.poll_option_index >= option_count then
      raise exception 'invalid poll option index';
    end if;

    expected_label :=
      trim(both from parent_row.poll_options ->> new.poll_option_index);

    if expected_label is null or expected_label = '' then
      raise exception 'empty poll option label';
    end if;

    new.body := expected_label;
    new.is_poll := false;
    new.poll_options := null;
  else
    if new.poll_option_index is not null then
      raise exception 'poll_option_index only allowed on poll votes';
    end if;

    new.is_poll := false;
    new.poll_options := null;
  end if;

  return new;
end;
$$;

drop trigger if exists festival2026_forum_posts_poll_rules
  on public.festival2026_forum_posts;

create trigger festival2026_forum_posts_poll_rules
  before insert or update
  on public.festival2026_forum_posts
  for each row
  execute function public.enforce_forum_poll_post_rules();

-- ---------------------------------------------------------------------------
-- 2) RESTRICTIVE RLS (AND with existing permissive policies)
-- ---------------------------------------------------------------------------
-- Requires RLS already enabled on festival2026_forum_posts with permissive
-- SELECT/INSERT/UPDATE policies for normal forum use. Do not enable RLS here
-- unless those policies exist, or the forum will reject all access.

drop policy if exists festival2026_forum_posts_poll_insert_restrict
  on public.festival2026_forum_posts;

create policy festival2026_forum_posts_poll_insert_restrict
  on public.festival2026_forum_posts
  as restrictive
  for insert
  to anon, authenticated
  with check (
    coalesce(is_poll, false) = false
    or (
      is_child_post is null
      and exists (
        select 1
        from public.festival2026_deltagare d
        where d.id = participant_id
          and d.is_forum_admin is true
      )
    )
  );

drop policy if exists festival2026_forum_posts_poll_child_insert_restrict
  on public.festival2026_forum_posts;

create policy festival2026_forum_posts_poll_child_insert_restrict
  on public.festival2026_forum_posts
  as restrictive
  for insert
  to anon, authenticated
  with check (
    is_child_post is null
    or not exists (
      select 1
      from public.festival2026_forum_posts p
      where p.id = is_child_post
        and coalesce(p.is_poll, false)
    )
    or poll_option_index is not null
  );

drop policy if exists festival2026_forum_posts_poll_vote_insert_restrict
  on public.festival2026_forum_posts;

create policy festival2026_forum_posts_poll_vote_insert_restrict
  on public.festival2026_forum_posts
  as restrictive
  for insert
  to anon, authenticated
  with check (
    poll_option_index is null
    or exists (
      select 1
      from public.festival2026_forum_posts p
      where p.id = is_child_post
        and coalesce(p.is_poll, false)
    )
  );

drop policy if exists festival2026_forum_posts_poll_vote_update_restrict
  on public.festival2026_forum_posts;

create policy festival2026_forum_posts_poll_vote_update_restrict
  on public.festival2026_forum_posts
  as restrictive
  for update
  to anon, authenticated
  using (true)
  with check (
    poll_option_index is null
    or (
      participant_id is not null
      and is_child_post is not null
      and coalesce(is_poll, false) = false
      and poll_options is null
    )
  );

comment on policy festival2026_forum_posts_poll_insert_restrict
  on public.festival2026_forum_posts is
  'Only forum admins may create top-level poll posts (is_poll = true).';

comment on policy festival2026_forum_posts_poll_child_insert_restrict
  on public.festival2026_forum_posts is
  'Poll threads accept vote rows only (poll_option_index set), not text comments.';
