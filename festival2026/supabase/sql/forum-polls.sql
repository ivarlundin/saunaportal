-- Forum polls on festival2026_forum_posts
-- Run in Supabase SQL Editor before using poll UI.

-- Poll parent rows: is_poll = true, poll_options = JSON array of strings
-- Vote rows: is_child_post = poll id, poll_option_index = 0..n-1, body = option label

alter table public.festival2026_forum_posts
  add column if not exists is_poll boolean not null default false;

alter table public.festival2026_forum_posts
  add column if not exists poll_options jsonb;

alter table public.festival2026_forum_posts
  add column if not exists poll_option_index integer;

comment on column public.festival2026_forum_posts.is_poll is
  'Top-level post is a poll (only admins create via app).';

comment on column public.festival2026_forum_posts.poll_options is
  'JSON array of option labels on poll posts, e.g. ["Ja","Nej"].';

comment on column public.festival2026_forum_posts.poll_option_index is
  'Selected option index on vote rows (child of poll).';

-- One vote per participant per poll
drop index if exists festival2026_forum_poll_vote_unique;

create unique index festival2026_forum_poll_vote_unique
  on public.festival2026_forum_posts (is_child_post, participant_id)
  where poll_option_index is not null and is_child_post is not null;

-- Optional: constrain index range (application also validates)
alter table public.festival2026_forum_posts
  drop constraint if exists festival2026_forum_posts_poll_option_index_check;

alter table public.festival2026_forum_posts
  add constraint festival2026_forum_posts_poll_option_index_check
  check (
    poll_option_index is null
    or poll_option_index >= 0
  );
