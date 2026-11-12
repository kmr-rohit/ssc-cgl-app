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

  // a question type is offered only when it has curated, past-paper or generated questions
  const hasQuestions = (ty: { curated: number; pyq: number; generated: boolean }) => ty.curated + ty.pyq > 0 || ty.generated;
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
  const pyqKnown = () => !pyqCount(id) || pyq.length > 0;
  const loadPyq = () => {
    if (pyqCount(id) && !pyq.length && !pyqLoading) {
      pyqLoading = true;
      loadPyqTopic(id).then((qs) => { pyq = qs; draw(); }).catch(() => { pyqLoading = false; });
    }
  };
  // "On this page": in-page jumps. Plain #anchors would change the route, so scroll instead.
  const jump = (e: Event, anchor: string) => {
    e.preventDefault();
    el.querySelector(`#${anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const learn = () => {
    if (!c) return html`<div class="paper"><p>Notes for this topic haven't been written yet.</p><button class="btn primary" @click=${() => go(`#/topic/${id}/practice`)}>Practise this topic</button></div>`;
    const types = new Map(typesOf(id, pyq).map((ty) => [ty.type, ty]));
    // a type with no curated or generated questions may still have past-paper ones; find out in the background
    if (c.notes.varieties.some((v) => { const ty = types.get(v.type); return ty && !ty.curated && !ty.generated; })) loadPyq();
    const canPractise = (type: string) => { const ty = types.get(type); return !!ty && (hasQuestions(ty) || !pyqKnown()); };
    const toc = [
      ...c.notes.concepts.map((k, i) => ({ anchor: `concept-${i}`, title: k.title })),
      ...(c.notes.varieties.length ? [{ anchor: 'question-types', title: 'Question types' }] : []),
      ...(c.notes.tips.length ? [{ anchor: 'exam-tips', title: 'Exam tips' }] : []),
      ...(c.notes.traps.length ? [{ anchor: 'traps', title: 'Traps' }] : []),
    ];
    return html`
    <article class="paper ruled notes">
      <p class="lead">${rich(c.notes.summary)}</p>
      ${toc.length > 2 ? html`<nav class="on-this-page" aria-label="On this page"><h2>On this page</h2>
        <ol>${toc.map((x) => html`<li><a href="#/topic/${id}/learn" @click=${(e: Event) => jump(e, x.anchor)}>${x.title}</a></li>`)}</ol></nav>` : nothing}
      ${c.notes.concepts.map((k, i) => html`<section class="concept" id="concept-${i}"><h2>${k.title}</h2>${rich(k.body)}${img(k.img, k.title)}</section>`)}
      ${c.notes.varieties.length ? html`<h2 id="question-types">Question types</h2>
        ${c.notes.varieties.map((v) => html`<div class="variety">
          <div class="spread"><h3>${v.name}</h3>${canPractise(v.type) ? html`<button class="btn sm" @click=${() => start(v.type)}>Practise this type</button>` : nothing}</div>
          <div>${rich(v.how)}</div>
          <p><b>Example.</b> ${rich(v.example.q)}</p>${img(v.example.img)}
          <ol>${v.example.steps.map((st) => html`<li>${rich(st)}</li>`)}</ol>
          <p><b>Answer:</b> ${rich(v.example.answer)}</p>
        </div>`)}` : nothing}
      ${c.notes.tips.length ? html`<h2 id="exam-tips">Exam tips</h2>${c.notes.tips.map((x) => html`<div class="tip">${rich(x)}</div>`)}` : nothing}
      ${c.notes.traps.length ? html`<h2 id="traps">Traps</h2>${c.notes.traps.map((x) => html`<div class="trap">${rich(x)}</div>`)}` : nothing}
      <div class="notes-end">
        <p>Read it all? Try 10 questions now. The solution shows after each one.</p>
        <button class="btn primary" @click=${() => { level = 0; mode = 'learn'; n = 10; start(); }}>Practise this topic</button>
      </div>
    </article>`;
  };

  const practice = () => {
    // past-paper questions for this topic load the first time the Practice tab is opened
    loadPyq();
    const types = typesOf(id, pyq).filter(hasQuestions);
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
            <span><b>${ty.name}</b> <span class="small muted">${ty.pyq + ty.curated ? `${plural(ty.pyq + ty.curated, 'question')}${ty.generated ? ', plus unlimited new ones' : ''}` : 'Unlimited new questions'}${st?.attempts ? `. You got ${st.correct} of ${st.attempts} right` : ''}</span></span>
            <button class="btn sm" @click=${() => start(ty.type)}>Practise</button></div>`;
        })}` : nothing}
    </div>`;
  };

  const formulas = () => html`${c?.formulas?.length ? html`<p><a class="btn sm" href="#/formulas/${id}">Open printable sheet</a></p>` : nothing}<div class="paper">
    ${c?.formulas?.length ? c.formulas.map((f) => html`<div class="formula"><span>${f.name}</span><code>${rich(f.expr)}</code></div>`) : html`<p class="muted">No formula sheet for this topic.</p>`}
  </div>`;

  const draw = () => render(html`<div class="page">
    <p class="small"><a href="#/syllabus/${t.subject}">${SUBJECTS[t.subject].name}</a>, ${t.section}</p>
    <h1>${t.name}</h1>
    <p class="muted" style="margin:-.2rem 0 1rem">${isImp(t, app.settings.target) ? html`<span class="hand">IMP</span> ` : nothing}${weightText(t, app.settings.target)}.${s?.attempts ? html` You've answered ${s.attempts}, ${pct(s.accuracy)} correct, about ${Math.round(s.avgSec)} seconds each.` : nothing}</p>
    <nav class="tabs">
      <a href="#/topic/${id}/learn" class=${tab === 'learn' ? 'on' : ''}>Learn</a>
      <a href="#/topic/${id}/practice" class=${tab === 'practice' ? 'on' : ''}>Practice</a>
      <a href="#/topic/${id}/formulas" class=${tab === 'formulas' ? 'on' : ''}>Formulas</a>
    </nav>
    ${tab === 'learn' ? learn() : tab === 'practice' ? practice() : formulas()}
  </div>`, el);
  draw();
}
