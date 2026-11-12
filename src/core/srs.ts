// Spaced repetition (SM-2 lite). Grades: 0 = again, 1 = hard, 2 = good, 3 = easy.
import type { CardState } from './types';

export type Grade = 0 | 1 | 2 | 3;

export const dayKey = (d: Date = new Date()): string => {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const addDays = (key: string, n: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};

export function newCard(id: string, today = dayKey()): CardState {
  return { id, due: today, interval: 0, ease: 2.5, reps: 0, lapses: 0, updatedAt: new Date().toISOString() };
}

export function review(c: CardState, g: Grade, today = dayKey()): CardState {
  let { interval, ease, reps, lapses } = c;
  if (g === 0) {
    lapses++; reps = 0; interval = 0; ease = Math.max(1.3, ease - 0.2);
  } else {
    reps++;
    if (reps === 1) interval = g === 3 ? 3 : 1;
    else if (reps === 2) interval = g === 1 ? 3 : 6;
    else interval = Math.round(interval * (g === 1 ? 1.2 : g === 3 ? ease * 1.3 : ease));
    ease = Math.max(1.3, ease + (g === 1 ? -0.15 : g === 3 ? 0.15 : 0));
  }
  return { ...c, interval, ease, reps, lapses, due: addDays(today, interval), updatedAt: new Date().toISOString() };
}

export const isDue = (c: CardState, today = dayKey()) => c.due <= today;
