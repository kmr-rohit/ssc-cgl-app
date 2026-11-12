import { html, render, nothing } from 'lit-html';
import { TOPIC_MAP } from '../core/syllabus';
import { TARGET_SEC } from '../core/analysis';
import type { Attempt, Question } from '../core/types';
import { app } from '../app/state';
import { session } from '../app/session';
import { setTitle } from '../app/router';
import { ensureQuestions, lookup, practiceSet } from '../content/bank';
import { uid } from '../data/storage';
import { questionView, stamp } from '../ui/components';
import { fmtMs, pct } from '../ui/html';

export default async function practice(el: HTMLElement) {
  const cfg = session.practice;
  if (!cfg) { location.hash = '#/syllabus'; return; }
  const t = TOPIC_MAP[cfg.topic];
  setTitle(cfg.title ?? t?.name ?? 'Practice');
  render(html`<div class="page"><p class="muted">Preparing questions…</p></div>`, el);

  let qs: Question[];
  if (cfg.questionIds) {
    await ensureQuestions(cfg.questionIds);
    qs = cfg.questionIds.map(lookup).filter((q): q is Question => !!q);
  } else {
    qs = await practiceSet(cfg.topic, { level: cfg.level, type: cfg.type, n: cfg.n, seed: `p-${Date.now()}` });
  }
  if (!qs.length) {
    render(html`<div class="page"><h1>No questions yet</h1><p class="muted">There are no questions for this selection.</p><a class="btn" href="#/topic/${cfg.topic}/practice">Back</a></div>`, el);
    return;
  }

  const answers: (number | null)[] = qs.map(() => null);
  const ms: number[] = qs.map(() => 0);
  const revealed: boolean[] = qs.map(() => false);
  let i = 0;
  let shownAt = performance.now();
  let finished = false;
  const totalMs = qs.reduce((a, q) => a + TARGET_SEC[TOPIC_MAP[q.topic]?.subject ?? 'quant'] * 1000, 0);
  const startedAt = performance.now();
  let timer = 0;

  const stamp_ = () => { ms[i] += performance.now() - shownAt; shownAt = performance.now(); };
  const attemptOf = (k: number): Attempt => ({
    id: uid(), questionId: qs[k].id, rev: qs[k].rev, topic: qs[k].topic, type: qs[k].type, level: qs[k].level,
    chosen: answers[k], correct: answers[k] === qs[k].answer, ms: Math.round(ms[k]), mode: cfg.mode, at: new Date().toISOString(),
  });

  const pick = (k: number) => {
    if (finished || revealed[i]) return;
    answers[i] = k;
    if (cfg.mode === 'learn') {
      stamp_();
      revealed[i] = true;
      app.addAttempts([attemptOf(i)]);
    }
    draw();
  };
  const move = (d: number) => {
    stamp_();
    i = Math.min(qs.length - 1, Math.max(0, i + d));
    draw();
  };
  const finish = () => {
    if (finished) return;
    stamp_();
    finished = true;
    clearInterval(timer);
    if (cfg.mode === 'test') app.addAttempts(qs.map((_, k) => attemptOf(k)));
    else {
      // skipped questions in learn mode still count as seen
      const skipped = qs.map((_, k) => k).filter((k) => !revealed[k]);
      app.addAttempts(skipped.map(attemptOf));
    }
    draw();
  };

  const results = () => {
    const correct = qs.filter((q, k) => answers[k] === q.answer).length;
    const wrong = qs.filter((_, k) => answers[k] !== null && answers[k] !== qs[k].answer).length;
    const time = ms.reduce((a, b) => a + b, 0);
    return html`<div class="page">
      <div class="kicker">${t?.name ?? 'Practice'} results</div>
      <h1>${correct} / ${qs.length} correct</h1>
      <div class="grid" style="margin-bottom:1rem">
        <div class="card"><div class="kicker">Accuracy</div><div class="big">${pct(correct + wrong ? correct / (correct + wrong) : 0)}</div></div>
        <div class="card"><div class="kicker">Time</div><div class="big">${fmtMs(time)}</div><div class="small muted">${Math.round(time / 1000 / qs.length)}s per question (target ${Math.round(totalMs / 1000 / qs.length)}s)</div></div>
        <div class="card"><div class="kicker">Wrong / skipped</div><div class="big">${wrong} / ${qs.length - correct - wrong}</div></div>
      </div>
      <div class="row" style="margin-bottom:1.5rem">
        <button class="btn primary" @click=${() => { session.practice = { ...cfg, questionIds: undefined }; practice(el); }}>New set</button>
        ${correct < qs.length ? html`<button class="btn" @click=${() => { session.practice = { ...cfg, mode: 'learn', questionIds: qs.filter((q, k) => answers[k] !== q.answer).map((q) => q.id) }; practice(el); }}>Retry wrong & skipped</button>` : nothing}
        <a class="btn ghost" href="#/topic/${cfg.topic}/learn">Back to notes</a>
      </div>
      <h2>Review</h2>
      ${qs.map((q, k) => html`<section class="paper" style="margin-bottom:1rem">${questionView(q, { chosen: answers[k], reveal: true, head: html`<div class="q-head"><span>Q${k + 1}</span><span>${Math.round(ms[k] / 1000)}s</span></div>` })}</section>`)}
    </div>`;
  };

  const draw = () => {
    if (finished) { render(results(), el); return; }
    const q = qs[i];
    const left = totalMs - (performance.now() - startedAt);
    render(html`<div class="page" style="max-width:820px">
      <div class="spread" style="margin-bottom:.6rem">
        <div><div class="kicker">${cfg.mode === 'learn' ? 'Learn mode: the answer shows after each question' : 'Test mode: timed, answers at the end'}</div>
          <div class="small muted">Question ${i + 1} of ${qs.length}</div></div>
        ${cfg.mode === 'test' ? html`<div class="chip" aria-live="off">⏱ ${fmtMs(left)}</div>` : nothing}
      </div>
      <section class="paper">
        ${questionView(q, { chosen: answers[i], reveal: revealed[i], onPick: pick,
          head: html`<div class="q-head"><span>Level ${q.level}, ${q.type.replace(/-/g, ' ')}</span>${revealed[i] ? stamp(answers[i] === q.answer ? 'ok' : 'no') : nothing}</div>` })}
        <div class="exam-actions">
          <button class="btn" ?disabled=${i === 0} @click=${() => move(-1)}>Previous</button>
          ${i < qs.length - 1
            ? html`<button class="btn primary" @click=${() => move(1)}>${answers[i] === null && !revealed[i] ? 'Skip' : 'Next'}</button>`
            : html`<button class="btn primary" @click=${finish}>Finish</button>`}
        </div>
      </section>
      <p class="small muted" style="margin-top:.8rem">Keys: 1–4 or A–D to answer, ← → to move.</p>
    </div>`, el);
  };

  const onKey = (e: KeyboardEvent) => {
    if (finished || (e.target as HTMLElement).closest('input,textarea')) return;
    const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0 && e.key.length === 1) pick(k);
    else if (e.key === 'ArrowRight') { if (i < qs.length - 1) move(1); }
    else if (e.key === 'ArrowLeft') move(-1);
  };
  document.addEventListener('keydown', onKey);
  if (cfg.mode === 'test') timer = window.setInterval(() => { if (performance.now() - startedAt >= totalMs) finish(); else draw(); }, 1000);
  draw();
  return () => { document.removeEventListener('keydown', onKey); clearInterval(timer); };
}
