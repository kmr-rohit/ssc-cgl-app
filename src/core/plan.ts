// Week-by-week study plan. Pure: (settings, stats, today) → plan.
import { TOPICS, topicPriority, type Topic } from './syllabus';
import type { TopicStat } from './analysis';
import type { ExamId } from './types';
import { addDays, dayKey } from './srs';

export interface PlanWeek {
  index: number;            // 1-based
  start: string;            // YYYY-MM-DD (week start)
  end: string;
  phase: 'learn' | 'revise' | 'final';
  topics: { topic: Topic; hours: number; reason: 'new' | 'weak' | 'revise' }[];
  mocks: number;            // full mocks this week
  hours: number;            // study hours available this week
}

export interface Plan { weeks: PlanWeek[]; examDate: string; assumedDate: boolean; totalHours: number; neededHours: number; tight: boolean }

const BASE_HOURS = { high: 8, medium: 5, low: 2.5 } as const;
const weightKey = (e: ExamId) => (e === 'pre' ? 'pre' : e === 'mains' ? 'mains' : 'stats') as 'pre' | 'mains' | 'stats';

/** Hours a topic still needs, given what the student has done. */
export function topicHours(t: Topic, s: TopicStat | undefined): { hours: number; reason: 'new' | 'weak' | 'revise' } {
  const base = BASE_HOURS[topicPriority(t)];
  if (!s || s.attempts < 10) return { hours: base, reason: 'new' };
  if (s.accuracy < 0.6) return { hours: Math.round(base * 0.7 * 2) / 2, reason: 'weak' };
  if (s.accuracy < 0.8 || s.slow) return { hours: Math.round(base * 0.4 * 2) / 2, reason: 'weak' };
  return { hours: 1, reason: 'revise' };
}

export function buildPlan(opts: { exam: ExamId; examDate: string | null; dailyHours: number; stats: Record<string, TopicStat>; today?: string }): Plan {
  const today = opts.today ?? dayKey();
  const assumedDate = !opts.examDate || opts.examDate <= today;
  const examDate = assumedDate ? addDays(today, 7 * 12) : opts.examDate!;
  const days = Math.max(7, Math.round((Date.parse(examDate) - Date.parse(today)) / 86_400_000));
  const nWeeks = Math.max(1, Math.ceil(days / 7));
  const key = weightKey(opts.exam);

  // syllabus order: priority, then weight, interleaving subjects so each week mixes them
  const pool = TOPICS.filter((t) => t[key][1] > 0)
    .map((t) => ({ topic: t, ...topicHours(t, opts.stats[t.id]), w: (t[key][0] + t[key][1]) / 2 }))
    .sort((a, b) => (a.reason === 'revise' ? 1 : 0) - (b.reason === 'revise' ? 1 : 0) || b.w - a.w);
  const bySubject = new Map<string, typeof pool>();
  pool.forEach((p) => bySubject.set(p.topic.subject, [...(bySubject.get(p.topic.subject) ?? []), p]));
  const queue: typeof pool = [];
  while ([...bySubject.values()].some((l) => l.length)) for (const l of bySubject.values()) if (l.length) queue.push(l.shift()!);

  // last ~20% of weeks (min 1, max 4) are revision + mocks; final week is mocks only
  const reviseWeeks = nWeeks <= 2 ? 0 : Math.min(4, Math.max(1, Math.round(nWeeks * 0.2)));
  const learnWeeks = Math.max(1, nWeeks - reviseWeeks);
  const weekHours = opts.dailyHours * 7;
  const studyShare = (i: number) => (i < learnWeeks ? 0.75 : 0.4); // rest goes to mocks + analysis
  const neededHours = queue.reduce((a, p) => a + p.hours, 0);
  const learnCapacity = learnWeeks * weekHours * studyShare(0);

  // If time is short, every topic gets proportionally fewer hours (min 1 h) instead of dropping topics.
  const scale = Math.min(1, learnCapacity / (neededHours || 1));
  const items = queue.map((p) => ({ ...p, hours: Math.max(1, Math.round(p.hours * scale * 2) / 2) }));
  const perWeek = items.reduce((a, p) => a + p.hours, 0) / learnWeeks;

  const weeks: PlanWeek[] = [];
  let qi = 0, scheduled = 0;
  for (let i = 0; i < nWeeks; i++) {
    const start = addDays(today, i * 7);
    const end = i === nWeeks - 1 ? examDate : addDays(start, 6);
    const phase: PlanWeek['phase'] = i === nWeeks - 1 && nWeeks > 1 ? 'final' : i < learnWeeks ? 'learn' : 'revise';
    const w: PlanWeek = { index: i + 1, start, end, phase, topics: [], mocks: phase === 'learn' ? (i < 2 ? 1 : 2) : phase === 'revise' ? 4 : 5, hours: weekHours };
    if (phase === 'learn') {
      // fill up to the cumulative even share, so weeks stay balanced
      const target = perWeek * (i + 1);
      const isLast = i === learnWeeks - 1;
      while (qi < items.length && (isLast || !w.topics.length || scheduled + items[qi].hours / 2 <= target)) {
        w.topics.push({ topic: items[qi].topic, hours: items[qi].hours, reason: items[qi].reason });
        scheduled += items[qi].hours; qi++;
      }
    } else if (phase === 'revise') {
      // revisit the heaviest topics, weakest first, within ~40% of the week (the rest is mocks)
      const heavy = pool.filter((p) => p.w >= 1.5)
        .sort((a, b) => (opts.stats[a.topic.id]?.accuracy ?? 0) - (opts.stats[b.topic.id]?.accuracy ?? 0) || b.w - a.w);
      const per = Math.max(2, Math.floor((weekHours * 0.4) / 1.5));
      const k = i - learnWeeks;
      heavy.slice(k * per, (k + 1) * per).forEach((p) => w.topics.push({ topic: p.topic, hours: 1.5, reason: 'revise' }));
    }
    weeks.push(w);
  }

  return { weeks, examDate, assumedDate, totalHours: nWeeks * weekHours, neededHours, tight: neededHours > learnCapacity };
}

export const currentWeek = (p: Plan, today = dayKey()) => p.weeks.find((w) => today >= w.start && today <= w.end) ?? p.weeks[0];

/** Topics practised before but not in the last 7 days and below 80% — due for revision. */
export function revisionDue(stats: Record<string, TopicStat>, today = new Date()): TopicStat[] {
  const cutoff = today.getTime() - 7 * 86_400_000;
  return Object.values(stats).filter((s) => s.lastAt && Date.parse(s.lastAt) < cutoff && s.accuracy < 0.8)
    .sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
}
