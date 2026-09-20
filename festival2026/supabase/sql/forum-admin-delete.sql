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

-- 2) Cascade deletes: replies + reactions when a thread or comment is removed
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

-- 3) RLS: allow forum admins to delete any post/comment
-- Requires festival2026_deltagare.user_id = auth.uid() for logged-in users.
-- If your forum still uses the anon key only, add a matching anon policy or move deletes to an Edge Function.

alter table public.festival2026_forum_posts enable row level security;

drop policy if exists "forum_posts_delete_forum_admin" on public.festival2026_forum_posts;

create policy "forum_posts_delete_forum_admin"
on public.festival2026_forum_posts
for delete
to authenticated
using (
  exists (
    select 1
    from public.festival2026_deltagare d
    where d.user_id = auth.uid()
      and d.is_forum_admin is true
  )
);

-- Optional: let authors delete their own posts (in addition to admins)
drop policy if exists "forum_posts_delete_own" on public.festival2026_forum_posts;

create policy "forum_posts_delete_own"
on public.festival2026_forum_posts
for delete
to authenticated
using (
  exists (
    select 1
    from public.festival2026_deltagare d
    where d.user_id = auth.uid()
      and d.id = festival2026_forum_posts.participant_id
  )
);

-- 4) RPC delete for the current static forum client (publishable/anon key)
-- Verifies acting_participant_id has is_forum_admin before deleting.
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

  delete from public.festival2026_forum_posts
  where id = target_post_id;
end;
$$;

revoke all on function public.delete_forum_post_as_admin(uuid, uuid) from public;
grant execute on function public.delete_forum_post_as_admin(uuid, uuid) to anon, authenticated;
