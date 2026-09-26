-- Only if you previously ran forum-polls-rls.sql and want to remove it.
-- Safe to skip for new setups.

drop trigger if exists festival2026_forum_posts_poll_rules
  on public.festival2026_forum_posts;

drop function if exists public.enforce_forum_poll_post_rules();

drop policy if exists festival2026_forum_posts_poll_insert_restrict
  on public.festival2026_forum_posts;

drop policy if exists festival2026_forum_posts_poll_child_insert_restrict
  on public.festival2026_forum_posts;

drop policy if exists festival2026_forum_posts_poll_vote_insert_restrict
  on public.festival2026_forum_posts;

drop policy if exists festival2026_forum_posts_poll_vote_update_restrict
  on public.festival2026_forum_posts;
