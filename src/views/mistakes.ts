import { html, render, nothing } from 'lit-html';
import { SUBJECTS, SUBJECT_ORDER, TOPIC_MAP } from '../core/syllabus';
import { mistakes } from '../core/mistakes';
import type { SubjectId } from '../core/types';
import { app } from '../app/state';
import { session } from '../app/session';
import { go } from '../app/router';
import { ensureQuestions, lookup } from '../content/bank';
import { dot } from '../ui/components';
import { niceDate, rich } from '../ui/html';
import { progressTabs } from './analysis';

export default async function mistakesView(el: HTMLElement) {
  const everything = mistakes(app.attempts);
  const wrongOnes = everything.filter((m) => !m.skipped);
  const skippedOnes = everything.filter((m) => m.skipped);
  // wrong answers by default; skipped questions are a separate list, not part of the headline count
  let kind: 'wrong' | 'skipped' = wrongOnes.length || !skippedOnes.length ? 'wrong' : 'skipped';
  let subject: SubjectId | 'all' = 'all';
  let shown = 30;
  render(html`<div class="page"><p class="muted">Loading your mistakes…</p></div>`, el);
  await ensureQuestions(everything.map((m) => m.questionId));

  const retry = (ids: string[]) => {
    session.practice = { topic: everything.find((m) => m.questionId === ids[0])?.topic ?? 'q-percentage', level: 0, mode: 'learn', n: ids.length, questionIds: ids, title: kind === 'skipped' ? 'Try skipped questions' : 'Retry my mistakes' };
    go('#/practice');
  };

  const draw = () => {
    const all = kind === 'wrong' ? wrongOnes : skippedOnes;
    const list = all.filter((m) => subject === 'all' || TOPIC_MAP[m.topic]?.subject === subject);
    const counts = new Map<SubjectId, number>();
    all.forEach((m) => { const s = TOPIC_MAP[m.topic]?.subject; if (s) counts.set(s, (counts.get(s) ?? 0) + 1); });
    render(html`<div class="page">
      <h1>Progress</h1>
      ${progressTabs('mistakes')}
      ${skippedOnes.length ? html`<div class="seg" style="margin-bottom:1rem">
        <button class=${kind === 'wrong' ? 'on' : ''} @click=${() => { kind = 'wrong'; subject = 'all'; shown = 30; draw(); }}>Wrong answers (${wrongOnes.length})</button>
        <button class=${kind === 'skipped' ? 'on' : ''} @click=${() => { kind = 'skipped'; subject = 'all'; shown = 30; draw(); }}>Skipped (${skippedOnes.length})</button>
      </div>` : nothing}
      ${!all.length ? html`<div class="paper"><h2>No wrong answers to fix</h2><p>Questions you answer wrongly in practice and mocks collect here. Answer one correctly and it disappears.${skippedOnes.length ? ' Questions you skipped are under Skipped.' : ''}</p><a class="btn primary" href="#/study">Practise a topic</a></div>` : html`
        <div class="spread" style="margin-bottom:.8rem">
          <p class="muted" style="margin:0">${kind === 'wrong'
            ? html`<b>${all.length}</b> question${all.length === 1 ? '' : 's'} you got wrong. Get one right and it leaves this list.`
            : html`<b>${all.length}</b> question${all.length === 1 ? '' : 's'} you skipped. Answer one correctly and it leaves this list.`}</p>
          <button class="btn primary" @click=${() => retry(list.slice(0, 10).map((m) => m.questionId))}>Retry ${Math.min(10, list.length)} now</button>
        </div>
        <div class="chips-row" role="tablist">
          <button class="chip-btn ${subject === 'all' ? 'on' : ''}" @click=${() => { subject = 'all'; draw(); }}>All ${all.length}</button>
          ${SUBJECT_ORDER.filter((s) => counts.get(s)).map((s) => html`<button class="chip-btn ${subject === s ? 'on' : ''}" @click=${() => { subject = s; draw(); }}>${dot(s)} ${SUBJECTS[s].short} ${counts.get(s)}</button>`)}
        </div>
        <div class="stack">
          ${list.slice(0, shown).map((m) => {
            const q = lookup(m.questionId);
            const t = TOPIC_MAP[m.topic];
            return html`<button class="mistake card" @click=${() => retry([m.questionId])}>
              <div class="small muted">${t ? t.name : m.topic}, ${m.skipped ? 'skipped' : 'wrong'}${!m.skipped && m.wrongCount > 1 ? ` ${m.wrongCount} times` : ''}, ${niceDate(m.lastAt)}</div>
              <div class="mistake-q">${q ? rich(q.q.replace(/<div class="fig">[\s\S]*?<\/div>/g, '[figure]')) : 'Question unavailable'}</div>
            </button>`;
          })}
        </div>
        ${list.length > shown ? html`<button class="btn" style="margin-top:1rem" @click=${() => { shown += 30; draw(); }}>Show more</button>` : nothing}`}
    </div>`, el);
  };
  draw();
}
