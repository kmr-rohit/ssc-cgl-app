// Challenge a friend: share the exact same paper behind a 6-letter code, then compare scores.
// Views use these helpers; they never talk to Supabase directly.
import type { ExamId, MockRecord, MockRules, Question, SubjectId } from '../core/types';
import { EXAMS } from '../core/syllabus';
import { lookup } from '../content/bank';
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
export interface Challenge { code: string; creator_name: string; title: string; exam: ExamId; paper: ChallengePaper; created_by: string; created_at: string }
export interface ChallengeScore { display_name: string; user_id: string; score: number; max_score: number; correct: number; wrong: number; time_ms: number; submitted_at: string }

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

export async function getChallenge(code: string): Promise<Challenge | null> {
  const { data, error } = await need().from('challenges').select('code, creator_name, title, exam, paper, created_by, created_at').eq('code', code).maybeSingle();
  if (error) throw new Error('Could not load the challenge. Check your connection.');
  return data as Challenge | null;
}

/** A fresh mock for taking the challenge. */
export function mockFromChallenge(c: Challenge): MockRecord {
  return {
    key: `ch-${c.code}`, exam: c.exam, kind: 'custom', seed: c.code, genVersion: GEN_VERSION, status: 'not-started',
    title: c.title, rules: c.paper.rules ?? undefined, challenge: c.code, current: { section: 0, index: 0 },
    sections: c.paper.sections.map((s) => ({
      subject: s.subject, questionIds: s.questionIds, answers: s.questionIds.map(() => null), marked: s.questionIds.map(() => false),
      visited: s.questionIds.map(() => false), msSpent: s.questionIds.map(() => 0), remainingMs: s.allottedMs, allottedMs: s.allottedMs, done: false,
    })),
    snapshot: c.paper.questions, updatedAt: new Date().toISOString(),
  };
}

/** Post my score for a submitted challenge mock. Only the first attempt counts; repeats are ignored. */
export async function postScore(m: MockRecord, displayName: string) {
  if (!m.challenge || !m.score) return;
  const correct = m.score.sections.reduce((a, s) => a + s.correct, 0);
  const wrong = m.score.sections.reduce((a, s) => a + s.wrong, 0);
  const time = Math.round(m.sections.reduce((a, s) => a + s.msSpent.reduce((x, y) => x + y, 0), 0));
  const { error } = await need().from('challenge_scores').insert({
    code: m.challenge, display_name: displayName, score: m.score.total, max_score: m.score.max || 1, correct, wrong, time_ms: time,
  });
  if (error && error.code !== '23505') throw new Error('Could not post your score. It will be sent next time you open the result.');
}

export async function getScores(code: string): Promise<ChallengeScore[]> {
  const { data, error } = await need().from('challenge_scores').select('display_name, user_id, score, max_score, correct, wrong, time_ms, submitted_at')
    .eq('code', code).order('score', { ascending: false }).order('time_ms', { ascending: true });
  if (error) throw new Error('Could not load scores.');
  return (data ?? []).map((r) => ({ ...r, score: Number(r.score), max_score: Number(r.max_score) })) as ChallengeScore[];
}

export const challengeLink = (code: string) => `${typeof location !== 'undefined' ? location.origin : ''}/#/c/${code}`;
