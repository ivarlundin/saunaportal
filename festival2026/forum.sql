-- SaunaPortal Festival 2026 forum
-- Run this in Supabase SQL Editor.

create table if not exists public.festival2026_forum_posts (
    id uuid not null default gen_random_uuid(),
    participant_id uuid not null,
    body text not null,
    created_at timestamp with time zone not null default now(),
    is_child_post text null,
    constraint festival2026_forum_posts_pkey primary key (id),
    constraint festival2026_forum_posts_participant_fkey
        foreign key (participant_id)
        references public.festival2026_deltagare (id)
        on delete cascade,
    constraint festival2026_forum_posts_body_not_empty
        check (char_length(trim(body)) between 1 and 1000)
);

-- Safe migration for databases where the forum table already exists.
alter table public.festival2026_forum_posts
    add column if not exists is_child_post text null;

create table if not exists public.festival2026_forum_reactions (
    id uuid not null default gen_random_uuid(),
    post_id uuid not null,
    participant_id uuid not null,
    reaction text not null default 'thumbs_up',
    created_at timestamp with time zone not null default now(),
    constraint festival2026_forum_reactions_pkey primary key (id),
    constraint festival2026_forum_reactions_post_fkey
        foreign key (post_id)
        references public.festival2026_forum_posts (id)
        on delete cascade,
    constraint festival2026_forum_reactions_participant_fkey
        foreign key (participant_id)
        references public.festival2026_deltagare (id)
        on delete cascade,
    constraint festival2026_forum_reactions_type_check
        check (reaction = 'thumbs_up'),
    constraint festival2026_forum_reactions_unique_reaction
        unique (post_id, participant_id, reaction)
);

create index if not exists festival2026_forum_posts_latest_idx
    on public.festival2026_forum_posts (created_at desc);

create index if not exists festival2026_forum_reactions_post_idx
    on public.festival2026_forum_reactions (post_id);

alter table public.festival2026_forum_posts enable row level security;
alter table public.festival2026_forum_reactions enable row level security;

-- This project identifies participants with a local participant id rather
-- than Supabase Auth. These policies allow the existing public client flow.
create policy "Forum posts are publicly readable"
    on public.festival2026_forum_posts
    for select
    to anon, authenticated
    using (true);

create policy "Forum posts can be created"
    on public.festival2026_forum_posts
    for insert
    to anon, authenticated
    with check (true);

create policy "Forum reactions are publicly readable"
    on public.festival2026_forum_reactions
    for select
    to anon, authenticated
    using (true);

create policy "Forum reactions can be created"
    on public.festival2026_forum_reactions
    for insert
    to anon, authenticated
    with check (true);

create policy "Forum reactions can be removed"
    on public.festival2026_forum_reactions
    for delete
    to anon, authenticated
    using (true);
