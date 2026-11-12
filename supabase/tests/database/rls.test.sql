-- RLS / grants tests. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- two users
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com', 'authenticated', 'authenticated');

-- ---------------- user A writes
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok($$ insert into public.mocks (key, exam, status, record, updated_at) values ('pre-2026-11-12', 'pre', 'submitted', '{"score":1}', '2026-11-12T10:00:00Z') $$, 'A inserts own mock');
select lives_ok($$ insert into public.attempts (id, question_id, topic, type, level, chosen, correct, ms, mode, answered_at)
  values ('01900000-0000-7000-8000-000000000001', 'q-percentage-001', 'q-percentage', 'basic', 1, 0, true, 9000, 'learn', now()) $$, 'A inserts own attempt');
select lives_ok($$ insert into public.attempts (id, question_id, topic, type, level, chosen, correct, ms, mode, answered_at)
  values ('01900000-0000-7000-8000-000000000001', 'q-percentage-001', 'q-percentage', 'basic', 1, 0, true, 9000, 'learn', now()) on conflict (id) do nothing $$, 'A re-sends same attempt idempotently');
select is((select count(*)::int from public.attempts), 1, 'A sees exactly one attempt');
select throws_ok($$ update public.attempts set correct = false $$, '42501', null, 'A cannot edit answers (no update grant)');

-- stale device: older updated_at is ignored
update public.mocks set record = '{"score":0}', updated_at = '2026-11-11T00:00:00Z' where key = 'pre-2026-11-12';
select is((select record->>'score' from public.mocks where key = 'pre-2026-11-12'), '1', 'older update is ignored (last-write-wins)');
update public.mocks set record = '{"score":2}', updated_at = '2026-11-13T00:00:00Z' where key = 'pre-2026-11-12';
select is((select record->>'score' from public.mocks where key = 'pre-2026-11-12'), '2', 'newer update is applied');

-- ---------------- user B tries to reach A's data
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.mocks), 0, 'B cannot read A''s mocks');
select is((select count(*)::int from public.attempts), 0, 'B cannot read A''s attempts');
update public.mocks set record = '{"score":99}', updated_at = now() where key = 'pre-2026-11-12';
delete from public.mocks where key = 'pre-2026-11-12';
select throws_ok($$ insert into public.mocks (user_id, key, exam, status, record, updated_at) values ('11111111-1111-1111-1111-111111111111', 'evil', 'pre', 'submitted', '{}', now()) $$,
  '42501', null, 'B cannot insert rows owned by A');

-- ---------------- back to A: data intact, cannot hand rows to B
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is((select record->>'score' from public.mocks where key = 'pre-2026-11-12'), '2', 'B''s update/delete had no effect on A''s mock');
select throws_ok($$ update public.mocks set user_id = '22222222-2222-2222-2222-222222222222', updated_at = now() + interval '1 day' $$,
  '42501', null, 'A cannot reassign a row to B (WITH CHECK)');

-- ---------------- anon has no access at all
reset role;
set local role anon;
select throws_ok($$ select * from public.mocks $$, '42501', null, 'anon cannot read mocks');
select throws_ok($$ insert into public.profiles (user_id, settings) values ('11111111-1111-1111-1111-111111111111', '{}') $$, '42501', null, 'anon cannot write profiles');

select * from finish();
rollback;
