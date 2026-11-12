import { html, render, nothing } from 'lit-html';
import { LEVELS, SUBJECTS, TOPIC_MAP } from '../core/syllabus';
import type { Level, Question } from '../core/types';
import { app } from '../app/state';
import { go, setTitle } from '../app/router';
import { session } from '../app/session';
import { loadTopic, typesOf } from '../content/bank';
import { loadPyqTopic, pyqCount } from '../content/pyq';
import { isImp, weightText } from '../ui/components';
import { img, pct, rich } from '../ui/html';

export default async function topicView(el: HTMLElement, [id, tabArg]: string[]) {
  const t = TOPIC_MAP[id];
  if (!t) { render(html`<div class="page"><h1>Unknown topic</h1><a class="btn" href="#/syllabus">Back</a></div>`, el); return; }
  const tab = ['learn', 'practice', 'formulas'].includes(tabArg) ? tabArg : 'learn';
  setTitle(t.name);
  render(html`<div class="page"><p class="muted">Loading…</p></div>`, el);
  const c = await loadTopic(id);
  let pyq: Question[] = [];
  let pyqLoading = false;
  const s = app.stats[id];
  let level: Level | 0 = 0;
  let mode: 'learn' | 'test' = 'learn';
  let n = 10;

  const start = (type?: string) => {
    session.practice = { topic: id, level, type, mode, n };
    go('#/practice');
  };

  const learn = () => !c ? html`<div class="paper"><p>Notes for this topic haven't been written yet.</p></div>` : html`
    <article class="paper ruled notes">
      <p class="lead">${rich(c.notes.summary)}</p>
      ${c.notes.concepts.map((k) => html`<section class="concept"><h2>${k.title}</h2>${rich(k.body)}${img(k.img, k.title)}</section>`)}
      ${c.notes.varieties.length ? html`<h2>Question types</h2>
        ${c.notes.varieties.map((v) => html`<div class="variety">
          <div class="spread"><h3>${v.name}</h3><button class="btn sm" @click=${() => start(v.type)}>Practise this type</button></div>
          <div>${rich(v.how)}</div>
          <p><b>Example.</b> ${rich(v.example.q)}</p>${img(v.example.img)}
          <ol>${v.example.steps.map((st) => html`<li>${rich(st)}</li>`)}</ol>
          <p><b>Answer:</b> ${rich(v.example.answer)}</p>
        </div>`)}` : nothing}
      ${c.notes.tips.length ? html`<h2>Exam tips</h2>${c.notes.tips.map((x) => html`<div class="tip">${rich(x)}</div>`)}` : nothing}
      ${c.notes.traps.length ? html`<h2>Traps</h2>${c.notes.traps.map((x) => html`<div class="trap">${rich(x)}</div>`)}` : nothing}
    </article>`;

  const practice = () => {
    // past-paper questions for this topic load the first time the Practice tab is opened
    if (pyqCount(id) && !pyq.length && !pyqLoading) {
      pyqLoading = true;
      loadPyqTopic(id).then((qs) => { pyq = qs; draw(); }).catch(() => { pyqLoading = false; });
    }
    const types = typesOf(id, pyq);
    return html`<div class="paper stack">
      <div><div class="kicker">Level</div>
        <div class="seg">${[{ id: 0, name: 'Mixed' }, ...LEVELS].map((l) => html`<button class=${level === l.id ? 'on' : ''} @click=${() => { level = l.id as Level | 0; draw(); }}>${l.name}</button>`)}</div></div>
      <div><div class="kicker">Mode</div>
        <div class="seg"><button class=${mode === 'learn' ? 'on' : ''} @click=${() => { mode = 'learn'; draw(); }}>Learn (solution after each)</button>
        <button class=${mode === 'test' ? 'on' : ''} @click=${() => { mode = 'test'; draw(); }}>Test (timed)</button></div></div>
      <div><div class="kicker">Questions</div>
        <div class="seg">${[5, 10, 20].map((k) => html`<button class=${n === k ? 'on' : ''} @click=${() => { n = k; draw(); }}>${k}</button>`)}</div></div>
      <button class="btn primary" @click=${() => start()}>Start practice</button>
      ${types.length ? html`<h2>By question type</h2>
        ${types.map((ty) => {
          const st = s?.byType[ty.type];
          return html`<div class="spread" style="border-bottom:1px solid var(--rule);padding:.5rem 0">
            <span><b>${ty.name}</b> <span class="small muted">${ty.pyq + ty.curated} questions${ty.generated ? ', plus unlimited new ones' : ''}${st ? `. You got ${pct(st.correct / st.attempts)} of ${st.attempts} right` : ''}</span></span>
            <button class="btn sm" ?disabled=${!ty.curated && !ty.generated && !ty.pyq} @click=${() => start(ty.type)}>Practise</button></div>`;
        })}` : nothing}
    </div>`;
  };

  const formulas = () => html`${c?.formulas?.length ? html`<p><a class="btn sm" href="#/formulas/${id}">Open printable sheet</a></p>` : nothing}<div class="paper">
    ${c?.formulas?.length ? c.formulas.map((f) => html`<div class="formula"><span>${f.name}</span><code>${rich(f.expr)}</code></div>`) : html`<p class="muted">No formula sheet for this topic.</p>`}
  </div>`;

  const draw = () => render(html`<div class="page">
    <p class="small"><a href="#/syllabus/${t.subject}">${SUBJECTS[t.subject].name}</a>, ${t.section}</p>
    <h1>${t.name}</h1>
    <p class="muted" style="margin:-.2rem 0 1rem">${isImp(t, app.settings.target) ? html`<span class="hand">IMP</span> ` : nothing}${weightText(t, app.settings.target)}.${s ? html` You've answered ${s.attempts}, ${pct(s.accuracy)} correct, about ${Math.round(s.avgSec)} seconds each.` : nothing}</p>
    <nav class="tabs">
      <a href="#/topic/${id}/learn" class=${tab === 'learn' ? 'on' : ''}>Learn</a>
      <a href="#/topic/${id}/practice" class=${tab === 'practice' ? 'on' : ''}>Practice</a>
      <a href="#/topic/${id}/formulas" class=${tab === 'formulas' ? 'on' : ''}>Formulas</a>
    </nav>
    ${tab === 'learn' ? learn() : tab === 'practice' ? practice() : formulas()}
  </div>`, el);
  draw();
}
