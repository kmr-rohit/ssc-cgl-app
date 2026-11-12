// Integration: challenges against the local Supabase stack (npm run test:sync; needs `npx supabase start`).
import 'fake-indexeddb/auto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uid } from './storage';
import { createChallenge, getChallenge, getScores, mockFromChallenge, postScore, setChallengeClient } from './challenges';
import { scoreSections } from '../core/scoring';
import type { MockRecord, Question } from '../core/types';

const URL = process.env.SB_URL!, PUB = process.env.SB_PUBLISHABLE_KEY!, SECRET = process.env.SB_SECRET_KEY!;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL ?? '')) throw new Error('integration tests only run against a LOCAL stack');
const admin = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

const q = (id: string, answer: number): Question => ({ id, rev: 1, topic: 'q-percentage', type: 'basic', level: 1, q: `Q ${id}`, options: ['a', 'b', 'c', 'd'], answer, solution: 'because it is so', source: 'test-data' });
const questions = { x1: q('x1', 0), x2: q('x2', 1), x3: q('x3', 2) };
const baseMock = (): MockRecord => ({
  key: 'mine-1', exam: 'pre', kind: 'custom', seed: 's', genVersion: 1, status: 'submitted', title: 'Percentage mini',
  rules: { timing: 'exam', sectionMode: 'locked', marks: 2, negative: 0.5, feedback: 'end' }, current: { section: 0, index: 0 },
  sections: [{ subject: 'quant', questionIds: ['x1', 'x2', 'x3'], answers: [0, 1, 0], marked: [false, false, false], visited: [true, true, true], msSpent: [5000, 6000, 7000], remainingMs: 1000, allottedMs: 120000, done: true }],
  snapshot: questions, updatedAt: new Date().toISOString(),
});

async function user(tag: string) {
  const email = `ch-${tag}-${Date.now()}@cglprep.test`, password = `pw-${uid()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = createClient(URL, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
  await c.auth.signInWithPassword({ email, password });
  return { id: data.user.id, c };
}
let A: Awaited<ReturnType<typeof user>>, B: Awaited<ReturnType<typeof user>>, C: Awaited<ReturnType<typeof user>>;
beforeAll(async () => { [A, B, C] = await Promise.all([user('a'), user('b'), user('c')]); });
afterAll(async () => { for (const u of [A, B, C]) if (u) await admin.auth.admin.deleteUser(u.id).catch(() => {}); });

describe('challenge a friend', () => {
  it('creator → friend takes the same paper → leaderboard; first attempt only; strangers see nothing', async () => {
    // creator
    setChallengeClient(A.c);
    const mine = baseMock();
    mine.score = scoreSections('pre', mine.sections, (id) => questions[id as keyof typeof questions], mine.rules);
    const code = await createChallenge(mine, 'Asha');
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    mine.challenge = code;
    await postScore(mine, 'Asha');

    // friend: same questions and rules, fresh answers, original time
    setChallengeClient(B.c);
    const ch = (await getChallenge(code))!;
    expect(ch.creator_name).toBe('Asha');
    const theirs = mockFromChallenge(ch);
    expect(theirs.sections[0].questionIds).toEqual(['x1', 'x2', 'x3']);
    expect(theirs.sections[0].answers).toEqual([null, null, null]);
    expect(theirs.sections[0].remainingMs).toBe(120000);
    expect(theirs.rules?.negative).toBe(0.5);
    expect(Object.keys(theirs.snapshot!)).toHaveLength(3);
    expect(await getScores(code)).toEqual([]); // not before taking it

    theirs.status = 'submitted';
    theirs.sections[0].answers = [0, 1, 2];
    theirs.score = scoreSections('pre', theirs.sections, (id) => questions[id as keyof typeof questions], theirs.rules);
    await postScore(theirs, 'Ravi');
    const board = await getScores(code);
    expect(board.map((r) => r.display_name)).toEqual(['Ravi', 'Asha']); // 6 vs 3.5
    expect(board[0].score).toBe(6);

    // a second attempt doesn't overwrite the first
    theirs.score = { ...theirs.score, total: 0 };
    await postScore(theirs, 'Ravi');
    expect((await getScores(code))[0].score).toBe(6);

    // a stranger with the code can see the challenge but no scores
    setChallengeClient(C.c);
    expect((await getChallenge(code))?.title).toBe('Percentage mini');
    expect(await getScores(code)).toEqual([]);
  });
});
