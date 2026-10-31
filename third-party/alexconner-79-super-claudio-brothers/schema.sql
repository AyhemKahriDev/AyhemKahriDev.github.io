-- Super Claudio Brothers — Supabase schema
-- Run this in the Supabase SQL editor for your project.

-- Scores table
create table if not exists scores (
  id         bigint generated always as identity primary key,
  initials   text        not null check (char_length(initials) <= 3),
  score      integer     not null check (score >= 0),
  created_at timestamptz not null default now()
);

-- Index for fast leaderboard queries
create index if not exists scores_score_desc on scores (score desc);

-- Enable Row Level Security
alter table scores enable row level security;

-- Anyone can read scores (for the leaderboard)
create policy "Public read"
  on scores for select
  using (true);

-- Anyone can insert a score (anonymous play)
create policy "Public insert"
  on scores for insert
  with check (true);

-- Nobody can update or delete scores
-- (no update/delete policies = blocked by RLS)
