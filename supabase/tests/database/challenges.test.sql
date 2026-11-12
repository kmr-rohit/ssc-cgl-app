-- Challenge a friend: RLS and grants. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'creator@example.com', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'friend@example.com', 'authenticated', 'authenticated'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'stranger@example.com', 'authenticated', 'authenticated');

set local role authenticated;

-- creator makes a challenge and posts a score
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ insert into public.challenges (code, creator_name, title, exam, paper) values ('K7PQ2M', 'Asha', 'Tier 1 mini', 'pre', '{"sections":[]}') $$, 'creator creates a challenge');
select throws_ok($$ insert into public.challenges (code, created_by, creator_name, title, exam, paper) values ('ZZZZZZ', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', 'x', 'pre', '{}') $$, '42501', null, 'cannot create a challenge as someone else');
select throws_ok($$ insert into public.challenges (code, creator_name, title, exam, paper) values ('bad01!', 'Asha', 't', 'pre', '{}') $$, '23514', null, 'code format is enforced');
select lives_ok($$ insert into public.challenge_scores (code, display_name, score, max_score, correct, wrong, time_ms) values ('K7PQ2M', 'Asha', 30, 40, 16, 4, 600000) $$, 'creator posts own score');

-- friend: can read the challenge, cannot see scores until they take it
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is((select title from public.challenges where code = 'K7PQ2M'), 'Tier 1 mini', 'friend reads the challenge by code');
select is((select count(*)::int from public.challenge_scores where code = 'K7PQ2M'), 0, 'friend cannot see scores before taking it');
select throws_ok($$ insert into public.challenge_scores (code, user_id, display_name, score, max_score, correct, wrong, time_ms) values ('K7PQ2M', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'x', 1, 40, 1, 0, 1) $$, '42501', null, 'cannot post a score for someone else');
select lives_ok($$ insert into public.challenge_scores (code, display_name, score, max_score, correct, wrong, time_ms) values ('K7PQ2M', 'Ravi', 34, 40, 17, 0, 500000) $$, 'friend posts own score');
select is((select count(*)::int from public.challenge_scores where code = 'K7PQ2M'), 2, 'after taking it, friend sees the leaderboard');
select throws_ok($$ update public.challenge_scores set score = 40 where code = 'K7PQ2M' $$, '42501', null, 'scores cannot be edited');

-- stranger who never took it sees no scores; nobody signed out sees anything
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select is((select count(*)::int from public.challenge_scores), 0, 'a stranger sees no scores');
reset role;
set local role anon;
select throws_ok($$ select * from public.challenges $$, '42501', null, 'signed-out visitors cannot read challenges');

select * from finish();
rollback;
