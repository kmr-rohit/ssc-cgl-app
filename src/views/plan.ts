import { html, render, nothing } from 'lit-html';
import { EXAMS, SUBJECTS } from '../core/syllabus';
import { buildPlan, currentWeek, revisionDue } from '../core/plan';
import { dayKey } from '../core/srs';
import { app } from '../app/state';
import { session } from '../app/session';
import { go } from '../app/router';
import { dot } from '../ui/components';
import { niceDate, pct } from '../ui/html';
import { TOPIC_MAP } from '../core/syllabus';

export default function planView(el: HTMLElement) {
  const s = app.settings;
  const plan = buildPlan({ exam: s.target, examDate: s.examDate, dailyHours: s.dailyHours, stats: app.stats });
  const now = currentWeek(plan);
  const due = revisionDue(app.stats);
  const today = dayKey();
  const practise = (topic: string) => { session.practice = { topic, level: 0, mode: 'learn', n: 10 }; go('#/practice'); };
  const done = (topic: string) => (app.stats[topic]?.attempts ?? 0) >= 10;

  render(html`<div class="page">
    <div class="kicker">${EXAMS[s.target].name}</div>
    <h1>Roadmap</h1>
    <p class="muted">${plan.weeks.length} week${plan.weeks.length === 1 ? '' : 's'} to ${niceDate(plan.examDate)} at ${s.dailyHours} h/day.
      Topics are ordered by weightage and mixed across subjects; topics you already score well on get less time. <a href="#/profile">Change exam date or hours</a></p>
    ${plan.assumedDate ? html`<p class="chip medium">No exam date set, so this assumes 12 weeks. Set your date in your profile.</p>` : nothing}
    ${plan.tight ? html`<p class="trap">The syllabus needs about <b>${Math.round(plan.neededHours)} h</b> but the learning weeks have about ${Math.round(plan.totalHours * 0.75)} h. Increase daily hours, or focus on high-priority topics first (they come first in the plan).</p>` : nothing}

    ${due.length ? html`<section class="paper" style="margin:1rem 0"><h2>Due for revision</h2>
      <p class="small muted">Practised more than a week ago and below 80%.</p>
      ${due.map((d) => html`<div class="spread" style="padding:.35rem 0;border-bottom:1px solid var(--rule)">
        <span>${dot(TOPIC_MAP[d.topic].subject)} <a href="#/topic/${d.topic}">${TOPIC_MAP[d.topic].name}</a> <span class="small muted">${pct(d.accuracy)}</span></span>
        <button class="btn sm" @click=${() => practise(d.topic)}>Revise</button></div>`)}</section>` : nothing}

    ${plan.weeks.map((w) => html`<section class="paper week ${w === now ? 'now' : ''} ${w.end < today ? 'past' : ''}" style="margin-bottom:1rem">
      <div class="spread">
        <h2>Week ${w.index} <span class="small muted">${niceDate(w.start)} – ${niceDate(w.end)}</span></h2>
        <span class="row">${w === now ? html`<span class="chip high">This week</span>` : nothing}
          <span class="chip">${w.phase === 'learn' ? 'Learn + practise' : w.phase === 'revise' ? 'Revise + mocks' : 'Final week: mocks & rest'}</span>
          <span class="chip">${w.mocks} mock${w.mocks === 1 ? '' : 's'}</span></span>
      </div>
      ${w.topics.length ? html`<div class="week-topics">${w.topics.map((t) => html`<div class="spread week-topic">
        <span>${dot(t.topic.subject)} <a href="#/topic/${t.topic.id}">${t.topic.name}</a>
          <span class="small muted">${SUBJECTS[t.topic.subject].short} · ~${t.hours} h${t.reason === 'weak' ? ' · weak' : t.reason === 'revise' ? ' · revise' : ''}</span></span>
        ${done(t.topic.id) && t.reason !== 'revise' ? html`<span class="stamp ok">Done</span>` : w === now ? html`<button class="btn sm" @click=${() => practise(t.topic.id)}>Practise</button>` : nothing}
      </div>`)}</div>`
        : html`<p class="small muted">${w.phase === 'final' ? 'Daily full mocks, review mistakes, revise formula sheets and flashcards. Sleep well before the exam.' : 'Mocks and analysis.'}</p>`}
    </section>`)}
  </div>`, el);
}
