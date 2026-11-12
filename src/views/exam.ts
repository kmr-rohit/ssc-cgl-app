// SSC-style test screen: sectional timers, question palette, mark for review, pause & resume.
import { html, render, nothing } from 'lit-html';
import { EXAMS, SUBJECTS } from '../core/syllabus';
import { scoreSections } from '../core/scoring';
import type { Attempt, MockRecord } from '../core/types';
import { app } from '../app/state';
import { go, toast } from '../app/router';
import { hydrateMock, lookup } from '../content/bank';
import { uid } from '../data/storage';
import { confirmDialog, dot, questionView } from '../ui/components';
import { fmtMs } from '../ui/html';

function enterFullscreen() {
  // must run inside the click handler (user gesture); unsupported on iPhone Safari, which is fine
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}

export async function submitMock(m: MockRecord) {
  m.sections.forEach((s) => (s.done = true));
  m.status = 'submitted';
  m.submittedAt = new Date().toISOString();
  m.score = scoreSections(m.exam, m.sections, lookup);
  const at = m.submittedAt;
  const attempts: Attempt[] = m.sections.flatMap((s) => s.questionIds.map((id, i): Attempt | null => {
    const q = lookup(id);
    return q ? {
      id: uid(), questionId: id, rev: q.rev, topic: q.topic, type: q.type, level: q.level, chosen: s.answers[i],
      correct: s.answers[i] === q.answer, ms: Math.round(s.msSpent[i]), mode: 'mock', mockKey: m.key, at,
    } : null;
  }).filter((x): x is Attempt => !!x));
  await app.saveMock(m);
  await app.addAttempts(attempts);
}

export default async function exam(el: HTMLElement, [key]: string[]) {
  const found = app.mocks.get(key);
  if (!found) { render(html`<div class="page"><h1>Mock not found</h1><a class="btn" href="#/mocks">Back to mocks</a></div>`, el); return; }
  const m: MockRecord = found;
  if (m.status === 'submitted') { go(`#/result/${encodeURIComponent(key)}`); return; }
  render(html`<div class="page"><p class="muted">Loading paper…</p></div>`, el);
  await hydrateMock(m);
  const e = EXAMS[m.exam];

  // ---------------------------------------------------------------- instructions
  if (m.status === 'not-started') {
    await new Promise<void>((resolve) => render(html`<div class="page" style="max-width:720px">
      <div class="ticket">
        <div class="kicker">Admit card · ${m.kind === 'daily' ? 'Daily mock' : 'Sectional test'}</div>
        <h1>${e.name}</h1>
        <dl>
          <dt>Sections</dt><dd>${m.sections.map((s) => html`${dot(s.subject)} ${SUBJECTS[s.subject].short} (${s.questionIds.length}) `)}</dd>
          <dt>Time</dt><dd>${m.sections.map((s) => `${Math.round(s.remainingMs / 60000)} min`).join(' + ')}</dd>
          <dt>Marking</dt><dd>+${e.marks} for correct, −${e.negative} for wrong, 0 for skipped</dd>
        </dl>
        <ul class="small">
          <li>Each section has its own timer. When it runs out, the next section starts automatically. You cannot return to a finished section.</li>
          <li>Palette colours: grey = not visited, red = not answered, green = answered, purple = marked for review.</li>
          <li>Questions marked for review <b>with</b> an answer are evaluated.</li>
          <li>You can pause; the timer stops and you resume from the same question.</li>
        </ul>
        ${m.sections.some((s) => s.questionIds.length < (e.sections.find((x) => x.subject === s.subject)?.count ?? 0))
          ? html`<p class="chip medium">Test data is limited: some sections have fewer questions than the real paper.</p>` : nothing}
        ${app.settings.examMode ? html`<p class="small"><b>Exam mode is on:</b> the test opens full screen. Leaving the tab or full screen is counted and shown in your result. The timer keeps running while you are away.</p>` : nothing}
        <div class="row"><button class="btn primary" @click=${() => { if (app.settings.examMode) enterFullscreen(); resolve(); }}>I am ready to begin</button><a class="btn ghost" href="#/mocks">Not now</a></div>
      </div></div>`, el));
    m.status = 'in-progress';
    m.startedAt = new Date().toISOString();
    await app.saveMock(m);
  }

  // ---------------------------------------------------------------- live
  document.body.dataset.route = 'exam-live';
  const examMode = app.settings.examMode;
  m.integrity ??= { leaves: 0, awayMs: 0, fsExits: 0 };
  let leftAt = 0;
  let warning: string | null = null;
  let palOpen = false;
  let last = performance.now();
  let dirty = false;
  const sec = () => m.sections[m.current.section];

  const tick = () => {
    const now = performance.now();
    const d = now - last; last = now;
    const s = sec();
    s.remainingMs -= d;
    s.msSpent[m.current.index] += d;
    if (s.remainingMs <= 0) { s.remainingMs = 0; endSection(true); return; }
    draw();
  };
  const save = () => { dirty = false; app.saveMock(m); };
  const visit = (i: number) => { m.current.index = i; sec().visited[i] = true; dirty = true; palOpen = false; draw(); };

  async function endSection(auto: boolean) {
    const s = sec();
    s.done = true;
    if (m.current.section < m.sections.length - 1) {
      m.current = { section: m.current.section + 1, index: 0 };
      palOpen = false;
      sec().visited[0] = true;
      save();
      toast(auto ? 'Time up. Next section started.' : 'Section submitted.');
      draw();
    } else {
      stop();
      await submitMock(m);
      go(`#/result/${encodeURIComponent(m.key)}`);
    }
  }

  const choose = (k: number) => { sec().answers[m.current.index] = k; dirty = true; draw(); };
  const next = () => { if (m.current.index < sec().questionIds.length - 1) visit(m.current.index + 1); else { palOpen = true; draw(); } };
  const saveNext = () => { save(); next(); };
  const markNext = () => { sec().marked[m.current.index] = true; save(); next(); };
  const clear = () => { sec().answers[m.current.index] = null; sec().marked[m.current.index] = false; dirty = true; draw(); };

  const palClass = (i: number) => {
    const s = sec();
    const a = s.answers[i] !== null, mk = s.marked[i];
    return [a && mk ? 'am' : mk ? 'm' : a ? 'a' : s.visited[i] ? 'v' : '', i === m.current.index ? 'cur' : ''].join(' ');
  };

  const draw = () => {
    const s = sec();
    const q = lookup(s.questionIds[m.current.index]);
    const answered = s.answers.filter((x) => x !== null).length;
    render(html`
      ${warning ? html`<div class="exam-warning" role="alert"><span>⚠ ${warning}</span>
        <span class="row">${examMode && !document.fullscreenElement && document.fullscreenEnabled ? html`<button class="btn sm" @click=${() => { enterFullscreen(); warning = null; draw(); }}>Full screen</button>` : nothing}
        <button class="btn sm" @click=${() => { warning = null; draw(); }}>Continue</button></span></div>` : nothing}
      <div class="exam-bar">
        <span><b>${e.short}</b> · ${dot(s.subject)} ${SUBJECTS[s.subject].short} <span class="small">(section ${m.current.section + 1}/${m.sections.length})</span></span>
        <span class="timer ${s.remainingMs < 60000 ? 'low' : ''}" role="timer" aria-label="Time left in section">${fmtMs(s.remainingMs)}</span>
        <span class="row">
          <button class="btn sm pal-toggle" @click=${() => { palOpen = !palOpen; draw(); }}>Palette ${answered}/${s.questionIds.length}</button>
          <button class="btn sm" @click=${pause}>Pause</button>
        </span>
      </div>
      <div class="exam">
        <section class="paper">
          ${q ? questionView(q, { chosen: s.answers[m.current.index], reveal: false, onPick: choose,
            head: html`<div class="q-head"><span>Question ${m.current.index + 1}</span><span>+${e.marks} / −${e.negative}</span></div>` })
            : html`<p class="muted">This question could not be loaded.</p>`}
          <div class="exam-actions">
            <div class="row">
              <button class="btn" @click=${markNext}>Mark for review & next</button>
              <button class="btn ghost" @click=${clear}>Clear response</button>
            </div>
            <div class="row">
              <button class="btn" ?disabled=${m.current.index === 0} @click=${() => visit(m.current.index - 1)}>Previous</button>
              <button class="btn primary" @click=${saveNext}>Save & next</button>
            </div>
          </div>
        </section>
        <aside class="paper palette ${palOpen ? 'open' : ''}" aria-label="Question palette">
          <div class="spread"><h3>${SUBJECTS[s.subject].short}</h3><button class="btn sm pal-toggle" @click=${() => { palOpen = false; draw(); }}>Close</button></div>
          <div class="pal-grid">${s.questionIds.map((_, i) => html`<button class=${palClass(i)} @click=${() => visit(i)} aria-label="Question ${i + 1}">${i + 1}</button>`)}</div>
          <div class="legend">
            <span><i style="background:var(--green)"></i>Answered ${answered}</span>
            <span><i style="background:var(--red-wash);border-color:var(--red)"></i>Not answered ${s.visited.filter((v, i) => v && s.answers[i] === null).length}</span>
            <span><i></i>Not visited ${s.visited.filter((v) => !v).length}</span>
            <span><i style="background:var(--violet)"></i>Marked ${s.marked.filter(Boolean).length}</span>
          </div>
          <button class="btn danger" style="width:100%;margin-top:1rem" @click=${async () => {
            const last = m.current.section === m.sections.length - 1;
            if (await confirmDialog(last ? `Submit the test? ${s.questionIds.length - answered} unanswered in this section.` : `Submit this section? You can't come back to it. ${s.questionIds.length - answered} unanswered.`, last ? 'Submit test' : 'Submit section')) endSection(false);
          }}>${m.current.section === m.sections.length - 1 ? 'Submit test' : 'Submit section'}</button>
        </aside>
      </div>`, el);
  };

  const timer = window.setInterval(tick, 1000);
  const autosave = window.setInterval(() => { if (dirty) save(); else app.saveMock(m); }, 10000);
  const onHide = () => {
    if (document.hidden) { save(); if (examMode) leftAt = Date.now(); return; }
    if (examMode && leftAt) {
      m.integrity!.leaves++; m.integrity!.awayMs += Date.now() - leftAt; leftAt = 0;
      warning = `You left the test (${m.integrity!.leaves} time${m.integrity!.leaves === 1 ? '' : 's'}). The timer kept running. In the real CBT you cannot leave the screen.`;
      save(); draw();
    }
  };
  const onFs = () => {
    if (!examMode || document.fullscreenElement) return;
    m.integrity!.fsExits++;
    warning = 'You left full screen. Return to full screen to continue like the real exam.';
    save(); draw();
  };
  if (examMode) document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('visibilitychange', onHide);
  function stop() {
    clearInterval(timer); clearInterval(autosave);
    document.removeEventListener('visibilitychange', onHide);
    document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  async function pause() { stop(); await app.saveMock(m); toast('Paused. Resume from the Mocks page.'); go('#/mocks'); }

  sec().visited[m.current.index] = true;
  draw();
  return () => { stop(); app.saveMock(m); };
}
