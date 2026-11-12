// Integration: SyncedAdapter ⇄ local Supabase stack (run `npm run test:sync`; needs `npx supabase start`).
// Two "devices" = two IndexedDB namespaces (fake-indexeddb) + two Supabase clients for the same user.
import 'fake-indexeddb/auto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalAdapter, uid } from './storage';
import { SyncedAdapter } from './sync';
import type { Attempt, MockRecord } from '../core/types';

const URL = process.env.SB_URL!;
const PUB = process.env.SB_PUBLISHABLE_KEY!;
const SECRET = process.env.SB_SECRET_KEY!;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL ?? '')) throw new Error('sync integration tests only run against a LOCAL stack');

const admin = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const client = () => createClient(URL, PUB, { auth: { persistSession: false, autoRefreshToken: false } });

async function makeUser(tag: string) {
  const email = `int-${tag}-${Date.now()}@cglprep.test`;
  const password = `pw-${uid()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email, password };
}
async function device(name: string, user: { email: string; password: string }) {
  const sb = client();
  const local = new LocalAdapter(`int-${name}-${Date.now()}`);
  const sync = new SyncedAdapter(local, sb, `int-${name}-outbox-${Date.now()}`);
  return { sb, local, sync, signIn: async () => { const { data, error } = await sb.auth.signInWithPassword(user); if (error) throw error; return data.user.id; } };
}
const attempt = (q: string, correct: boolean, at = new Date().toISOString()): Attempt =>
  ({ id: uid(), questionId: q, rev: 1, topic: 'q-percentage', type: 'basic', level: 1, chosen: correct ? 0 : 1, correct, ms: 12000, mode: 'learn', at });
const mock = (key: string, score: number, updatedAt: string): MockRecord => ({
  key, exam: 'pre', kind: 'daily', seed: key, genVersion: 1, status: 'submitted', current: { section: 0, index: 0 },
  sections: [], score: { total: score, max: 200, sections: [] }, updatedAt,
});

let u1: Awaited<ReturnType<typeof makeUser>>, u2: Awaited<ReturnType<typeof makeUser>>;
beforeAll(async () => { u1 = await makeUser('one'); u2 = await makeUser('two'); });
afterAll(async () => { for (const u of [u1, u2]) if (u) await admin.auth.admin.deleteUser(u.id).catch(() => {}); });

describe('sync with local Supabase', () => {
  it('uploads local progress on first sign-in and syncs both ways between devices', async () => {
    // device A used offline first
    const A = await device('a', u1);
    await A.sync.addAttempts([attempt('q-percentage-001', true), attempt('q-percentage-002', false)]);
    await A.sync.saveMock(mock('pre-2026-11-12', 120, '2026-11-12T10:00:00.000Z'));
    await A.sync.saveSettings({ ...(await A.local.getSettings()), name: 'Asha', examDate: '2027-03-01' });
    await A.sync.saveCards([{ id: 'fc-pct-1', due: '2026-11-13', interval: 1, ease: 2.5, reps: 1, lapses: 0, updatedAt: '2026-11-12T10:00:00.000Z' }]);

    await A.sync.attach(await A.signIn()); // first sign-in → import
    expect(A.sync.status.state).toBe('idle');
    expect(A.sync.status.pending).toBe(0);

    // device B: fresh install, same account
    const B = await device('b', u1);
    await B.sync.attach(await B.signIn());
    expect((await B.local.listAttempts()).map((a) => a.questionId).sort()).toEqual(['q-percentage-001', 'q-percentage-002']);
    expect((await B.local.listMocks())[0].score?.total).toBe(120);
    expect((await B.local.getSettings()).name).toBe('Asha');
    expect((await B.local.listCards())[0].reps).toBe(1);

    // B practises and finishes the mock with a newer timestamp; A pulls it
    await B.sync.addAttempts([attempt('q-average-001', true)]);
    await B.sync.saveMock(mock('pre-2026-11-12', 150, '2026-11-12T11:00:00.000Z'));
    await B.sync.sync();
    await A.sync.sync();
    expect((await A.local.listAttempts()).length).toBe(3);
    expect((await A.local.listMocks())[0].score?.total).toBe(150);

    // a stale device (older updatedAt) cannot overwrite the newer server copy
    await A.sync.saveMock(mock('pre-2026-11-12', 10, '2026-11-12T09:00:00.000Z'));
    await A.sync.sync();
    const { data } = await B.sb.from('mocks').select('record').eq('key', 'pre-2026-11-12').single();
    expect((data!.record as MockRecord).score?.total).toBe(150);
    await A.sync.sync(); // pull restores the newer copy locally
    expect((await A.local.listMocks())[0].score?.total).toBe(150);

    // re-sending the same attempts is idempotent
    const before = (await B.sb.from('attempts').select('id', { count: 'exact', head: true })).count;
    await A.sync.importAll(await A.local.exportAll());
    await A.sync.sync();
    expect((await B.sb.from('attempts').select('id', { count: 'exact', head: true })).count).toBe(before);
  });

  it('keeps users isolated, and a different account on the same device starts clean', async () => {
    const C = await device('c', u2);
    await C.sync.attach(await C.signIn());
    expect(await C.local.listAttempts()).toEqual([]);
    expect((await C.sb.from('attempts').select('id')).data).toEqual([]);
    expect((await C.sb.from('mocks').select('key')).data).toEqual([]);

    // the same device later signs in as user 1: user 2's local data is cleared, user 1's data is pulled
    await C.sync.addAttempts([attempt('q-hcf-lcm-001', true)]);
    await C.sync.sync();
    await C.sb.auth.signOut();
    const { data } = await C.sb.auth.signInWithPassword(u1);
    await C.sync.attach(data.user!.id);
    const qs = (await C.local.listAttempts()).map((a) => a.questionId);
    expect(qs).not.toContain('q-hcf-lcm-001');
    expect(qs).toContain('q-percentage-001');
  });

  it('reset progress deletes server rows; delete-account removes the user', async () => {
    const D = await device('d', u2);
    await D.sync.attach(await D.signIn());
    await D.sync.wipe();
    expect((await D.sb.from('attempts').select('id')).data).toEqual([]);

    const { error } = await D.sb.functions.invoke('delete-account', { method: 'POST' });
    expect(error).toBeNull();
    const { data } = await admin.auth.admin.getUserById(u2.id);
    expect(data.user).toBeNull();
  });
});

describe('sync edge cases (account switches, deletes, restores)', () => {
  let u3: Awaited<ReturnType<typeof makeUser>>, u4: Awaited<ReturnType<typeof makeUser>>;
  beforeAll(async () => { u3 = await makeUser('three'); u4 = await makeUser('four'); });
  afterAll(async () => { for (const u of [u3, u4]) if (u) await admin.auth.admin.deleteUser(u.id).catch(() => {}); });
  const switchTo = async (d: Awaited<ReturnType<typeof device>>, u: { email: string; password: string }) => {
    await d.sb.auth.signOut({ scope: 'local' });
    const { data, error } = await d.sb.auth.signInWithPassword(u);
    if (error) throw error;
    return data.user!.id;
  };

  it('first sign-in on a new device keeps the account settings (local UI flags survive)', async () => {
    const A = await device('e1', u3);
    await A.sync.saveSettings({ ...(await A.local.getSettings()), name: 'Ravi', dailyHours: 6, onboarded: true });
    await A.sync.attach(await A.signIn());

    const B = await device('e2', u3);
    // a new device: the welcome screen was skipped and the tour seen, which stamps a settings write
    await B.sync.saveSettings({ ...(await B.local.getSettings()), toured: true });
    await B.sync.attach(await B.signIn());
    const s = await B.local.getSettings();
    expect(s.name).toBe('Ravi');
    expect(s.dailyHours).toBe(6);
    expect(s.toured).toBe(true);
    expect(s.onboarded).toBe(true);
    const { data } = await B.sb.from('profiles').select('settings').single();
    expect((data!.settings as { name: string }).name).toBe('Ravi');
    expect(B.sync.status.pending).toBe(0);

    // afterwards: normal last-write-wins
    await B.sync.saveSettings({ ...s, name: 'Ravi K' });
    await B.sync.sync();
    await A.sync.sync();
    expect((await A.local.getSettings()).name).toBe('Ravi K');
  });

  it('a mock deleted while signed out stays deleted after sign-in', async () => {
    const A = await device('f1', u3);
    await A.sync.attach(await A.signIn());
    await A.sync.saveMock(mock('pre-del-1', 90, '2026-11-12T10:00:00.000Z'));
    await A.sync.sync();
    await A.sb.auth.signOut({ scope: 'local' });

    await A.sync.deleteMock('pre-del-1');
    expect(await A.sync.sync()).toBe(false); // signed out: nothing happens, the delete stays queued
    expect(A.sync.status.pending).toBe(1);

    await A.signIn();
    await A.sync.sync();
    expect((await A.local.listMocks()).map((m) => m.key)).not.toContain('pre-del-1');
    expect((await A.sb.from('mocks').select('key').eq('key', 'pre-del-1')).data).toEqual([]);
    expect(A.sync.status.pending).toBe(0);
  });

  it('a restored backup uploads its settings and kv, and carries no sync bookkeeping', async () => {
    const A = await device('g1', u3);
    await A.sync.attach(await A.signIn());
    await A.sync.setKV('streak', 9);
    const file = await A.sync.exportAll();
    expect(Object.keys(file.kv).some((k) => k.startsWith('__sync'))).toBe(false);

    await A.sync.importAll({ ...file, settings: { ...file.settings, name: 'Restored' }, kv: { streak: 12 } });
    await A.sync.sync();
    const { data: p } = await A.sb.from('profiles').select('settings').single();
    expect((p!.settings as { name: string }).name).toBe('Restored');
    const { data: kv } = await A.sb.from('kv').select('value').eq('key', 'streak').single();
    expect(kv!.value).toBe(12);
  });

  it('switching accounts reloads the app, and unsent changes are kept aside unless the student moves them', async () => {
    const D = await device('h1', u3);
    const resets: (boolean | undefined)[] = [];
    D.sync.onPulled = (r) => resets.push(r);
    await D.sync.attach(await D.signIn());
    await D.sb.auth.signOut({ scope: 'local' });
    await D.sync.addAttempts([attempt('q-offline-001', true)]); // work done after signing out

    // u4 signs in; no handler → set aside for u3, not uploaded to u4
    await D.sync.attach(await switchTo(D, u4));
    expect(resets).toContain(true);
    expect(await D.local.listAttempts()).toEqual([]);
    expect(D.sync.status.pending).toBe(0);
    expect((await D.sb.from('attempts').select('question_id')).data).toEqual([]);

    // u3 signs in here again → the set-aside answer is uploaded to u3
    await D.sync.attach(await switchTo(D, u3));
    expect((await D.local.listAttempts()).map((a) => a.questionId)).toContain('q-offline-001');
    expect(D.sync.status.pending).toBe(0);

    // with confirmation, unsent changes go to the account that signs in
    await D.sb.auth.signOut({ scope: 'local' });
    await D.sync.addAttempts([attempt('q-offline-002', true)]);
    let asked = 0;
    D.sync.confirmCarryOver = async (n) => { asked = n; return true; };
    await D.sync.attach(await switchTo(D, u4));
    expect(asked).toBe(1);
    expect((await D.sb.from('attempts').select('question_id')).data!.map((r) => r.question_id)).toEqual(['q-offline-002']);
  });

  it('forgetting the device clears queued uploads and reloads the app', async () => {
    const D = await device('i1', u4);
    await D.sync.attach(await D.signIn());
    await D.sb.auth.signOut({ scope: 'local' });
    await D.sync.addAttempts([attempt('q-gone-001', true)]);
    let reset = false;
    D.sync.onPulled = (r) => { reset = !!r; };
    await D.sync.forgetDevice();
    expect(reset).toBe(true);
    expect(D.sync.status.pending).toBe(0);
    expect(await D.local.listAttempts()).toEqual([]);
  });
});
