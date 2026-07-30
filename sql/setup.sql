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

-- Defence in depth. The app only ever touches this table while signed in, so
-- take it away from the anonymous role altogether. Supabase grants both `anon`
-- and `authenticated` full table privileges by default and relies purely on
-- RLS; this way, if RLS were ever switched off by accident, an unauthenticated
-- request is still refused instead of dumping every row.
revoke all on public.channel_data from anon;
grant select, insert, update, delete on public.channel_data to authenticated;

-- ------------------------------------------------------------------
-- Sanity check (optional): run these two and confirm the output.
--   1) rls_enabled should be true
--   2) four policies, one each for select / insert / update / delete
-- ------------------------------------------------------------------
-- select relrowsecurity as rls_enabled
--   from pg_class where oid = 'public.channel_data'::regclass;
-- select policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'channel_data' order by cmd;
