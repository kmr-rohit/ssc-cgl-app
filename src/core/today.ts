// Today's checklist: derived from the roadmap + what the student has already done today. Pure.
import type { Attempt, CardState, ExamId, MockRecord } from './types';
import type { PlanWeek } from './plan';
import { mistakes } from './mistakes';
import { dayKey, isDue } from './srs';

export type TaskAction =
  | { kind: 'practice'; topic: string }
  | { kind: 'mock'; exam: ExamId }
  | { kind: 'retry'; questionIds: string[] }
  | { kind: 'link'; href: string };

export interface Task { id: string; label: string; detail: string; done: boolean; action: TaskAction; minutes: number }

/** Spread `perWeek` mocks evenly over a 7-day week; dayIndex 0..6 from the week's start. */
export const isMockDay = (perWeek: number, dayIndex: number) =>
  perWeek >= 7 || Math.floor(((dayIndex + 1) * perWeek) / 7) > Math.floor((dayIndex * perWeek) / 7);

const localDay = (iso: string) => dayKey(new Date(iso));

export function buildTasks(o: {
  exam: ExamId; dailyHours: number; week: PlanWeek; attempts: Attempt[]; mocks: MockRecord[]; cards: CardState[];
  topicDone: (topic: string) => boolean; today?: string; dailyMockKey: string;
}): Task[] {
  const today = o.today ?? dayKey();
  const todays = o.attempts.filter((a) => localDay(a.at) === today);
  const tasks: Task[] = [];

  // 1. study the next roadmap topic (10 questions today in that topic = done)
  const next = o.week.topics.find((t) => t.reason !== 'revise' && !o.topicDone(t.topic.id))
    ?? o.week.topics.find((t) => todays.some((a) => a.topic === t.topic.id))
    ?? o.week.topics[0];
  if (next) {
    const n = todays.filter((a) => a.topic === next.topic.id).length;
    tasks.push({
      id: `study:${next.topic.id}`, label: next.topic.name,
      detail: n >= 10 ? `${n} questions done` : `${next.reason === 'revise' ? 'Revise' : 'Learn & practise'}: notes, then 10 questions (${n}/10)`, done: n >= 10,
      action: { kind: 'practice', topic: next.topic.id }, minutes: 45,
    });
  }

  // 2. mistakes from before today (10 retried correctly or attempted today = done)
  const before = o.attempts.filter((a) => localDay(a.at) < today);
  const open = mistakes(before).map((m) => m.questionId);
  if (open.length) {
    const retried = new Set(todays.filter((a) => open.includes(a.questionId)).map((a) => a.questionId)).size;
    const goal = Math.min(10, open.length);
    tasks.push({
      id: 'mistakes', label: 'Fix past mistakes', detail: retried >= goal ? `${retried} retried` : `Retry ${goal} questions you got wrong (${retried}/${goal})`,
      done: retried >= goal, action: { kind: 'retry', questionIds: open.slice(0, 10) }, minutes: 15,
    });
  }

  // 3. flashcards due
  const due = o.cards.filter((c) => isDue(c, today)).length;
  const reviewedToday = o.cards.filter((c) => localDay(c.updatedAt) === today).length;
  if (due || reviewedToday) {
    tasks.push({
      id: 'cards', label: 'Flashcards', detail: due ? `${due} card${due === 1 ? '' : 's'} due` : `${reviewedToday} reviewed`,
      done: due === 0, action: { kind: 'link', href: '#/revise' }, minutes: 10,
    });
  } else {
    tasks.push({ id: 'cards', label: 'Learn new words', detail: '10 new vocabulary cards', done: false, action: { kind: 'link', href: '#/revise' }, minutes: 10 });
  }

  // 4. mock on scheduled days
  const dayIndex = Math.max(0, Math.round((Date.parse(today) - Date.parse(o.week.start)) / 86_400_000));
  if (isMockDay(o.week.mocks, dayIndex)) {
    const m = o.mocks.find((x) => x.key === o.dailyMockKey);
    tasks.push({
      id: 'mock', label: "Today's mock", detail: m?.status === 'submitted' ? `Scored ${fmt(m.score!.total)}/${m.score!.max}` : m?.status === 'in-progress' ? 'In progress: resume it' : 'Full paper, exam conditions',
      done: m?.status === 'submitted', action: { kind: 'mock', exam: o.exam }, minutes: o.exam === 'pre' ? 60 : 135,
    });
  }
  return tasks;
}

const fmt = (x: number) => x.toFixed(1).replace(/\.0$/, '');
