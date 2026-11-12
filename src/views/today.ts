import { html, render, nothing } from 'lit-html';
import { EXAMS, TOPIC_MAP } from '../core/syllabus';
import { streak } from '../core/analysis';
import { dayKey } from '../core/srs';
import { buildPlan, currentWeek } from '../core/plan';
import { buildTasks, type Task } from '../core/today';
import { app } from '../app/state';
import { session } from '../app/session';
import { dispatch, go } from '../app/router';
import { buildMock } from '../content/bank';
import { dot } from '../ui/components';
import { dailyKey, openMock } from './mocks';
import { startTour } from '../ui/tour';
import { dismissInstall, installHelp, onInstallChange, shouldOfferInstall } from '../ui/install';

/** The topic most of these questions come from (practice uses it only for its title and Back link). */
function commonTopic(ids: string[]): string {
  const want = new Set(ids);
  const n = new Map<string, number>();
  for (const a of app.attempts) if (want.has(a.questionId)) { want.delete(a.questionId); n.set(a.topic, (n.get(a.topic) ?? 0) + 1); }
  return [...n.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? app.attempts.find((a) => a.questionId === ids[0])?.topic ?? 'q-percentage';
}

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
  const answeredToday = app.attempts.filter((a) => a.chosen !== null && dayKey(new Date(a.at)) === day).length;

  const act = (t: Task) => {
    const a = t.action;
    if (a.kind === 'practice') { session.practice = { topic: a.topic, level: 0, mode: 'learn', n: 10 }; go(`#/topic/${a.topic}/learn`); }
    else if (a.kind === 'retry') { session.practice = { topic: commonTopic(a.questionIds), level: 0, mode: 'learn', n: a.questionIds.length, questionIds: a.questionIds, title: 'Fix past mistakes' }; go('#/practice'); }
    else if (a.kind === 'mock') openMock(mockKey, () => buildMock({ exam: a.exam, kind: 'daily', key: mockKey, seed: mockKey }));
    else go(a.href);
  };
  const quickPractice = (t: Task) => {
    if (t.action.kind === 'practice') { session.practice = { topic: t.action.topic, level: 0, mode: 'learn', n: 10 }; go('#/practice'); }
  };

  // hero: the first unfinished task. The rest of today's list sits below it.
  const next = tasks.find((t) => !t.done);
  const rest = tasks.filter((t) => t !== next);
  const left = Math.round(tasks.filter((t) => !t.done).reduce((a, t) => a + t.minutes, 0) / 5) * 5;
  const nextTopic = next?.action.kind === 'practice' ? TOPIC_MAP[next.action.topic] : null;
  const ctaText = (t: Task) => t.action.kind === 'practice' ? 'Read the notes' : t.action.kind === 'mock' ? 'Start the mock' : t.action.kind === 'retry' ? 'Retry them now' : 'Open flashcards';
  const dateText = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  render(html`<div class="page today">
    <header class="today-head">
      <div>
        <div class="date">${dateText}</div>
        <h1>${s.name ? `Namaste, ${s.name}` : 'Today'}</h1>
      </div>
      <div class="countdown" title=${plan.assumedDate ? 'Set your exam date in Profile' : `Exam on ${plan.examDate}`}>
        ${daysLeft !== null ? html`<b>${daysLeft} days</b><span>to ${EXAMS[exam].short}</span>` : html`<a href="#/profile">Set your exam date</a>`}
      </div>
    </header>

    ${resumable ? html`<button class="resume" @click=${() => go(`#/exam/${encodeURIComponent(resumable.key)}`)}>
      <span><b>Resume your ${EXAMS[resumable.exam].short} mock</b><span class="small">Paused at question ${resumable.current.index + 1}, section ${resumable.current.section + 1}. The timer waits for you.</span></span>
      <span class="btn sm">Resume</span></button>` : nothing}

    ${s.toured && shouldOfferInstall() ? html`<section class="install-banner" aria-label="Install the app">
      <div><b>Install CGL Prep</b><span class="small"> for one-tap access from your home screen. Works offline.</span></div>
      ${installHelp(true, () => dispatch())}
      <button class="btn ghost sm close" aria-label="Dismiss" @click=${() => { dismissInstall(); dispatch(); }}>✕</button>
    </section>` : nothing}

    <div class="today-cols">
      <div>
        ${next ? html`<section class="paper ruled next-up" aria-label="Next up">
          <p class="label">Next up${nextTopic ? html`, ${nextTopic.section}` : nothing}</p>
          <h2>${next.label}</h2>
          <p>${next.detail}. About ${next.minutes} minutes.</p>
          <div class="row">
            <button class="btn primary big-cta" @click=${() => act(next)}>${ctaText(next)}</button>
            ${next.action.kind === 'practice' ? html`<button class="btn ghost" @click=${() => quickPractice(next)}>Skip to 10 questions</button>` : nothing}
          </div>
        </section>` : html`<section class="paper ruled next-up">
          <p class="label">Today's plan is done</p>
          <h2>Well done. That's all for today.</h2>
          <p>If you have time left, take a sectional test or revise from your roadmap.</p>
          <a class="btn primary big-cta" href="#/mocks">Take a sectional test</a>
        </section>`}

        ${rest.length ? html`<section class="paper tasks" aria-label="Today's tasks">
          <div class="spread"><h2>Also today</h2><span class="small muted">${done} of ${tasks.length} done${left ? `, about ${left} min left` : ''}</span></div>
          <ul class="task-list">
            ${rest.map((t) => html`<li class=${t.done ? 'done' : ''}>
              <span class="tick" aria-hidden="true">${t.done ? '✓' : ''}</span>
              <button class="task-main" @click=${() => act(t)}>
                <b>${t.label}</b>
                <span class="small muted">${t.detail}</span>
              </button>
              <span class="sr-only">${t.done ? 'done' : 'not done'}</span>
            </li>`)}
          </ul>
        </section>` : nothing}

        <p class="stat-line">
          <span><b>${st}</b> day streak</span>
          <span><b>${answeredToday}</b> answered today</span>
          <a href="#/progress">See progress</a>
        </p>
      </div>

      <aside class="paper week-card" aria-label="This week">
        <div class="spread"><h2>Week ${week.index} of ${plan.weeks.length}</h2><a class="small" href="#/roadmap">Roadmap</a></div>
        <ol>${week.topics.slice(0, 6).map((t) => html`<li>${dot(t.topic.subject)} <a href="#/topic/${t.topic.id}">${t.topic.name}</a>${(app.stats[t.topic.id]?.attempts ?? 0) >= 10 ? html` <span class="hand">✓</span>` : nothing}</li>`)}</ol>
        ${week.topics.length > 6 ? html`<a class="small" href="#/roadmap">${week.topics.length - 6} more this week</a>` : nothing}
      </aside>
    </div>
  </div>`, el);
  const off = onInstallChange(() => dispatch());
  if (!s.toured) {
    // let the page paint first so the spotlight lands on real elements
    // mark as seen when it starts: closing the app mid-tour shouldn't bring it back (replay lives in Profile)
    app.saveSettings({ toured: true });
    requestAnimationFrame(() => startTour(() => {}));
  }
  return () => { off(); };
}
