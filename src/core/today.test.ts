import { describe, expect, it } from 'vitest';
import { buildTasks, isMockDay } from './today';
import { mistakes } from './mistakes';
import { buildPlan } from './plan';
import type { Attempt } from './types';

const at = (q: string, correct: boolean, when: string, topic = 'q-percentage', chosen: number | null = correct ? 0 : 1): Attempt =>
  ({ id: `${q}-${when}`, questionId: q, rev: 1, topic, type: 'basic', level: 1, chosen, correct, ms: 9000, mode: 'learn', at: new Date(when).toISOString() });

describe('mistakes', () => {
  it('lists questions whose latest attempt was wrong or skipped, and clears fixed ones', () => {
    const m = mistakes([
      at('a', false, '2026-01-01T10:00'), at('a', true, '2026-01-02T10:00'),   // fixed
      at('b', false, '2026-01-01T10:00'), at('b', false, '2026-01-03T10:00'),  // wrong twice
      at('c', false, '2026-01-02T10:00', 'q-percentage', null),                 // skipped
    ]);
    expect(m.map((x) => x.questionId)).toEqual(['b', 'c']);
    expect(m[0].wrongCount).toBe(2);
    expect(m[1].skipped).toBe(true);
  });
});

describe('today tasks', () => {
  const plan = buildPlan({ exam: 'pre', examDate: '2026-04-01', dailyHours: 3, stats: {}, today: '2026-01-05' });
  const week = plan.weeks[0];
  const base = { exam: 'pre' as const, dailyHours: 3, week, mocks: [], cards: [], topicDone: () => false, today: '2026-01-05', dailyMockKey: 'pre-2026-01-05' };

  it('spreads mocks evenly across the week', () => {
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => isMockDay(1, d))).toEqual([6]);
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => isMockDay(2, d)).length).toBe(2);
    expect([0, 1, 2, 3, 4, 5, 6].every((d) => isMockDay(7, d))).toBe(true);
  });

  it('starts with the first roadmap topic and ticks it off after 10 questions today', () => {
    const first = week.topics[0].topic.id;
    const t0 = buildTasks({ ...base, attempts: [] });
    expect(t0[0].id).toBe(`study:${first}`);
    expect(t0[0].done).toBe(false);
    const ten = Array.from({ length: 10 }, (_, i) => at(`${first}-${i}`, true, '2026-01-05T09:00', first));
    expect(buildTasks({ ...base, attempts: ten })[0].done).toBe(true);
  });

  it('adds a mistakes task from earlier days and completes it when they are retried today', () => {
    const past = [at('x1', false, '2026-01-04T10:00'), at('x2', false, '2026-01-04T10:00')];
    const t = buildTasks({ ...base, attempts: past }).find((x) => x.id === 'mistakes')!;
    expect(t.done).toBe(false);
    expect(t.action).toEqual({ kind: 'retry', questionIds: ['x1', 'x2'] });
    const retried = [...past, at('x1', true, '2026-01-05T11:00'), at('x2', false, '2026-01-05T11:00')];
    expect(buildTasks({ ...base, attempts: retried }).find((x) => x.id === 'mistakes')!.done).toBe(true);
  });
});
