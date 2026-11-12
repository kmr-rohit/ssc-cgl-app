// SSC-style test screen: sectional timers, question palette, mark for review, pause & resume.
import { html, render, nothing } from 'lit-html';
import { EXAMS, SUBJECTS } from '../core/syllabus';
import { scoreSections } from '../core/scoring';
import type { Attempt, MockRecord } from '../core/types';
import { app } from '../app/state';
import { go, toast } from '../app/router';
import { assetUrl, hydrateMock, lookup, passageOf } from '../content/bank';
import { uid } from '../data/storage';
import { confirmDialog, dot, questionView } from '../ui/components';
import { fmtMs } from '../ui/html';

function enterFullscreen() {
  // must run inside the click handler (user gesture); unsupported on iPhone Safari, which is fine
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}

/**
 * Fetch every figure this mock uses, in the background, so the service worker caches it (it caches /pyq/ and
 * /content/ files on fetch). Then figures still show if the network drops mid-mock. Low priority, 3 at a time,
 * errors ignored. Exported for tests.
 */
export function mockImageUrls(m: MockRecord): string[] {
  const urls = new Set<string>();
  const fromHtml = (h: string | undefined) => {
    if (!h) return;
    for (const x of h.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)) urls.add(x[1]);
  };
  const add = (p: string | undefined) => { if (p) urls.add(assetUrl(p)); };
  for (const s of m.sections) for (const id of s.questionIds) {
    const q = lookup(id);
    if (!q) continue;
    fromHtml(q.q); q.options.forEach(fromHtml); fromHtml(q.solution);
    add(q.img); q.optionImgs?.forEach(add);
    const p = passageOf(q);
    if (p) { fromHtml(p.text); add(p.img); }
  }
  return [...urls].filter((u) => !u.startsWith('data:'));
}

/** SSC palette status, one per question: a = answered, v = not answered, m = marked (no answer), am = answered & marked, '' = not visited. */
export type PaletteStatus = 'a' | 'v' | 'm' | 'am' | '';
export function paletteStatus(s: Pick<MockRecord['sections'][number], 'answers' | 'marked' | 'visited'>, i: number): PaletteStatus {
  const a = s.answers[i] !== null, mk = s.marked[i];
  return a && mk ? 'am' : mk ? 'm' : a ? 'a' : s.visited[i] ? 'v' : '';
}
/** Counts per status; they always add up to the number of questions. */
export function paletteCounts(s: Pick<MockRecord['sections'][number], 'answers' | 'marked' | 'visited'>): Record<PaletteStatus, number> {
  const n: Record<PaletteStatus, number> = { a: 0, v: 0, m: 0, am: 0, '': 0 };
  s.answers.forEach((_, i) => n[paletteStatus(s, i)]++);
  return n;
}

const warmed = new Set<string>(); // mock keys already warmed in this page load
function warmMockImages(m: MockRecord) {
  if (warmed.has(m.key) || !navigator.onLine) return;
  warmed.add(m.key);
  const queue = mockImageUrls(m);
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      try { await fetch(u, { priority: 'low' } as RequestInit); } catch { /* offline or missing: the figure just won't be cached */ }
    }
  };
  const start = () => { for (let i = 0; i < 3; i++) void worker(); };
  // after the first question has painted
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 3000 }); else setTimeout(start, 1000);
}

export async function submitMock(m: MockRecord) {
  m.sections.forEach((s) => (s.done = true));
  m.status = 'submitted';
  m.submittedAt = new Date().toISOString();
  m.score = scoreSections(m.exam, m.sections, lookup, m.rules);
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
  warmMockImages(m); // on start and on resume: figures survive the network dropping mid-mock
  const e = EXAMS[m.exam];
  const rules = m.rules;
  const marks = rules?.marks ?? e.marks, negative = rules?.negative ?? e.negative;
  const free = rules?.sectionMode === 'free';
  const untimed = rules?.timing === 'none';
  const instant = rules?.feedback === 'instant';
  const title = m.title ?? e.name;
  const kindLabel = m.challenge ? 'challenge' : m.kind === 'daily' ? 'daily mock' : m.kind === 'sectional' ? 'sectional test' : 'your own test';

  // ---------------------------------------------------------------- instructions
  if (m.status === 'not-started') {
    await new Promise<void>((resolve) => render(html`<div class="page" style="max-width:720px">
      <div class="ticket">
        <div class="kicker">Admit card, ${kindLabel}</div>
        <h1>${title}</h1>
        <dl>
          <dt>Sections</dt><dd>${m.sections.map((s) => html`${dot(s.subject)} ${SUBJECTS[s.subject].short} (${s.questionIds.length}) `)}</dd>
          <dt>Time</dt><dd>${untimed ? 'No time limit' : free ? `${Math.round(m.sections.reduce((a, s) => a + s.remainingMs, 0) / 60000)} min in total` : m.sections.map((s) => `${Math.round(s.remainingMs / 60000)} min`).join(' + ')}</dd>
          <dt>Marking</dt><dd>+${marks} for correct, ${negative ? `−${negative} for wrong` : 'no negative marking'}, 0 for skipped</dd>
        </dl>
        <ul class="small">
          ${free ? html`<li>Move between sections freely. One clock for the whole test${untimed ? ', with no limit' : ''}.</li>`
            : html`<li>Each section has its own ${untimed ? 'clock with no limit' : 'timer. When it runs out, the next section starts automatically'}. You cannot return to a finished section.</li>`}
          ${instant ? html`<li>You see the answer and solution right after choosing. Your first choice is final.</li>` : nothing}
          <li>Palette colours: grey is not visited, red is not answered, green is answered, a purple circle is marked for review, and a purple circle with a green ring is answered and marked.</li>
          <li>Questions marked for review <b>with</b> an answer are evaluated.</li>
          <li>You can pause; the timer stops and you resume from the same question.</li>
        </ul>
        ${!rules && m.sections.some((s) => s.questionIds.length < (e.sections.find((x) => x.subject === s.subject)?.count ?? 0))
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
  let ended = false; // set by stop(): submitted, paused or left; nothing may submit after this
  const sec = () => m.sections[m.current.section];
  // free sections share one clock; untimed tests count time used
  if (untimed) m.clockMs ??= 0;
  else if (free) m.clockMs ??= m.sections.reduce((a, s) => a + s.remainingMs, 0);
  const clock = () => (untimed || free ? m.clockMs! : sec().remainingMs);

  const tick = () => {
    const now = performance.now();
    const d = now - last; last = now;
    const s = sec();
    s.msSpent[m.current.index] += d;
    if (untimed) m.clockMs! += d;
    else if (free) {
      m.clockMs! -= d;
      if (m.clockMs! <= 0) { m.clockMs = 0; finish(); return; }
    } else {
      s.remainingMs -= d;
      if (s.remainingMs <= 0) { s.remainingMs = 0; endSection(true); return; }
    }
    draw();
  };
  const save = () => { dirty = false; app.saveMock(m); };
  const visit = (i: number) => { m.current.index = i; sec().visited[i] = true; dirty = true; palOpen = false; draw(); };

  async function finish() {
    if (ended) return;
    stop();
    await submitMock(m);
    go(`#/result/${encodeURIComponent(m.key)}`);
  }
  const switchSection = (i: number) => { if (i === m.current.section) return; m.current = { section: i, index: 0 }; sec().visited[0] = true; palOpen = false; dirty = true; draw(); };

  async function endSection(auto: boolean) {
    if (ended) return;
    if (free) { finish(); return; }
    const s = sec();
    s.done = true;
    if (m.current.section < m.sections.length - 1) {
      m.current = { section: m.current.section + 1, index: 0 };
      palOpen = false;
      sec().visited[0] = true;
      save();
      toast(auto ? 'Time up. Next section started.' : 'Section submitted.');
      draw();
    } else finish();
  }

  const choose = (k: number) => {
    if (instant && sec().answers[m.current.index] !== null) return;
    sec().answers[m.current.index] = k; dirty = true;
    if (instant) save();
    draw();
  };
  const next = () => { if (m.current.index < sec().questionIds.length - 1) visit(m.current.index + 1); else { palOpen = true; draw(); } };
  const saveNext = () => { save(); next(); };
  const markNext = () => { sec().marked[m.current.index] = true; save(); next(); };
  const clear = () => { if (instant) return; sec().answers[m.current.index] = null; sec().marked[m.current.index] = false; dirty = true; draw(); };

  const palClass = (i: number) => [paletteStatus(sec(), i), i === m.current.index ? 'cur' : ''].join(' ');

  const draw = () => {
    const s = sec();
    const q = lookup(s.questionIds[m.current.index]);
    const answered = s.answers.filter((x) => x !== null).length;
    render(html`
      ${warning ? html`<div class="exam-warning" role="alert"><span>⚠ ${warning}</span>
        <span class="row">${examMode && !document.fullscreenElement && document.fullscreenEnabled ? html`<button class="btn sm" @click=${() => { enterFullscreen(); warning = null; draw(); }}>Full screen</button>` : nothing}
        <button class="btn sm" @click=${() => { warning = null; draw(); }}>Continue</button></span></div>` : nothing}
      <div class="exam-bar">
        ${free && m.sections.length > 1
          ? html`<span class="sec-tabs" role="tablist">${m.sections.map((x, i) => html`<button role="tab" aria-selected=${i === m.current.section} class=${i === m.current.section ? 'on' : ''} @click=${() => switchSection(i)}>${SUBJECTS[x.subject].short}</button>`)}</span>`
          : html`<span><b>${m.title ? '' : e.short}</b> ${SUBJECTS[s.subject].short} ${m.sections.length > 1 ? html`<span class="small">(section ${m.current.section + 1}/${m.sections.length})</span>` : nothing}</span>`}
        <span class="timer ${!untimed && clock() < 60000 ? 'low' : ''}" role="timer" aria-label=${untimed ? 'Time used' : free ? 'Time left' : 'Time left in section'}>${untimed ? html`<span class="small">used </span>` : nothing}${fmtMs(clock())}</span>
        <span class="row">
          <button class="btn sm pal-toggle" @click=${() => { palOpen = !palOpen; draw(); }}>Palette ${answered}/${s.questionIds.length}</button>
          <button class="btn sm" @click=${pause}>Pause</button>
        </span>
      </div>
      <div class="exam">
        <section class="paper">
          ${q ? questionView(q, { chosen: s.answers[m.current.index], reveal: instant && s.answers[m.current.index] !== null, onPick: choose,
            head: html`<div class="q-head"><span>Question ${m.current.index + 1}</span><span>+${marks}${negative ? ` / −${negative}` : ''}</span></div>` })
            : html`<p class="muted">This question could not be loaded.</p>`}
          <div class="exam-actions">
            <div class="row">
              <button class="btn" @click=${markNext}>Mark for review & next</button>
              ${instant ? nothing : html`<button class="btn ghost" @click=${clear}>Clear response</button>`}
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
            ${(() => { const n = paletteCounts(s); return html`
            <span><i style="background:var(--green)"></i>Answered ${n.a}</span>
            <span><i style="background:var(--red-wash);border-color:var(--red)"></i>Not answered ${n.v}</span>
            <span><i></i>Not visited ${n['']}</span>
            <span><i style="background:var(--stamp);border-radius:50%"></i>Marked for review ${n.m}</span>
            <span class="wide"><i style="background:var(--stamp);border-radius:50%;box-shadow:inset 0 0 0 3px var(--green)"></i>Answered and marked (evaluated) ${n.am}</span>`; })()}
          </div>
          <button class="btn danger" style="width:100%;margin-top:1rem" @click=${async () => {
            const last = free || m.current.section === m.sections.length - 1;
            const openedFor = m.current.section;
            const ok = await confirmDialog(last ? `Submit the test? ${s.questionIds.length - answered} unanswered in this section.` : `Submit this section? You can't come back to it. ${s.questionIds.length - answered} unanswered.`, last ? 'Submit test' : 'Submit section');
            // the timer may have moved on (or ended the test) while the dialog was open
            if (ok && !ended && (free || m.current.section === openedFor)) endSection(false);
          }}>${free || m.current.section === m.sections.length - 1 ? 'Submit test' : 'Submit section'}</button>
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
    ended = true;
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
