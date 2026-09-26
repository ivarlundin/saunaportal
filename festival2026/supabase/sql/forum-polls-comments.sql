-- Optional comments on poll posts (vote rows unchanged).
-- Run in Supabase SQL Editor after forum-polls.sql.

alter table public.festival2026_forum_posts
  add column if not exists poll_allow_comments boolean not null default false;

comment on column public.festival2026_forum_posts.poll_allow_comments is
  'When true, users may post text comments on this poll (votes still use poll_option_index).';
