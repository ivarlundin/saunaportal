-- Widen forum reaction types to match festival2026/forum.js
alter table festival2026_forum_reactions
  drop constraint if exists festival2026_forum_reactions_type_check;

alter table festival2026_forum_reactions
  add constraint festival2026_forum_reactions_type_check
  check (reaction in ('thumbs_up', 'thumbs_down', 'eyes', 'cool'));
