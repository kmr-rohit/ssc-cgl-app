-- "Report a mistake" on any question, and the admin dashboard's read functions.
-- Students can file reports and see only their own. Admins (listed in private.admins, added by hand) read aggregates
-- through SECURITY DEFINER functions that check the caller first. No function returns emails or names.

-- ------------------------------------------------------------------ reports
create table public.content_reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 200),
  rev         smallint not null default 1 check (rev >= 1),
  reason      text not null check (reason in ('wrong-answer', 'wrong-question', 'solution', 'figure', 'typo', 'other')),
  note        text not null default '' check (char_length(note) <= 500),
  status      text not null default 'open' check (status in ('open', 'fixed', 'rejected')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, question_id, rev)                                   -- one report per person per question version
);
create index content_reports_question_idx on public.content_reports (question_id);
create index content_reports_open_idx on public.content_reports (created_at desc) where status = 'open';

revoke all on public.content_reports from anon, authenticated;
grant select on public.content_reports to authenticated;
grant insert (question_id, rev, reason, note) on public.content_reports to authenticated;   -- status and user_id are not theirs to set
alter table public.content_reports enable row level security;
create policy "content_reports: read own" on public.content_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "content_reports: file as yourself" on public.content_reports
  for insert to authenticated with check ((select auth.uid()) = user_id and status = 'open');

-- admin dashboard aggregates scan attempts by time, across users
create index attempts_answered_at_idx on public.attempts (answered_at);
create index attempts_question_idx on public.attempts (question_id);

-- ------------------------------------------------------------------ admins
create table private.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
revoke all on private.admins from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public, anon, authenticated;

create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

-- ------------------------------------------------------------------ admin API (callable by signed-in users; non-admins get 42501)
create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

-- Headline numbers plus one row per India-time day for the last `days` days.
create or replace function public.admin_overview(days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n   integer := least(greatest(coalesce(days, 30), 7), 180);
  ist text := 'Asia/Kolkata';
  today date := (now() at time zone 'Asia/Kolkata')::date;
  out jsonb;
begin
  perform private.require_admin();
  with
  d as (select generate_series(today - (n - 1), today, interval '1 day')::date as day),
  su as (select (u.created_at at time zone ist)::date as day, count(*) as c from auth.users u
         where u.created_at >= (today - (n - 1))::timestamp at time zone ist group by 1),
  act as (select (a.answered_at at time zone ist)::date as day, count(*) as answers, count(distinct a.user_id) as users
          from public.attempts a where a.answered_at >= (today - (n - 1))::timestamp at time zone ist group by 1),
  mk as (select (m.updated_at at time zone ist)::date as day, count(*) as c from public.mocks m
         where m.status = 'submitted' and m.updated_at >= (today - (n - 1))::timestamp at time zone ist group by 1),
  returning_users as (
    select count(*) as c from (
      select a.user_id from public.attempts a where a.answered_at > now() - interval '7 days'
      group by a.user_id having count(distinct (a.answered_at at time zone ist)::date) >= 2) x)
  select jsonb_build_object(
    'users',            (select count(*) from auth.users),
    'signedInOnce',     (select count(*) from auth.users u where u.last_sign_in_at is not null),
    'new7d',            (select count(*) from auth.users u where u.created_at > now() - interval '7 days'),
    'active1d',         (select count(distinct a.user_id) from public.attempts a where a.answered_at > now() - interval '1 day'),
    'active7d',         (select count(distinct a.user_id) from public.attempts a where a.answered_at > now() - interval '7 days'),
    'active30d',        (select count(distinct a.user_id) from public.attempts a where a.answered_at > now() - interval '30 days'),
    'returning7d',      (select c from returning_users),
    'answers7d',        (select count(*) from public.attempts a where a.answered_at > now() - interval '7 days'),
    'accuracy7d',       (select round(avg(case when a.correct then 1 else 0 end)::numeric, 3) from public.attempts a
                         where a.answered_at > now() - interval '7 days' and a.chosen is not null),
    'mocksSubmitted7d', (select count(*) from public.mocks m where m.status = 'submitted' and m.updated_at > now() - interval '7 days'),
    'mocksSubmitted',   (select count(*) from public.mocks m where m.status = 'submitted'),
    'challenges',       (select count(*) from public.challenges),
    'challengeScores',  (select count(*) from public.challenge_scores),
    'reportsOpen',      (select count(*) from public.content_reports r where r.status = 'open'),
    'reportsOpenQuestions', (select count(distinct r.question_id) from public.content_reports r where r.status = 'open'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', d.day, 'signups', coalesce(su.c, 0), 'active', coalesce(act.users, 0),
                'answers', coalesce(act.answers, 0), 'mocks', coalesce(mk.c, 0)) order by d.day), '[]'::jsonb)
              from d left join su on su.day = d.day left join act on act.day = d.day left join mk on mk.day = d.day)
  ) into out;
  return out;
end;
$$;

-- Questions whose answer key may be wrong: many people answer, few get it right, or most wrong answers pick the same option.
create or replace function public.admin_question_health(min_attempts integer default 5, max_rows integer default 60)
returns table (question_id text, rev smallint, topic text, answers integer, accuracy numeric, top_wrong smallint, top_wrong_share numeric, reports integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  with s as (
    select a.question_id, a.rev, max(a.topic) as topic, count(*)::integer as answers,
           avg(case when a.correct then 1 else 0 end)::numeric as accuracy
    from public.attempts a where a.chosen is not null
    group by a.question_id, a.rev having count(*) >= greatest(coalesce(min_attempts, 5), 3)
  ), w as (
    select a.question_id, a.rev, a.chosen, count(*) as c,
           row_number() over (partition by a.question_id, a.rev order by count(*) desc, a.chosen) as rk
    from public.attempts a where a.chosen is not null and not a.correct
    group by a.question_id, a.rev, a.chosen
  )
  select s.question_id, s.rev, s.topic, s.answers, round(s.accuracy, 3),
         w.chosen, round(coalesce(w.c, 0)::numeric / s.answers, 3),
         (select count(*)::integer from public.content_reports r where r.question_id = s.question_id and r.status = 'open')
  from s left join w on w.question_id = s.question_id and w.rev = s.rev and w.rk = 1
  where s.accuracy < 0.3 or coalesce(w.c, 0)::numeric / s.answers >= 0.5
  order by coalesce(w.c, 0)::numeric / s.answers desc, s.accuracy asc
  limit least(greatest(coalesce(max_rows, 60), 1), 500);
end;
$$;

-- Accuracy and volume by topic, hardest first.
create or replace function public.admin_topics(days integer default 30)
returns table (topic text, answers integer, users integer, accuracy numeric, avg_seconds numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select a.topic, count(*)::integer, count(distinct a.user_id)::integer,
         round(avg(case when a.correct then 1 else 0 end)::numeric, 3), round(avg(a.ms)::numeric / 1000, 1)
  from public.attempts a
  where a.answered_at > now() - make_interval(days => least(greatest(coalesce(days, 30), 1), 365)) and a.chosen is not null
  group by a.topic
  order by 4 asc;
end;
$$;

-- Report queue, newest first. Notes are student-written text: the client must render them as plain text.
create or replace function public.admin_reports(want_status text default 'open', max_rows integer default 200)
returns table (id bigint, question_id text, rev smallint, reason text, note text, status text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select r.id, r.question_id, r.rev, r.reason, r.note, r.status, r.created_at
  from public.content_reports r
  where r.status = coalesce(want_status, 'open')
  order by r.created_at desc
  limit least(greatest(coalesce(max_rows, 200), 1), 1000);
end;
$$;

-- Close every open report on a question at once (fixed in content, or rejected).
create or replace function public.admin_resolve_question(qid text, new_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  perform private.require_admin();
  if new_status not in ('fixed', 'rejected', 'open') then
    raise exception 'status must be fixed, rejected or open' using errcode = '22023';
  end if;
  update public.content_reports r
     set status = new_status, resolved_at = case when new_status = 'open' then null else now() end
   where r.question_id = qid and r.status <> new_status;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.am_i_admin(), public.admin_overview(integer), public.admin_question_health(integer, integer),
  public.admin_topics(integer), public.admin_reports(text, integer), public.admin_resolve_question(text, text) from public, anon;
grant execute on function public.am_i_admin(), public.admin_overview(integer), public.admin_question_health(integer, integer),
  public.admin_topics(integer), public.admin_reports(text, integer), public.admin_resolve_question(text, text) to authenticated;
