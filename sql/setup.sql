-- ============================================================
-- One-time setup for cross-device sync.
--
-- Paste this whole file into your Supabase project:
--   SQL Editor → New query → paste → Run.
--
-- It creates one table holding one JSON document per user, and the
-- row-level security policies that make sure each account can only ever
-- see its own row. That's what makes it safe to ship the anon key in a
-- public GitHub Pages site.
-- ============================================================

create table if not exists public.channel_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.channel_data enable row level security;

-- Each policy is scoped to auth.uid(), i.e. the signed-in user's own row.
drop policy if exists "read own data"   on public.channel_data;
drop policy if exists "insert own data" on public.channel_data;
drop policy if exists "update own data" on public.channel_data;
drop policy if exists "delete own data" on public.channel_data;

create policy "read own data" on public.channel_data
  for select using (auth.uid() = user_id);

create policy "insert own data" on public.channel_data
  for insert with check (auth.uid() = user_id);

create policy "update own data" on public.channel_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own data" on public.channel_data
  for delete using (auth.uid() = user_id);
