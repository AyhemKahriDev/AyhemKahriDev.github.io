-- Starstruck global leaderboard schema.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: it drops and recreates the leaderboard view, but leaves data intact.

-- Public display names, one per authenticated user. Emails stay private in
-- auth.users and are never exposed through the API.
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique not null check (char_length(username) between 3 and 16),
  created_at timestamptz not null default now()
);

-- Every submitted run. We keep all runs and surface each player's best via the
-- leaderboard view below. The CHECK is a cheap sanity bound on scores.
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  score      integer not null check (score >= 0 and score <= 100000000),
  created_at timestamptz not null default now()
);
create index if not exists scores_user_idx  on public.scores (user_id);
create index if not exists scores_score_idx on public.scores (score desc);

alter table public.profiles enable row level security;
alter table public.scores   enable row level security;

-- Profiles: readable by everyone (needed to show names); writable only by owner.
drop policy if exists "profiles readable by all"      on public.profiles;
drop policy if exists "users insert own profile"       on public.profiles;
drop policy if exists "users update own profile"       on public.profiles;
create policy "profiles readable by all" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

-- Scores: readable by everyone; a user may only insert rows for themselves.
drop policy if exists "scores readable by all" on public.scores;
drop policy if exists "users insert own scores" on public.scores;
create policy "scores readable by all"  on public.scores for select using (true);
create policy "users insert own scores" on public.scores for insert with check (auth.uid() = user_id);

-- Best score per player, joined to their public name. security_invoker means the
-- view respects the caller's RLS (both tables are publicly readable above).
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
  select p.username,
         max(s.score)  as best_score,
         count(s.id)   as runs,
         max(s.created_at) as last_played
  from public.scores s
  join public.profiles p on p.id = s.user_id
  group by p.username;

grant select on public.leaderboard to anon, authenticated;
