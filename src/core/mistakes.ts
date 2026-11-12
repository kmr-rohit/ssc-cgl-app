// "My mistakes": questions whose LATEST attempt was wrong or skipped. Answering correctly later clears them.
import type { Attempt } from './types';

export interface Mistake {
  questionId: string;
  topic: string;
  type: string;
  lastAt: string;
  wrongCount: number;   // how many times it was answered wrong (skips not counted)
  skipped: boolean;     // latest attempt was a skip (vs a wrong answer)
}

export function mistakes(attempts: Attempt[]): Mistake[] {
  const latest = new Map<string, Attempt>();
  const wrong = new Map<string, number>();
  for (const a of attempts) {
    const prev = latest.get(a.questionId);
    if (!prev || a.at >= prev.at) latest.set(a.questionId, a);
    if (!a.correct && a.chosen !== null) wrong.set(a.questionId, (wrong.get(a.questionId) ?? 0) + 1);
  }
  return [...latest.values()]
    .filter((a) => !a.correct)
    .map((a) => ({ questionId: a.questionId, topic: a.topic, type: a.type, lastAt: a.at, wrongCount: wrong.get(a.questionId) ?? 1, skipped: a.chosen === null }))
    .sort((x, y) => y.wrongCount - x.wrongCount || y.lastAt.localeCompare(x.lastAt));
}
