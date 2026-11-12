// Weak-topic analysis from attempts. Pure functions.
import { EXAMS, TOPICS, TOPIC_MAP } from './syllabus';
import type { Attempt, ExamId, SubjectId } from './types';
import { dayKey } from './srs';

/** Target seconds per question by subject (SSC pace). */
export const TARGET_SEC: Record<SubjectId, number> = { quant: 54, reasoning: 36, english: 30, ga: 20, computer: 40, statistics: 72 };

export interface TopicStat {
  /** `attempts` counts ANSWERED questions only (chosen !== null); skips are in `skipped`. Accuracy and avgSec use answered ones. */
  topic: string; attempts: number; correct: number; wrong: number; skipped: number;
  accuracy: number; avgSec: number; slow: boolean; lastAt: string | null;
  byType: Record<string, { attempts: number; correct: number }>;
}

export function topicStats(attempts: Attempt[]): Record<string, TopicStat> {
  const m: Record<string, TopicStat> = {};
  for (const a of attempts) {
    const s = (m[a.topic] ||= { topic: a.topic, attempts: 0, correct: 0, wrong: 0, skipped: 0, accuracy: 0, avgSec: 0, slow: false, lastAt: null, byType: {} });
    s.lastAt = a.at;
    if (a.chosen === null) { s.skipped++; continue; } // a skip is not an attempt: no accuracy, time or progress from it
    s.attempts++;
    if (a.correct) s.correct++; else s.wrong++;
    s.avgSec += a.ms / 1000;
    const t = (s.byType[a.type] ||= { attempts: 0, correct: 0 });
    t.attempts++; if (a.correct) t.correct++;
  }
  for (const s of Object.values(m)) {
    const answered = s.correct + s.wrong;
    s.accuracy = answered ? s.correct / answered : 0;
    s.avgSec = s.attempts ? s.avgSec / s.attempts : 0;
    const subj = TOPIC_MAP[s.topic]?.subject;
    s.slow = !!subj && s.avgSec > TARGET_SEC[subj] * 1.25;
  }
  return m;
}

/**
 * Expected marks lost per paper = weight × (1 − accuracy) × marks + wrong-rate × negative.
 * Needs `minAttempts` ANSWERED questions in the topic before it claims anything (skips don't count).
 */
export const MIN_ANSWERED_FOR_LEAK = 10;
export function weakTopics(stats: Record<string, TopicStat>, exam: ExamId, minAttempts = MIN_ANSWERED_FOR_LEAK) {
  const e = EXAMS[exam];
  const key = exam === 'pre' ? 'pre' : exam === 'mains' ? 'mains' : 'stats';
  return TOPICS.filter((t) => t[key][1] > 0)
    .map((t) => {
      const s = stats[t.id];
      const weight = (t[key][0] + t[key][1]) / 2;
      if (!s || s.attempts < minAttempts) return { topic: t, stat: s, lost: null as number | null, weight };
      const answered = s.correct + s.wrong || 1;
      const lost = weight * ((1 - s.accuracy) * e.marks + (s.wrong / answered) * e.negative);
      return { topic: t, stat: s, lost, weight };
    })
    .sort((a, b) => (b.lost ?? -1) - (a.lost ?? -1) || b.weight - a.weight);
}

/** Days with at least one attempt, counting back from today. */
export function streak(attempts: Attempt[], today = new Date()): number {
  const days = new Set(attempts.map((a) => dayKey(new Date(a.at))));
  let n = 0;
  const d = new Date(today);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // today not done yet doesn't break the streak
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
