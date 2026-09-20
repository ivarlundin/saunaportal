-- Forum admin flag + delete permissions for festival2026_forum_posts
-- Run in Supabase SQL Editor (review policies for your auth setup).

-- 1) Admin column on participants
alter table public.festival2026_deltagare
  add column if not exists is_forum_admin boolean not null default false;

comment on column public.festival2026_deltagare.is_forum_admin is
  'When true, participant may delete any forum post/comment via RLS.';

-- Example: grant forum admin to @ivve (adjust alias as needed)
update public.festival2026_deltagare
set is_forum_admin = true
where lower(alias) = 'ivve';

-- 2) Align column types (required before FK cascades)
-- Your schema has id uuid + is_child_post text — Postgres cannot FK text → uuid.

alter table public.festival2026_forum_posts
  alter column is_child_post type uuid
  using (
    case
      when is_child_post is null then null
      when btrim(is_child_post::text) = '' then null
      else is_child_post::uuid
    end
  );

-- If reactions.post_id is still text, align it too (safe if already uuid).
do $$
begin
  alter table public.festival2026_forum_reactions
    alter column post_id type uuid
    using post_id::uuid;
exception
  when others then
    raise notice 'festival2026_forum_reactions.post_id type unchanged: %', sqlerrm;
end $$;

-- 3) Cascade deletes: replies + reactions when a thread or comment is removed
alter table public.festival2026_forum_posts
  drop constraint if exists festival2026_forum_posts_is_child_post_fkey;

alter table public.festival2026_forum_posts
  add constraint festival2026_forum_posts_is_child_post_fkey
  foreign key (is_child_post)
  references public.festival2026_forum_posts (id)
  on delete cascade;

alter table public.festival2026_forum_reactions
  drop constraint if exists festival2026_forum_reactions_post_id_fkey;

alter table public.festival2026_forum_reactions
  add constraint festival2026_forum_reactions_post_id_fkey
  foreign key (post_id)
  references public.festival2026_forum_posts (id)
  on delete cascade;

-- 4) RLS delete policies (optional — skip until auth is linked on deltagare)
-- festival2026_deltagare has no user_id column today; the forum uses RPC below.
-- When you add auth.users → deltagare, you can enable policies like:
--
-- alter table public.festival2026_deltagare
--   add column if not exists auth_user_id uuid references auth.users (id);
--
-- create policy "forum_posts_delete_forum_admin" on public.festival2026_forum_posts
-- for delete to authenticated using (
--   exists (
--     select 1 from public.festival2026_deltagare d
--     where d.auth_user_id = auth.uid() and d.is_forum_admin is true
--   )
-- );

-- 5) RPC delete for the publishable/anon forum client
-- Cascades replies + reactions even if FK step 3 was skipped earlier.
create or replace function public.delete_forum_post_as_admin(
  target_post_id uuid,
  acting_participant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if acting_participant_id is null or target_post_id is null then
    raise exception 'missing ids';
  end if;

  if not exists (
    select 1
    from public.festival2026_deltagare d
    where d.id = acting_participant_id
      and d.is_forum_admin is true
  ) then
    raise exception 'not forum admin';
  end if;

  delete from public.festival2026_forum_reactions r
  using public.festival2026_forum_posts p
  where r.post_id = p.id
    and (
      p.id = target_post_id
      or p.is_child_post = target_post_id
    );

  delete from public.festival2026_forum_posts
  where is_child_post = target_post_id;

  delete from public.festival2026_forum_reactions
  where post_id = target_post_id;

  delete from public.festival2026_forum_posts
  where id = target_post_id;
end;
$$;

revoke all on function public.delete_forum_post_as_admin(uuid, uuid) from public;
grant execute on function public.delete_forum_post_as_admin(uuid, uuid) to anon, authenticated;
