import { describe, expect, it } from 'vitest';
import { addDays, newCard, review } from './srs';
import { scoreSections } from './scoring';
import { streak, topicStats, weakTopics } from './analysis';
import type { Attempt, MockSectionState, Question } from './types';
import { Rng, mcq } from './rng';
import { TOPICS, topicPriority } from './syllabus';

const q = (id: string, answer: number): Question => ({ id, rev: 1, topic: 'q-percentage', type: 'basic', level: 1, q: 'x', options: ['a', 'b', 'c', 'd'], answer, solution: 'because', source: 'test-data' });
const sec = (subject: MockSectionState['subject'], ids: string[], answers: (number | null)[]): MockSectionState =>
  ({ subject, questionIds: ids, answers, marked: ids.map(() => false), visited: ids.map(() => true), msSpent: ids.map(() => 0), remainingMs: 0, done: true });

describe('rng', () => {
  it('is deterministic', () => {
    const a = new Rng('seed'), b = new Rng('seed');
    expect([a.next(), a.int(1, 9), a.pick([1, 2, 3])]).toEqual([b.next(), b.int(1, 9), b.pick([1, 2, 3])]);
  });
  it('mcq gives 4 unique options with the answer at the returned index', () => {
    for (let s = 0; s < 200; s++) {
      const r = new Rng(s);
      const { options, answer } = mcq(r, 42, [42, 41, 41, 43, NaN], (i) => 42 + i * 7);
      expect(new Set(options).size).toBe(4);
      expect(options[answer]).toBe('42');
      expect(options).not.toContain('NaN');
    }
  });
});

describe('scoring', () => {
  it('applies Tier 1 marking and skips qualifying sections in the total', () => {
    const bank: Record<string, Question> = { a: q('a', 0), b: q('b', 1), c: q('c', 2), d: q('d', 3) };
    const s1 = scoreSections('pre', [sec('quant', ['a', 'b', 'c'], [0, 0, null])], (id) => bank[id]);
    expect(s1.total).toBe(2 - 0.5);
    expect(s1.max).toBe(6);
    const s2 = scoreSections('mains', [sec('quant', ['a'], [0]), sec('computer', ['d'], [3])], (id) => bank[id]);
    expect(s2.total).toBe(3);
    expect(s2.sections[1].score).toBe(3);
  });
});

describe('srs', () => {
  it('schedules good answers further out and resets on again', () => {
    let c = newCard('x', '2026-01-01');
    c = review(c, 2, '2026-01-01'); expect(c.due).toBe('2026-01-02');
    c = review(c, 2, '2026-01-02'); expect(c.due).toBe('2026-01-08');
    c = review(c, 2, '2026-01-08'); expect(c.interval).toBe(15);
    c = review(c, 0, '2026-01-23'); expect(c.interval).toBe(0); expect(c.lapses).toBe(1);
  });
  it('addDays crosses months', () => expect(addDays('2026-01-31', 1)).toBe('2026-02-01'));
});

describe('analysis', () => {
  const at = (d: string, correct: boolean, topic = 'q-percentage'): Attempt =>
    ({ id: Math.random().toString(), questionId: 'x', rev: 1, topic, type: 'basic', level: 1, chosen: correct ? 0 : 1, correct, ms: 30000, mode: 'learn', at: new Date(d).toISOString() });
  it('computes accuracy and ranks weak topics by marks lost', () => {
    const list = [...Array(5)].map(() => at('2026-01-01T10:00', false, 'q-geometry')).concat([...Array(5)].map(() => at('2026-01-01T10:00', true)));
    const st = topicStats(list);
    expect(st['q-geometry'].accuracy).toBe(0);
    expect(st['q-percentage'].accuracy).toBe(1);
    expect(weakTopics(st, 'pre')[0].topic.id).toBe('q-geometry');
  });
  it('counts a streak of consecutive local days', () => {
    const list = [at('2026-03-10T09:00', true), at('2026-03-11T09:00', true), at('2026-03-12T09:00', true)];
    expect(streak(list, new Date('2026-03-12T20:00'))).toBe(3);
    expect(streak(list, new Date('2026-03-13T08:00'))).toBe(3);
    expect(streak(list, new Date('2026-03-15T08:00'))).toBe(0);
  });
});

describe('syllabus', () => {
  it('has unique topic ids and a priority for each', () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    TOPICS.forEach((t) => expect(['high', 'medium', 'low']).toContain(topicPriority(t)));
  });
});
