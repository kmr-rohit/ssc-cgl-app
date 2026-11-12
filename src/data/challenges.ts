// Challenge a friend: share the exact same paper behind a 6-letter code, then compare scores.
// Views use these helpers; they never talk to Supabase directly.
import type { ExamId, MockRecord, MockRules, Question, SubjectId } from '../core/types';
import { EXAMS, SUBJECTS } from '../core/syllabus';
import { scoreSections } from '../core/scoring';
import { ensureQuestions, lookup, remember } from '../content/bank';
import { GEN_VERSION } from '../gen';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const isChallengeCode = (s: string) => /^[A-HJ-NP-Z2-9]{6}$/.test(s);

export interface ChallengePaper {
  kind: MockRecord['kind'];
  rules: MockRules | null;
  sections: { subject: SubjectId; questionIds: string[]; allottedMs: number }[];
  questions: Record<string, Question>;
}
export interface Challenge { code: string; creator_name: string; title: string; exam: ExamId; paper: ChallengePaper; is_mine: boolean; taken: boolean; created_at: string }
export interface ChallengeScore { display_name: string; is_me: boolean; score: number; max_score: number; correct: number; wrong: number; time_ms: number; submitted_at: string }

let client: SupabaseClient | null = supabase;
/** Tests inject a client for the local stack. */
export const setChallengeClient = (c: SupabaseClient) => { client = c; };
const need = () => { if (!client) throw new Error('Challenges need an account. This build has no account service.'); return client; };
const newCode = () => {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return [...b].map((x) => ALPHABET[x % ALPHABET.length]).join('');
};
/** Time a section was given at the start (older mocks didn't record it: fall back to the exam's timing). */
function allotted(m: MockRecord, i: number) {
  const s = m.sections[i];
  if (s.allottedMs) return s.allottedMs;
  const def = EXAMS[m.exam].sections.find((x) => x.subject === s.subject);
  return def ? (def.minutes * 60_000 * s.questionIds.length) / def.count : s.questionIds.length * 36_000;
}

/** Turn a mock into a challenge: same questions (snapshotted), same rules. Returns the code. */
export async function createChallenge(m: MockRecord, creatorName: string): Promise<string> {
  const sb = need();
  const questions: Record<string, Question> = {};
  for (const s of m.sections) for (const id of s.questionIds) { const q = m.snapshot?.[id] ?? lookup(id); if (q) questions[id] = q; }
  const paper: ChallengePaper = {
    kind: m.kind, rules: m.rules ?? null, questions,
    sections: m.sections.map((s, i) => ({ subject: s.subject, questionIds: s.questionIds, allottedMs: Math.round(allotted(m, i)) })),
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode();
    const { error } = await sb.from('challenges').insert({ code, creator_name: creatorName, title: m.title ?? EXAMS[m.exam].name, exam: m.exam, paper });
    if (!error) return code;
    if (error.code !== '23505') throw new Error(error.message.includes('row-level security') ? 'Sign in to create a challenge.' : 'Could not create the challenge. Check your connection and try again.');
  }
  throw new Error('Could not create the challenge. Try again.');
}

/** One challenge by its exact code (challenges can't be listed). Answers are left out until you've taken it. */
export async function getChallenge(code: string): Promise<Challenge | null> {
  const { data, error } = await need().rpc('get_challenge', { p_code: code });
  if (error) throw new Error('Could not load the challenge. Check your connection.');
  return (data as Challenge | null) ?? null;
}

const damaged = () => new Error('This challenge is damaged and cannot be opened.');
/** A paper comes from another user: check its shape before anything renders it. */
function checkPaper(p: ChallengePaper) {
  if (!p || !Array.isArray(p.sections) || p.sections.length < 1 || p.sections.length > 6 || typeof p.questions !== 'object' || !p.questions) throw damaged();
  let n = 0;
  for (const s of p.sections) {
    if (!SUBJECTS[s.subject] || !Array.isArray(s.questionIds) || typeof s.allottedMs !== 'number' || s.allottedMs < 0 || s.allottedMs > 6 * 3600_000) throw damaged();
    for (const id of s.questionIds) if (typeof id !== 'string' || id.length > 200) throw damaged();
    n += s.questionIds.length;
  }
  if (n < 1 || n > 300) throw damaged();
}
const okQuestion = (q: Question | undefined): q is Question =>
  !!q && typeof q.q === 'string' && Array.isArray(q.options) && q.options.length === 4 && q.options.every((o) => typeof o === 'string');

/**
 * A fresh mock for taking the challenge. Questions we have (our practice set, past papers) come from our own content,
 * never from the paper, so a crafted paper can't change a real question. Only generated questions, which depend on the
 * creator's generator version, come from the paper. Answers are checked on the server; feedback is always at the end.
 */
export async function mockFromChallenge(c: Challenge): Promise<MockRecord> {
  checkPaper(c.paper);
  const ids = c.paper.sections.flatMap((s) => s.questionIds);
  await ensureQuestions(ids.filter((id) => !id.startsWith('gen:'))).catch(() => {});
  const snapshot: Record<string, Question> = {};
  for (const id of ids) {
    const ours = id.startsWith('gen:') ? undefined : lookup(id);
    if (ours) continue;
    const theirs = c.paper.questions[id];
    if (!okQuestion(theirs)) throw damaged();
    // until the server reveals the key after submitting, an unknown answer counts as not matching
    snapshot[id] = { ...theirs, id, answer: typeof theirs.answer === 'number' ? theirs.answer : -1, solution: theirs.solution ?? '' } as Question;
  }
  const rules = c.paper.rules ? { ...c.paper.rules, feedback: 'end' as const } : undefined;
  return {
    key: `ch-${c.code}`, exam: c.exam, kind: c.paper.kind ?? 'custom', seed: c.code, genVersion: GEN_VERSION, status: 'not-started',
    title: c.title, rules, challenge: c.code, current: { section: 0, index: 0 },
    sections: c.paper.sections.map((s) => ({
      subject: s.subject, questionIds: s.questionIds, answers: s.questionIds.map(() => null), marked: s.questionIds.map(() => false),
      visited: s.questionIds.map(() => false), msSpent: s.questionIds.map(() => 0), remainingMs: s.allottedMs, allottedMs: s.allottedMs, done: false,
    })),
    snapshot, updatedAt: new Date().toISOString(),
  };
}

/** Send my answers; the server scores them. Only the first attempt counts; repeats return the first score. */
export async function postScore(m: MockRecord, displayName: string) {
  if (!m.challenge || m.status !== 'submitted') return;
  const time = Math.round(m.sections.reduce((a, s) => a + s.msSpent.reduce((x, y) => x + y, 0), 0));
  const { error } = await need().rpc('submit_challenge', {
    p_code: m.challenge, p_answers: m.sections.map((s) => s.answers.map((a) => (a === null || a === undefined ? null : a))), p_time_ms: time, p_name: displayName,
  });
  if (error) throw new Error('Could not post your score. It will be sent next time you open the result.');
}

/**
 * After submitting, the server reveals the answer key for questions that came from the paper (generated ones).
 * Fill them in and rescore so the result screen matches the leaderboard. Returns true if the mock changed.
 */
export async function revealChallengeKey(m: MockRecord): Promise<boolean> {
  const missing = Object.values(m.snapshot ?? {}).filter((q) => q.answer < 0);
  if (!m.challenge || !missing.length) return false;
  const c = await getChallenge(m.challenge);
  if (!c) return false;
  for (const q of missing) {
    const full = c.paper.questions[q.id];
    if (full && typeof full.answer === 'number' && full.answer >= 0 && full.answer <= 3) {
      const fixed = { ...q, answer: full.answer, solution: full.solution ?? q.solution };
      m.snapshot![q.id] = fixed; remember(fixed);
    }
  }
  m.score = scoreSections(m.exam, m.sections, (id) => m.snapshot?.[id] ?? lookup(id), m.rules);
  return true;
}

export async function getScores(code: string): Promise<ChallengeScore[]> {
  const { data, error } = await need().rpc('challenge_leaderboard', { p_code: code });
  if (error) throw new Error(error.code === '42501' ? 'Take the challenge to see the scores.' : 'Could not load scores.');
  return ((data ?? []) as ChallengeScore[]).map((r) => ({ ...r, score: Number(r.score), max_score: Number(r.max_score) }));
}

export const challengeLink = (code: string) => `${typeof location !== 'undefined' ? location.origin : ''}/#/c/${code}`;
