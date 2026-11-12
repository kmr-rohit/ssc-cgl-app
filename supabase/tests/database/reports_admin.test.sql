-- Report a mistake + admin functions: RLS, grants, admin gate. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'student@example.com', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.com', 'authenticated', 'authenticated'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'admin@example.com', 'authenticated', 'authenticated');
insert into private.admins (user_id) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

-- six answers to one question, five picking the same wrong option: a likely wrong key
insert into public.attempts (id, user_id, question_id, topic, type, level, chosen, correct, ms, mode, answered_at)
select gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pyq:q-ratio:x1', 'q-ratio', 'basic', 2,
       case when g = 1 then 0 else 2 end, g = 1, 30000, 'test', now() - make_interval(hours => g)
from generate_series(1, 6) g;

set local role authenticated;

-- student files a report; cannot set its status, file twice, or file as someone else
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ insert into public.content_reports (question_id, reason, note) values ('pyq:q-ratio:x1', 'wrong-answer', 'Key says A, working gives C') $$, 'student files a report');
select throws_ok($$ insert into public.content_reports (question_id, reason) values ('pyq:q-ratio:x1', 'typo') $$, '23505', null, 'one report per question per person');
select throws_ok($$ insert into public.content_reports (question_id, reason, status) values ('q-ratio-001', 'typo', 'fixed') $$, '42501', null, 'cannot set status');
select throws_ok($$ insert into public.content_reports (user_id, question_id, reason) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'q-ratio-002', 'typo') $$, '42501', null, 'cannot file as someone else');
select throws_ok($$ insert into public.content_reports (question_id, reason) values ('q-ratio-003', 'rude') $$, '23514', null, 'reason must be from the list');
select throws_ok($$ update public.content_reports set status = 'fixed' $$, '42501', null, 'students cannot update reports');
select is((select count(*)::int from public.content_reports), 1, 'student sees own report');

-- admin functions are closed to students
select is((select public.am_i_admin()), false, 'student is not an admin');
select throws_ok($$ select public.admin_overview(30) $$, '42501', null, 'overview is admins only');
select throws_ok($$ select * from public.admin_reports('open', 10) $$, '42501', null, 'report queue is admins only');
select throws_ok($$ select public.admin_resolve_question('pyq:q-ratio:x1', 'fixed') $$, '42501', null, 'students cannot resolve');

-- another student cannot see the first one's report
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is((select count(*)::int from public.content_reports), 0, 'reports are private to their author');

-- admin
set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';
select is((select public.am_i_admin()), true, 'admin is recognised');
select cmp_ok((select (public.admin_overview(30) ->> 'reportsOpen')::int), '>=', 1, 'overview counts open reports');
select is((select top_wrong from public.admin_question_health(5, 10) where question_id = 'pyq:q-ratio:x1'), 2::smallint, 'health flags the shared wrong option');
select is((select public.admin_resolve_question('pyq:q-ratio:x1', 'fixed')), 1, 'admin resolves the question''s reports');

-- signed out: nothing
reset role;
set local role anon;
select throws_ok($$ select public.admin_overview(30) $$, '42501', null, 'anon cannot call admin functions');

select * from finish();
rollback;
