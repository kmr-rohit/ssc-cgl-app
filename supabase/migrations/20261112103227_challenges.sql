-- Challenge a friend: a shared paper (same questions, same rules) behind a 6-letter code, plus everyone's first score.
-- Anyone signed in who has the code can read the challenge. Scores are visible only to people who took it and its creator.

create table public.challenges (
  code         text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),          -- no 0/O/1/I to avoid misreading
  created_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creator_name text not null check (char_length(creator_name) between 1 and 40),
  title        text not null check (char_length(title) between 1 and 80),
  exam         text not null check (exam in ('pre', 'mains', 'stats')),
  paper        jsonb not null check (pg_column_size(paper) < 400000),          -- rules, sections, question snapshot
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '60 days'
);
create index challenges_created_by_idx on public.challenges (created_by);

create table public.challenge_scores (
  code         text not null references public.challenges (code) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  score        numeric(7, 2) not null,
  max_score    numeric(7, 2) not null check (max_score > 0),
  correct      integer not null check (correct >= 0),
  wrong        integer not null check (wrong >= 0),
  time_ms      integer not null check (time_ms >= 0),
  submitted_at timestamptz not null default now(),
  primary key (code, user_id)                                                 -- one score per person: the first attempt
);
create index challenge_scores_user_idx on public.challenge_scores (user_id);

-- Can the caller see this challenge's scores? (took it, or created it). SECURITY DEFINER avoids RLS recursion on
-- challenge_scores; it lives in the unexposed private schema, checks only the caller's own id, and is not callable via the API.
create or replace function private.can_view_challenge_scores(c text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.challenge_scores s where s.code = c and s.user_id = (select auth.uid()))
      or exists (select 1 from public.challenges ch where ch.code = c and ch.created_by = (select auth.uid()));
$$;
revoke all on function private.can_view_challenge_scores(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.can_view_challenge_scores(text) to authenticated;

-- grants: nothing for anon; no updates (a challenge and a score are fixed once written)
revoke all on public.challenges, public.challenge_scores from anon, authenticated;
grant select, insert, delete on public.challenges to authenticated;
grant select, insert on public.challenge_scores to authenticated;

alter table public.challenges enable row level security;
alter table public.challenge_scores enable row level security;

create policy "challenges: anyone signed in with the code can read" on public.challenges
  for select to authenticated using (expires_at > now());
create policy "challenges: create as yourself" on public.challenges
  for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "challenges: delete your own" on public.challenges
  for delete to authenticated using ((select auth.uid()) = created_by);

create policy "challenge_scores: participants and creator read" on public.challenge_scores
  for select to authenticated using ((select private.can_view_challenge_scores(code)));
create policy "challenge_scores: post your own score once" on public.challenge_scores
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.challenges ch where ch.code = challenge_scores.code and ch.expires_at > now())
  );
