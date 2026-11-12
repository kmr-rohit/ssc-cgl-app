-- Challenge a friend: access through functions only, scores computed on the server. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'creator@example.com', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'friend@example.com', 'authenticated', 'authenticated'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'stranger@example.com', 'authenticated', 'authenticated');

set local role authenticated;

-- creator makes a 3-question paper (keys 0, 1, 2), default Tier 1 marking (+2 / −0.5)
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ insert into public.challenges (code, creator_name, title, exam, paper) values ('K7PQ2M', 'Asha', 'Tier 1 mini', 'pre',
  '{"kind":"custom","rules":null,"sections":[{"subject":"quant","questionIds":["q1","q2","q3"],"allottedMs":600000}],
    "questions":{"q1":{"id":"q1","answer":0,"solution":"s1"},"q2":{"id":"q2","answer":1,"solution":"s2"},"q3":{"id":"q3","answer":2,"solution":"s3"}}}') $$,
  'creator creates a challenge');
select throws_ok($$ insert into public.challenges (code, created_by, creator_name, title, exam, paper) values ('ZZZZZZ', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', 'x', 'pre', '{"sections":[{}],"questions":{}}') $$, '42501', null, 'cannot create a challenge as someone else');
select throws_ok($$ insert into public.challenges (code, creator_name, title, exam, paper, expires_at) values ('ZZZZZY', 'x', 'x', 'pre', '{"sections":[{}],"questions":{}}', now() + interval '10 years') $$, '42501', null, 'cannot choose the expiry');
select throws_ok($$ insert into public.challenges (code, creator_name, title, exam, paper) values ('ZZZZZX', 'x', 'x', 'pre', '{"questions":{}}') $$, '23514', null, 'paper shape is checked');
select throws_ok($$ insert into public.challenges (code, creator_name, title, exam, paper) values ('bad01!', 'Asha', 't', 'pre', '{"sections":[{}],"questions":{}}') $$, '23514', null, 'code format is enforced');
select ok((select (public.get_challenge('K7PQ2M') -> 'paper' -> 'questions' -> 'q1') ? 'answer'), 'creator sees the answer key');
select is((select (public.submit_challenge('K7PQ2M', '[[0,1,2]]', 300000, 'Asha') ->> 'score')::numeric), 6::numeric, 'creator scores 3 right = 6');

-- friend: no table access, gets the paper without answers, leaderboard locked until they submit
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select throws_ok($$ select count(*) from public.challenges $$, '42501', null, 'challenges cannot be listed');
select throws_ok($$ select count(*) from public.challenge_scores $$, '42501', null, 'scores cannot be read directly');
select is((select public.get_challenge('K7PQ2M') ->> 'title'), 'Tier 1 mini', 'friend opens the challenge by code');
select ok(not ((select public.get_challenge('K7PQ2M') -> 'paper' -> 'questions' -> 'q1') ? 'answer'), 'no answer key before taking it');
select ok(not ((select public.get_challenge('K7PQ2M') -> 'paper' -> 'questions' -> 'q1') ? 'solution'), 'no solutions before taking it');
select is((select public.get_challenge('NOPE22')), null, 'unknown code returns nothing');
select throws_ok($$ select * from public.challenge_leaderboard('K7PQ2M') $$, '42501', null, 'leaderboard locked before taking it');
select throws_ok($$ insert into public.challenge_scores (code, display_name, score, max_score, correct, wrong, time_ms) values ('K7PQ2M', 'Ravi', 99999, 1, 0, 0, 0) $$, '42501', null, 'scores cannot be inserted directly');
select throws_ok($$ select public.submit_challenge('K7PQ2M', '[[0,1]]', 1, 'Ravi') $$, '22023', null, 'answers must match the paper');
select throws_ok($$ select public.submit_challenge('K7PQ2M', '[[0,1,9]]', 1, 'Ravi') $$, '22023', null, 'answers must be 0 to 3');
-- 1 right, 1 wrong, 1 skipped: 2 − 0.5 = 1.5; time is clamped to the allotted time + 1 minute
select is((select (public.submit_challenge('K7PQ2M', '[[0,3,null]]', 99999999, 'Ravi') ->> 'score')::numeric), 1.5::numeric, 'server scores the answers');
select is((select time_ms from public.challenge_leaderboard('K7PQ2M') where is_me), 660000, 'time is clamped');
select is((select public.submit_challenge('K7PQ2M', '[[0,1,2]]', 1, 'Ravi') ->> 'first'), 'false', 'only the first attempt counts');
select is((select count(*)::int from public.challenge_leaderboard('K7PQ2M')), 2, 'after taking it, friend sees the leaderboard');
select is((select display_name from public.challenge_leaderboard('K7PQ2M') order by score desc limit 1), 'Asha', 'leaderboard is ordered by score');
select ok((select (public.get_challenge('K7PQ2M') -> 'paper' -> 'questions' -> 'q1') ? 'solution'), 'solutions open after taking it');

-- signed out: nothing
reset role;
set local role anon;
select throws_ok($$ select public.get_challenge('K7PQ2M') $$, '42501', null, 'anon cannot open challenges');

select * from finish();
rollback;
