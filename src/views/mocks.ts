import { html, render, nothing } from 'lit-html';
import { EXAMS, SUBJECTS } from '../core/syllabus';
import { dayKey, addDays } from '../core/srs';
import type { ExamId, MockRecord, SubjectId } from '../core/types';
import { app } from '../app/state';
import { dispatch, go, toast } from '../app/router';
import { loadSavedTests, startDraft } from './builder';
import { buildMock } from '../content/bank';
import { confirmDialog } from '../ui/components';
import { niceDate } from '../ui/html';

export const dailyKey = (exam: ExamId, day = dayKey()) => `${exam}-${day}`;

export async function openMock(key: string, make: () => Promise<MockRecord>) {
  if (!app.mocks.has(key)) {
    toast('Preparing paper…');
    const m = await make();
    await app.saveMock(m);
  }
  go(`#/exam/${encodeURIComponent(key)}`);
}

export default async function mocks(el: HTMLElement) {
  const myTests = await loadSavedTests();
  const today = dayKey();
  const exams: ExamId[] = app.settings.paper2 ? ['pre', 'mains', 'stats'] : ['pre', 'mains'];

  const ticket = (exam: ExamId, day: string) => {
    const key = dailyKey(exam, day);
    const m = app.mocks.get(key);
    const e = EXAMS[exam];
    const status = !m ? 'Not started' : m.status === 'submitted' ? `Scored ${m.score!.total.toFixed(1).replace(/\.0$/, '')}/${m.score!.max}` : m.status === 'in-progress' ? 'In progress' : 'Ready';
    return html`<div class="ticket">
      ${day === today ? nothing : html`<div class="kicker">Admit card for ${niceDate(day)}</div>`}
      <h3>${e.name}</h3>
      <dl><dt>Questions</dt><dd>${e.sections.reduce((a, s) => a + s.count, 0)}</dd>
        <dt>Time</dt><dd>${e.sections.reduce((a, s) => a + s.minutes, 0)} min</dd>
        <dt>Status</dt><dd>${status}</dd></dl>
      ${m?.status === 'submitted'
        ? html`<a class="btn" href="#/result/${encodeURIComponent(key)}">View result</a>`
        : html`<button class="btn primary" @click=${() => openMock(key, () => buildMock({ exam, kind: 'daily', key, seed: key }))}>${m?.status === 'in-progress' ? 'Resume' : 'Start'}</button>`}
    </div>`;
  };

  const sectional = (exam: ExamId, subject: SubjectId) => {
    const key = `sec-${exam}-${subject}-${Date.now()}`;
    openMock(key, () => buildMock({ exam, kind: 'sectional', key, seed: key, subjects: [subject] }));
  };

  const past = [...app.mocks.values()].filter((m) => !(m.kind === 'daily' && m.key.endsWith(today)))
    .sort((a, b) => (b.startedAt ?? b.updatedAt).localeCompare(a.startedAt ?? a.updatedAt));
  // a day counts as missed only if the student was already using the app then: nothing before their first activity
  const firstDay = [
    ...app.attempts.map((a) => a.at), ...[...app.mocks.values()].map((m) => m.startedAt ?? m.updatedAt), ...[...app.cards.values()].map((c) => c.updatedAt),
  ].filter(Boolean).map((x) => dayKey(new Date(x))).sort()[0];
  const missed = firstDay ? [1, 2, 3].map((d) => addDays(today, -d)).filter((d) => d >= firstDay) : [];

  render(html`<div class="page">
    <h1>Mocks</h1>
    <p class="muted">A fresh paper every day on the latest SSC pattern.</p>
    <h2>Today's papers</h2>
    <div class="grid">${exams.map((x) => ticket(x, today))}</div>

    <div class="spread" style="margin-top:1.5rem">
      <h2 style="margin:0">Your own test</h2>
      <a class="btn" href="#/build">Build a test</a>
    </div>
    <p class="small muted">Pick the subjects, topics, size and rules: weak topics only, your mistakes, no negative marking and more.</p>
    ${myTests.length ? html`<div class="paper" style="padding:.3rem 1rem">${myTests.map((t) => html`<div class="spread" style="padding:.45rem 0;border-bottom:1px solid var(--rule)">
      <span>${t.name}</span><button class="btn sm" @click=${() => startDraft(t.draft).catch((e) => toast((e as Error).message))}>Start</button></div>`)}</div>` : nothing}

    <h2 style="margin-top:1.5rem">Sectional tests</h2>
    <div class="paper">
      ${exams.map((x) => html`<div class="spread" style="padding:.4rem 0;border-bottom:1px solid var(--rule)">
        <b>${EXAMS[x].short}</b>
        <span class="row">${EXAMS[x].sections.map((s) => html`<button class="btn sm" @click=${() => sectional(x, s.subject)}>${SUBJECTS[s.subject].short}, ${s.minutes} min</button>`)}</span>
      </div>`)}
    </div>

    ${(() => {
      const open = missed.filter((d) => app.mocks.get(dailyKey('pre', d))?.status !== 'submitted');
      return open.length ? html`<h2 style="margin-top:1.5rem">Missed papers</h2>
        <div class="paper" style="padding:.3rem 1rem">${open.map((d) => html`<div class="spread" style="padding:.45rem 0;border-bottom:1px solid var(--rule)">
          <span>Tier 1 paper of ${niceDate(d)}</span>
          <button class="btn sm" @click=${() => openMock(dailyKey('pre', d), () => buildMock({ exam: 'pre', kind: 'daily', key: dailyKey('pre', d), seed: dailyKey('pre', d) }))}>${app.mocks.get(dailyKey('pre', d))?.status === 'in-progress' ? 'Resume' : 'Take it'}</button></div>`)}</div>` : nothing;
    })()}

    ${past.length ? html`<h2 style="margin-top:1.5rem">History</h2>
      <div class="paper">${past.map((m) => html`<div class="spread" style="padding:.45rem 0;border-bottom:1px solid var(--rule)">
        <span><b>${EXAMS[m.exam].short}</b> ${m.title ? m.title : m.kind === 'sectional' ? html`${SUBJECTS[m.sections[0]?.subject]?.short} sectional` : html`daily paper`} <span class="small muted">${niceDate(m.startedAt ?? m.updatedAt)}</span></span>
        <span class="row">
          ${m.status === 'submitted' ? html`<a class="btn sm" href="#/result/${encodeURIComponent(m.key)}">${m.score!.total.toFixed(1).replace(/\.0$/, '')}/${m.score!.max}</a>`
            : html`<a class="btn sm" href="#/exam/${encodeURIComponent(m.key)}">${m.status === 'in-progress' ? 'Resume' : 'Start'}</a>`}
          ${m.status !== 'submitted' ? html`<button class="btn sm ghost" aria-label="Delete" @click=${async () => { if (await confirmDialog('Delete this unfinished mock?', 'Delete')) { await app.deleteMock(m.key); dispatch(); } }}>✕</button>` : nothing}
        </span></div>`)}</div>` : nothing}
  </div>`, el);
}
