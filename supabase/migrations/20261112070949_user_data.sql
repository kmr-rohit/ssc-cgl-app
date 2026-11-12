-- CGL Prep: per-user data (M2).
-- Every table is owned by one user. Access = explicit GRANT (Data API) + RLS ownership policies.
-- Nothing is granted to anon. Devices sync with last-write-wins on updated_at (see private.keep_newest).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Last-write-wins: ignore an update that is older than what is stored (a stale offline device).
create or replace function private.keep_newest()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null; -- skip this row update
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb check (pg_column_size(settings) < 8192),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ attempts (append-only answers)
-- id is a client-generated UUIDv7 (time-ordered): retries are idempotent, inserts stay sequential.
create table public.attempts (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) <= 200),
  rev         smallint not null default 1 check (rev >= 1),
  topic       text not null check (char_length(topic) <= 40),
  type        text not null check (char_length(type) <= 60),
  level       smallint not null check (level between 1 and 3),
  chosen      smallint check (chosen between 0 and 3),
  correct     boolean not null,
  ms          integer not null check (ms >= 0 and ms < 86400000),
  mode        text not null check (mode in ('learn', 'test', 'mock')),
  mock_key    text check (char_length(mock_key) <= 80),
  answered_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index attempts_user_answered_idx on public.attempts (user_id, answered_at);

-- ------------------------------------------------------------------ mocks (one row per paper)
create table public.mocks (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null check (char_length(key) <= 80),
  exam       text not null check (exam in ('pre', 'mains', 'stats')),
  status     text not null check (status in ('not-started', 'in-progress', 'submitted')),
  record     jsonb not null check (pg_column_size(record) < 512000),
  updated_at timestamptz not null,
  primary key (user_id, key)
);

-- ------------------------------------------------------------------ flashcard scheduling
create table public.srs_cards (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id    text not null check (char_length(card_id) <= 80),
  state      jsonb not null check (pg_column_size(state) < 1024),
  updated_at timestamptz not null,
  primary key (user_id, card_id)
);

-- ------------------------------------------------------------------ small key/value settings
create table public.kv (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null check (char_length(key) <= 80),
  value      jsonb check (pg_column_size(value) < 65536),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ------------------------------------------------------------------ last-write-wins triggers
create trigger profiles_keep_newest before update on public.profiles for each row execute function private.keep_newest();
create trigger mocks_keep_newest before update on public.mocks for each row execute function private.keep_newest();
create trigger srs_cards_keep_newest before update on public.srs_cards for each row execute function private.keep_newest();
create trigger kv_keep_newest before update on public.kv for each row execute function private.keep_newest();

-- ------------------------------------------------------------------ grants (explicit; nothing for anon)
revoke all on public.profiles, public.attempts, public.mocks, public.srs_cards, public.kv from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.mocks, public.srs_cards, public.kv to authenticated;
grant select, insert, delete on public.attempts to authenticated; -- answers are never edited

-- ------------------------------------------------------------------ row level security
alter table public.profiles  enable row level security;
alter table public.attempts  enable row level security;
alter table public.mocks     enable row level security;
alter table public.srs_cards enable row level security;
alter table public.kv        enable row level security;

-- profiles
create policy "profiles: read own"   on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles: update own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles: delete own" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

-- attempts (no update policy: append-only)
create policy "attempts: read own"   on public.attempts for select to authenticated using ((select auth.uid()) = user_id);
create policy "attempts: insert own" on public.attempts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "attempts: delete own" on public.attempts for delete to authenticated using ((select auth.uid()) = user_id);

-- mocks
create policy "mocks: read own"   on public.mocks for select to authenticated using ((select auth.uid()) = user_id);
create policy "mocks: insert own" on public.mocks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mocks: update own" on public.mocks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "mocks: delete own" on public.mocks for delete to authenticated using ((select auth.uid()) = user_id);

-- srs_cards
create policy "srs_cards: read own"   on public.srs_cards for select to authenticated using ((select auth.uid()) = user_id);
create policy "srs_cards: insert own" on public.srs_cards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "srs_cards: update own" on public.srs_cards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "srs_cards: delete own" on public.srs_cards for delete to authenticated using ((select auth.uid()) = user_id);

-- kv
create policy "kv: read own"   on public.kv for select to authenticated using ((select auth.uid()) = user_id);
create policy "kv: insert own" on public.kv for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "kv: update own" on public.kv for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kv: delete own" on public.kv for delete to authenticated using ((select auth.uid()) = user_id);
