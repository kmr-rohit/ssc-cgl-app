import { describe, expect, it } from 'vitest';
import { buildPlan, currentWeek, revisionDue, topicHours } from './plan';
import { TOPICS, TOPIC_MAP } from './syllabus';
import { cubes, fractionPercent, squares } from './tables';
import type { TopicStat } from './analysis';

const stat = (topic: string, accuracy: number, attempts = 20, lastAt = '2026-01-01T00:00:00Z'): TopicStat =>
  ({ topic, attempts, correct: Math.round(attempts * accuracy), wrong: attempts - Math.round(attempts * accuracy), skipped: 0, accuracy, avgSec: 30, slow: false, lastAt, byType: {} });

describe('study plan', () => {
  const base = { exam: 'pre' as const, examDate: '2026-04-01', dailyHours: 4, stats: {}, today: '2026-01-07' };

  it('covers every Tier 1 topic exactly once in learn weeks and ends on the exam date', () => {
    const p = buildPlan(base);
    const learnTopics = p.weeks.filter((w) => w.phase === 'learn').flatMap((w) => w.topics.map((t) => t.topic.id));
    const t1 = TOPICS.filter((t) => t.pre[1] > 0).map((t) => t.id);
    expect(new Set(learnTopics)).toEqual(new Set(t1));
    expect(learnTopics.length).toBe(t1.length);
    expect(p.weeks.at(-1)!.end).toBe('2026-04-01');
    expect(p.weeks.at(-1)!.phase).toBe('final');
  });

  it('schedules high-priority topics before low ones', () => {
    const p = buildPlan(base);
    const order = p.weeks.flatMap((w) => w.topics.map((t) => t.topic.id));
    expect(order.indexOf('q-geometry')).toBeLessThan(order.indexOf('q-hcf-lcm'));
  });

  it('gives mastered topics less time and flags a tight plan', () => {
    expect(topicHours(TOPIC_MAP['q-geometry'], stat('q-geometry', 0.95)).hours).toBeLessThan(topicHours(TOPIC_MAP['q-geometry'], undefined).hours);
    const tight = buildPlan({ ...base, examDate: '2026-01-21', dailyHours: 1 });
    expect(tight.tight).toBe(true);
  });

  it('assumes 12 weeks when no exam date is set', () => {
    const p = buildPlan({ ...base, examDate: null });
    expect(p.assumedDate).toBe(true);
    expect(p.weeks.length).toBe(12);
    expect(currentWeek(p, '2026-01-07').index).toBe(1);
  });

  it('lists stale weak topics as due for revision', () => {
    const due = revisionDue({ a: stat('q-algebra', 0.5), b: stat('q-average', 0.9) }, new Date('2026-02-01'));
    expect(due.map((d) => d.topic)).toEqual(['q-algebra']);
  });
});

describe('tables', () => {
  it('computes squares, cubes and exact fraction percents', () => {
    expect(squares().at(-1)).toEqual({ n: 50, v: 2500 });
    expect(cubes()[11]).toEqual({ n: 12, v: 1728 });
    const fp = Object.fromEntries(fractionPercent().map((r) => [r.frac, r.pct]));
    expect(fp['1/3']).toBe('33 1/3%');
    expect(fp['1/8']).toBe('12 1/2%');
    expect(fp['1/7']).toBe('14 2/7%');
    expect(fp['3/4']).toBe('75%');
  });
});

describe('plan balance', () => {
  it('keeps learn weeks balanced even when time is short', () => {
    const p = buildPlan({ exam: 'pre', examDate: '2026-03-04', dailyHours: 2, stats: {}, today: '2026-01-07' });
    const hrs = p.weeks.filter((w) => w.phase === 'learn').map((w) => w.topics.reduce((a, t) => a + t.hours, 0));
    expect(Math.max(...hrs) - Math.min(...hrs)).toBeLessThanOrEqual(8);
    expect(p.tight).toBe(true);
  });
});
