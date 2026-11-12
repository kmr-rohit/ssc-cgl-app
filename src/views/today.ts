import { html, render, nothing } from 'lit-html';
import { EXAMS, TOPIC_MAP } from '../core/syllabus';
import { streak } from '../core/analysis';
import { dayKey } from '../core/srs';
import { buildPlan, currentWeek } from '../core/plan';
import { buildTasks, type Task } from '../core/today';
import { app } from '../app/state';
import { session } from '../app/session';
import { go } from '../app/router';
import { buildMock } from '../content/bank';
import { dot } from '../ui/components';
import { dailyKey, openMock } from './mocks';
import { startTour } from '../ui/tour';

export default async function today(el: HTMLElement) {
  const s = app.settings;
  if (!s.onboarded) {
    if (app.attempts.length === 0) { go('#/welcome'); return; }
    await app.saveSettings({ onboarded: true }); // existing users skip setup
  }
  const day = dayKey();
  const exam = s.target;
  const plan = buildPlan({ exam, examDate: s.examDate, dailyHours: s.dailyHours, stats: app.stats });
  const week = currentWeek(plan);
  const mockKey = dailyKey(exam);
  const tasks = buildTasks({
    exam, dailyHours: s.dailyHours, week, attempts: app.attempts, mocks: [...app.mocks.values()], cards: [...app.cards.values()],
    topicDone: (t) => (app.stats[t]?.attempts ?? 0) >= 10, dailyMockKey: mockKey,
  });
  const done = tasks.filter((t) => t.done).length;
  const st = streak(app.attempts);
  const daysLeft = plan.assumedDate ? null : Math.max(0, Math.round((Date.parse(plan.examDate) - Date.parse(day)) / 86_400_000));
  const resumable = [...app.mocks.values()].filter((m) => m.status === 'in-progress').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const answeredToday = app.attempts.filter((a) => dayKey(new Date(a.at)) === day).length;

  const act = (t: Task) => {
    const a = t.action;
    if (a.kind === 'practice') { session.practice = { topic: a.topic, level: 0, mode: 'learn', n: 10 }; go(`#/topic/${a.topic}/learn`); }
    else if (a.kind === 'retry') { session.practice = { topic: 'q-percentage', level: 0, mode: 'learn', n: a.questionIds.length, questionIds: a.questionIds, title: 'Fix past mistakes' }; go('#/practice'); }
    else if (a.kind === 'mock') openMock(mockKey, () => buildMock({ exam: a.exam, kind: 'daily', key: mockKey, seed: mockKey }));
    else go(a.href);
  };
  const quickPractice = (t: Task) => {
    if (t.action.kind === 'practice') { session.practice = { topic: t.action.topic, level: 0, mode: 'learn', n: 10 }; go('#/practice'); }
  };

  render(html`<div class="page today">
    <div class="spread">
      <div>
        <div class="kicker">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>${s.name ? `Namaste, ${s.name}` : 'Today'}</h1>
      </div>
      <div class="countdown" title=${plan.assumedDate ? 'Set your exam date in Profile' : `Exam on ${plan.examDate}`}>
        ${daysLeft !== null ? html`<b>${daysLeft}</b><span>days to ${EXAMS[exam].short}</span>` : html`<a href="#/profile">Set exam date</a>`}
      </div>
    </div>

    ${resumable ? html`<button class="resume" @click=${() => go(`#/exam/${encodeURIComponent(resumable.key)}`)}>
      <span><b>Resume your ${EXAMS[resumable.exam].short} mock</b><span class="small">Question ${resumable.current.index + 1} of section ${resumable.current.section + 1}: the timer is paused</span></span>
      <span aria-hidden="true">→</span></button>` : nothing}

    <section class="paper tasks" aria-label="Today's tasks">
      <div class="spread"><h2>Today's plan</h2><span class="small muted">${done}/${tasks.length} done · ~${Math.round(tasks.filter((t) => !t.done).reduce((a, t) => a + t.minutes, 0) / 5) * 5} min left</span></div>
      <ol class="task-list">
        ${tasks.map((t) => html`<li class=${t.done ? 'done' : ''}>
          <span class="tick" aria-hidden="true">${t.done ? '✓' : ''}</span>
          <button class="task-main" @click=${() => act(t)}>
            <b>${t.action.kind === 'practice' && TOPIC_MAP[t.action.topic] ? html`${dot(TOPIC_MAP[t.action.topic].subject)} ` : nothing}${t.label}</b>
            <span class="small muted">${t.detail}</span>
          </button>
          ${t.action.kind === 'practice' && !t.done ? html`<button class="btn sm" @click=${() => quickPractice(t)}>Practise</button>` : nothing}
          <span class="sr-only">${t.done ? 'done' : 'not done'}</span>
        </li>`)}
      </ol>
      ${done === tasks.length ? html`<p class="tip">All done for today. Great work! Extra practice from your <a href="#/roadmap">roadmap</a> always helps.</p>` : nothing}
    </section>

    <div class="stat-row">
      <a class="card" href="#/progress"><div class="kicker">Streak</div><div class="big">${st}<span class="small muted"> day${st === 1 ? '' : 's'}</span></div></a>
      <a class="card" href="#/progress"><div class="kicker">Answered today</div><div class="big">${answeredToday}</div></a>
      <a class="card" href="#/roadmap"><div class="kicker">Roadmap</div><div class="big">Wk ${week.index}<span class="small muted"> / ${plan.weeks.length}</span></div></a>
    </div>
  </div>`, el);
  if (!s.toured) {
    // let the page paint first so the spotlight lands on real elements
    // mark as seen when it starts: closing the app mid-tour shouldn't bring it back (replay lives in Profile)
    app.saveSettings({ toured: true });
    requestAnimationFrame(() => startTour(() => {}));
  }
}
