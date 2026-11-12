import { html, render, nothing } from 'lit-html';
import { EXAMS, SUBJECTS, TOPIC_MAP } from '../core/syllabus';
import { accuracy, isQualifying } from '../core/scoring';
import { app } from '../app/state';
import { session } from '../app/session';
import { go } from '../app/router';
import { hydrateMock, lookup } from '../content/bank';
import { dot, questionView } from '../ui/components';
import { fmtMs, pct } from '../ui/html';
import { challengePanel, hydrateChallengePanel } from './challenge';

export default async function result(el: HTMLElement, [key]: string[]) {
  const m = app.mocks.get(key);
  if (!m?.score) { render(html`<div class="page"><h1>No result</h1><a class="btn" href="#/mocks">Back</a></div>`, el); return; }
  await hydrateMock(m);
  const e = { ...EXAMS[m.exam], ...(m.rules ? { marks: m.rules.marks, negative: m.rules.negative } : {}) };
  const sc = m.score;
  let filter: 'all' | 'wrong' | 'skipped' | 'marked' = 'wrong';
  let secIdx = 0;

  // per-topic breakdown inside this mock
  const byTopic = new Map<string, { c: number; w: number; s: number }>();
  // qualifying sections are not in the total, so they are left out of the marks-lost figures too
  m.sections.filter((s) => !isQualifying(m.exam, s.subject, m.rules)).forEach((s) => s.questionIds.forEach((id, i) => {
    const q = lookup(id); if (!q) return;
    const r = byTopic.get(q.topic) ?? { c: 0, w: 0, s: 0 };
    const a = s.answers[i];
    if (a === null) r.s++; else if (a === q.answer) r.c++; else r.w++;
    byTopic.set(q.topic, r);
  }));
  const lostTopics = [...byTopic.entries()].map(([t, r]) => ({ t, r, lost: r.w * (e.marks + e.negative) + r.s * e.marks }))
    .filter((x) => x.lost > 0).sort((a, b) => b.lost - a.lost).slice(0, 6);
  const wrongTotal = sc.sections.filter((s) => !isQualifying(m.exam, s.subject, m.rules)).reduce((a, s) => a + s.wrong, 0);

  const retry = (kind: 'wrong' | 'all') => {
    const ids = m.sections.flatMap((s) => s.questionIds.filter((id, i) => kind === 'all' || s.answers[i] === null || s.answers[i] !== lookup(id)?.answer));
    session.practice = { topic: lookup(ids[0])?.topic ?? 'q-percentage', level: 0, mode: 'learn', n: ids.length, questionIds: ids, title: 'Retry from mock' };
    go('#/practice');
  };

  const draw = () => {
    const s = m.sections[secIdx];
    const items = s.questionIds.map((id, i) => ({ id, i, q: lookup(id), a: s.answers[i] }))
      .filter((x) => x.q && (filter === 'all' || (filter === 'wrong' && x.a !== null && x.a !== x.q.answer) || (filter === 'skipped' && x.a === null) || (filter === 'marked' && s.marked[x.i])));
    render(html`<div class="page">
      <div class="kicker">${m.title ?? e.name}, ${new Date(m.submittedAt!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      <h1><span class="hl">${sc.total.toFixed(1).replace(/\.0$/, '')}</span> / ${sc.max}</h1>
      <div class="grid" style="margin-bottom:1rem">
        ${sc.sections.map((x) => html`<div class="card">
          <div class="kicker">${dot(x.subject)} ${SUBJECTS[x.subject].short}${isQualifying(m.exam, x.subject, m.rules) ? ' (qualifying)' : ''}</div>
          <div class="big">${x.score.toFixed(1).replace(/\.0$/, '')}<span class="small muted"> / ${x.max}</span></div>
          <div class="small">${x.correct} right, ${x.wrong} wrong, ${x.skipped} skipped. Accuracy ${pct(accuracy(x.correct, x.wrong))}</div>
          <div class="small muted">Time used ${fmtMs(m.sections.find((y) => y.subject === x.subject)!.msSpent.reduce((a, b) => a + b, 0))}</div>
        </div>`)}
      </div>
      ${m.integrity && (m.integrity.leaves || m.integrity.fsExits) ? html`<p class="trap"><b>Exam discipline:</b> left the test ${m.integrity.leaves} time${m.integrity.leaves === 1 ? '' : 's'} (${Math.round(m.integrity.awayMs / 1000)}s away)${m.integrity.fsExits ? `, exited full screen ${m.integrity.fsExits} time${m.integrity.fsExits === 1 ? '' : 's'}` : ''}. In the real CBT this isn't possible, so practise staying on the screen.</p>`
        : m.integrity ? html`<p class="tip">Exam discipline: you stayed on the test the whole time.</p>` : nothing}
      ${wrongTotal && e.negative ? html`<p class="trap">Negative marking cost you <b>${(wrongTotal * e.negative).toFixed(1)}</b> marks (${wrongTotal} wrong answers).</p>` : nothing}
      ${lostTopics.length ? html`<section class="paper" style="margin:1rem 0"><h2>Where the marks went</h2>
        ${lostTopics.map((x) => html`<div class="spread" style="padding:.35rem 0;border-bottom:1px solid var(--rule)">
          <a href="#/topic/${x.t}/learn">${TOPIC_MAP[x.t]?.name ?? x.t}</a>
          <span class="small">${x.r.w} wrong, ${x.r.s} skipped, <b>${x.lost.toFixed(1).replace(/\.0$/, '')}</b> marks missed</span></div>`)}</section>` : nothing}
      <div class="row" style="margin-bottom:1.5rem">
        <button class="btn primary" @click=${() => retry('wrong')}>Retry wrong & skipped</button>
        <a class="btn" href="#/analysis">Full analysis</a>
        <a class="btn ghost" href="#/mocks">All mocks</a>
      </div>
      ${challengePanel(m, () => { draw(); hydrateChallengePanel(el, m); })}
      <h2>Review answers</h2>
      <nav class="tabs">${m.sections.map((x, k) => html`<button class=${k === secIdx ? 'on' : ''} @click=${() => { secIdx = k; draw(); }}>${SUBJECTS[x.subject].short}</button>`)}</nav>
      <div class="seg" style="margin-bottom:1rem">${(['wrong', 'skipped', 'marked', 'all'] as const).map((f) => html`<button class=${filter === f ? 'on' : ''} @click=${() => { filter = f; draw(); }}>${f[0].toUpperCase() + f.slice(1)}</button>`)}</div>
      ${items.length ? items.map((x) => html`<section class="paper" style="margin-bottom:1rem">
        ${questionView(x.q!, { chosen: x.a, reveal: true, head: html`<div class="q-head"><span>Q${x.i + 1}, ${TOPIC_MAP[x.q!.topic]?.name}</span><span>${Math.round(s.msSpent[x.i] / 1000)}s</span></div>` })}</section>`)
        : html`<p class="muted">Nothing to show for this filter.</p>`}
    </div>`, el);
  };
  draw();
  hydrateChallengePanel(el, m);
}
