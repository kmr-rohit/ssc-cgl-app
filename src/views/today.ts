import { html, render, nothing } from 'lit-html';
import { EXAMS, TOPICS, topicPriority } from '../core/syllabus';
import { streak, weakTopics } from '../core/analysis';
import { dayKey, isDue } from '../core/srs';
import { app } from '../app/state';
import { session } from '../app/session';
import { go } from '../app/router';
import { getManifest } from '../content/bank';
import { dot, omr } from '../ui/components';
import { pct } from '../ui/html';
import { dailyKey } from './mocks';
import { buildPlan, currentWeek } from '../core/plan';

export default function today(el: HTMLElement) {
  const s = app.settings;
  const day = dayKey();
  const st = streak(app.attempts);
  const doneToday = app.attempts.filter((a) => dayKey(new Date(a.at)) === day).length;
  const target = Math.max(20, Math.round(s.dailyHours * 25));
  const daysLeft = s.examDate ? Math.ceil((new Date(s.examDate).getTime() - Date.now()) / 86_400_000) : null;
  const exam = s.target;
  const weak = weakTopics(app.stats, exam).filter((w) => w.lost !== null).slice(0, 3);
  const m = getManifest();
  const fresh = TOPICS.filter((t) => !app.stats[t.id] && m?.topics[t.id] && topicPriority(t) === 'high' && t[exam === 'pre' ? 'pre' : exam === 'mains' ? 'mains' : 'stats'][1] > 0).slice(0, 3);
  const due = [...app.cards.values()].filter((c) => isDue(c)).length;
  const mockKey = dailyKey(exam);
  const mock = app.mocks.get(mockKey);

  const week = currentWeek(buildPlan({ exam, examDate: s.examDate, dailyHours: s.dailyHours, stats: app.stats }));
  const quick = (topic: string) => { session.practice = { topic, level: 0, mode: 'learn', n: 10 }; go('#/practice'); };

  render(html`<div class="page">
    <div class="kicker">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <h1>${s.name ? `Namaste, ${s.name}` : 'Today'}</h1>
    <div class="grid" style="margin-bottom:1rem">
      <div class="card"><div class="kicker">Streak</div><div class="big">${st} <span class="small muted">day${st === 1 ? '' : 's'}</span></div></div>
      <div class="card"><div class="kicker">Today's target</div><div class="big">${doneToday}<span class="small muted"> / ${target} questions</span></div>
        ${omr(Math.min(5, Math.floor((doneToday / target) * 5)))}</div>
      <div class="card"><div class="kicker">Exam</div>${daysLeft !== null
        ? html`<div class="big">${daysLeft} <span class="small muted">days left</span></div>`
        : html`<a href="#/settings">Set your exam date</a>`}</div>
    </div>

    <div class="ticket" style="margin-bottom:1rem">
      <div class="kicker">Today's mock</div>
      <div class="spread"><h3>${EXAMS[exam].name}</h3>
        ${mock?.status === 'submitted'
          ? html`<a class="btn" href="#/result/${encodeURIComponent(mockKey)}">Scored ${mock.score!.total.toFixed(1).replace(/\.0$/, '')} · review</a>`
          : html`<a class="btn primary" href="#/mocks">${mock?.status === 'in-progress' ? 'Resume' : 'Take it'}</a>`}</div>
    </div>

    <div class="grid">
      <section class="paper">
        <h2>Fix these first</h2>
        ${weak.length ? weak.map((w) => html`<div class="spread" style="padding:.4rem 0;border-bottom:1px solid var(--rule)">
            <span>${dot(w.topic.subject)} <a href="#/topic/${w.topic.id}">${w.topic.name}</a> <span class="small muted">${pct(w.stat!.accuracy)}</span></span>
            <button class="btn sm" @click=${() => quick(w.topic.id)}>Practise</button></div>`)
          : html`<p class="muted small">Do a few practice sets or a mock; your weakest high-weightage topics will appear here.</p>`}
        ${fresh.length ? html`<h3 style="margin-top:1rem">High-priority, not started</h3>
          ${fresh.map((t) => html`<div class="spread" style="padding:.3rem 0"><span>${dot(t.subject)} <a href="#/topic/${t.id}">${t.name}</a></span><button class="btn sm" @click=${() => quick(t.id)}>Start</button></div>`)}` : nothing}
      </section>
      <section class="paper">
        <div class="spread"><h2>This week</h2><a class="small" href="#/plan">Full plan</a></div>
        <p class="small muted">Week ${week.index} · ${week.phase === 'learn' ? 'learn + practise' : week.phase === 'revise' ? 'revise + mocks' : 'final week'} · ${week.mocks} mock${week.mocks === 1 ? '' : 's'}</p>
        ${week.topics.slice(0, 5).map((t) => html`<div class="spread" style="padding:.3rem 0"><span>${dot(t.topic.subject)} <a href="#/topic/${t.topic.id}">${t.topic.name}</a></span>
          ${(app.stats[t.topic.id]?.attempts ?? 0) >= 10 ? html`<span class="stamp ok">Done</span>` : html`<button class="btn sm" @click=${() => quick(t.topic.id)}>Practise</button>`}</div>`)}
        ${week.topics.length > 5 ? html`<a class="small" href="#/plan">+${week.topics.length - 5} more</a>` : nothing}
      </section>
      <section class="paper">
        <h2>Revise</h2>
        <p>${due ? html`<b>${due}</b> flashcard${due === 1 ? '' : 's'} due today.` : 'No flashcards due.'}</p>
        <div class="row"><a class="btn" href="#/revise">Open flashcards</a><a class="btn ghost" href="#/formulas">Formula sheets</a></div>
      </section>
    </div>
  </div>`, el);
}
