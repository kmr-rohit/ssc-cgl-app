-- Challenge hardening (security review, 2026-11-12):
--  * challenges can no longer be listed: a paper is fetched by its exact code through get_challenge(), and answers and
--    solutions are left out until the caller has taken it (or created it)
--  * scores are computed on the server from the submitted answers (submit_challenge); clients can't insert scores
--  * leaderboards come from challenge_leaderboard(): names and scores plus "is me", never other users' ids
--  * expiry and creation time are set by the server; at most 20 new challenges per person per day; the paper's shape is
--    checked; expired challenges are deleted a week after expiry (opportunistically, on each new challenge)

-- ------------------------------------------------------------------ direct table access closes
drop policy if exists "challenges: anyone signed in with the code can read" on public.challenges;
drop policy if exists "challenge_scores: participants and creator read" on public.challenge_scores;
drop policy if exists "challenge_scores: post your own score once" on public.challenge_scores;
revoke select on public.challenges from authenticated;
revoke select, insert on public.challenge_scores from authenticated;
-- inserts and deletes of one's own challenge stay (policies from 20261112103227), limited to these columns
revoke insert on public.challenges from authenticated;
grant insert (code, creator_name, title, exam, paper) on public.challenges to authenticated;

alter table public.challenge_scores add constraint challenge_scores_score_range check (score <= max_score and score >= -max_score);
create index challenges_expires_idx on public.challenges (expires_at);

-- ------------------------------------------------------------------ server-set fields, limits, shape check
create or replace function private.challenge_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.expires_at := now() + interval '60 days';
  if (select count(*) from public.challenges c where c.created_by = new.created_by and c.created_at > now() - interval '1 day') >= 20 then
    raise exception 'You can create up to 20 challenges a day.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(new.paper -> 'sections') is distinct from 'array' or jsonb_typeof(new.paper -> 'questions') is distinct from 'object'
     or jsonb_array_length(new.paper -> 'sections') not between 1 and 6 then
    raise exception 'challenge paper has the wrong shape' using errcode = '23514';
  end if;
  delete from public.challenges c where c.expires_at < now() - interval '7 days';
  return new;
end;
$$;
revoke all on function private.challenge_before_insert() from public, anon, authenticated;
create trigger challenges_before_insert before insert on public.challenges
  for each row execute function private.challenge_before_insert();

-- ------------------------------------------------------------------ read one challenge by code
create or replace function public.get_challenge(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.challenges;
  taken boolean;
  open_key boolean;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into c from public.challenges ch where ch.code = upper(p_code) and ch.expires_at > now();
  if not found then return null; end if;
  taken := exists (select 1 from public.challenge_scores s where s.code = c.code and s.user_id = me);
  open_key := c.created_by = me or taken;
  return jsonb_build_object(
    'code', c.code, 'creator_name', c.creator_name, 'title', c.title, 'exam', c.exam, 'created_at', c.created_at,
    'is_mine', c.created_by = me, 'taken', taken,
    'paper', jsonb_build_object(
      'kind', c.paper -> 'kind', 'rules', c.paper -> 'rules', 'sections', c.paper -> 'sections',
      'questions', (select coalesce(jsonb_object_agg(e.key, case when open_key then e.value else e.value - 'answer' - 'solution' end), '{}'::jsonb)
                    from jsonb_each(c.paper -> 'questions') e)));
end;
$$;

-- ------------------------------------------------------------------ submit answers, scored here
-- p_answers: one array per section, one entry per question: 0-3 or null. Only the first submission counts.
create or replace function public.submit_challenge(p_code text, p_answers jsonb, p_time_ms integer, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.challenges;
  sec jsonb; ids jsonb; ans jsonb; a jsonb; key jsonb;
  i integer; j integer;
  marks numeric; neg numeric; qualifying boolean;
  n_correct integer := 0; n_wrong integer := 0; total numeric := 0; maxs numeric := 0;
  sc integer; sw integer;
  allotted bigint := 0;
  name text := nullif(btrim(coalesce(p_name, '')), '');
  existing public.challenge_scores;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into c from public.challenges ch where ch.code = upper(p_code) and ch.expires_at > now();
  if not found then raise exception 'challenge not found or expired' using errcode = 'P0002'; end if;
  select * into existing from public.challenge_scores s where s.code = c.code and s.user_id = me;
  if found then
    return jsonb_build_object('score', existing.score, 'max', existing.max_score, 'correct', existing.correct, 'wrong', existing.wrong, 'first', false);
  end if;
  if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers) <> jsonb_array_length(c.paper -> 'sections') then
    raise exception 'answers do not match the paper' using errcode = '22023';
  end if;
  marks := coalesce((c.paper -> 'rules' ->> 'marks')::numeric, case c.exam when 'mains' then 3 else 2 end);
  neg   := coalesce((c.paper -> 'rules' ->> 'negative')::numeric, case c.exam when 'mains' then 1 else 0.5 end);
  for i in 0 .. jsonb_array_length(c.paper -> 'sections') - 1 loop
    sec := c.paper -> 'sections' -> i;
    ids := sec -> 'questionIds';
    ans := p_answers -> i;
    if jsonb_typeof(ans) is distinct from 'array' or jsonb_array_length(ans) <> jsonb_array_length(ids) then
      raise exception 'answers do not match the paper' using errcode = '22023';
    end if;
    allotted := allotted + coalesce((sec ->> 'allottedMs')::bigint, 0);
    -- Tier 2 Computer Knowledge is qualifying on a real Tier 2 paper; custom papers (own rules) count every section
    qualifying := c.exam = 'mains' and sec ->> 'subject' = 'computer'
                  and coalesce(c.paper ->> 'kind', 'custom') <> 'custom' and jsonb_typeof(c.paper -> 'rules') is distinct from 'object';
    sc := 0; sw := 0;
    for j in 0 .. jsonb_array_length(ids) - 1 loop
      a := ans -> j;
      if a is null or a = 'null'::jsonb then continue; end if;
      if jsonb_typeof(a) <> 'number' or (a #>> '{}')::numeric not in (0, 1, 2, 3) then
        raise exception 'answers must be 0 to 3 or null' using errcode = '22023';
      end if;
      key := c.paper -> 'questions' -> (ids ->> j) -> 'answer';
      if key is not null and (key #>> '{}')::numeric = (a #>> '{}')::numeric then sc := sc + 1; else sw := sw + 1; end if;
    end loop;
    n_correct := n_correct + sc; n_wrong := n_wrong + sw;
    if not qualifying then
      total := total + sc * marks - sw * neg;
      maxs := maxs + jsonb_array_length(ids) * marks;
    end if;
  end loop;
  if maxs <= 0 then maxs := 1; end if;
  insert into public.challenge_scores (code, user_id, display_name, score, max_score, correct, wrong, time_ms)
  values (c.code, me, left(coalesce(name, 'Friend'), 40), total, maxs, n_correct, n_wrong,
          least(greatest(coalesce(p_time_ms, 0), 0), greatest(allotted, 0) + 60000, 86400000 - 1))
  on conflict (code, user_id) do nothing;
  return jsonb_build_object('score', total, 'max', maxs, 'correct', n_correct, 'wrong', n_wrong, 'first', true);
end;
$$;

-- ------------------------------------------------------------------ leaderboard (people who took it, and the creator)
create or replace function public.challenge_leaderboard(p_code text)
returns table (display_name text, score numeric, max_score numeric, correct integer, wrong integer, time_ms integer, submitted_at timestamptz, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.can_view_challenge_scores(upper(p_code)) then
    raise exception 'take the challenge to see the scores' using errcode = '42501';
  end if;
  return query
  select s.display_name, s.score, s.max_score, s.correct, s.wrong, s.time_ms, s.submitted_at, s.user_id = (select auth.uid())
  from public.challenge_scores s where s.code = upper(p_code)
  order by s.score desc, s.time_ms asc, s.submitted_at asc
  limit 500;
end;
$$;

revoke all on function public.get_challenge(text), public.submit_challenge(text, jsonb, integer, text), public.challenge_leaderboard(text) from public, anon;
grant execute on function public.get_challenge(text), public.submit_challenge(text, jsonb, integer, text), public.challenge_leaderboard(text) to authenticated;
