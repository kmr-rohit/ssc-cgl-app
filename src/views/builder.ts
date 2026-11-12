// Build a test: presets, then 1. what to test, 2. which questions, 3. rules. Save setups as "your tests".
import { html, render, nothing } from 'lit-html';
import { EXAMS, SUBJECTS, SUBJECT_ORDER, topicsOf } from '../core/syllabus';
import { mistakes } from '../core/mistakes';
import { weakTopics } from '../core/analysis';
import type { ExamId, MockRules, SubjectId } from '../core/types';
import { app } from '../app/state';
import { toast } from '../app/router';
import { baseExamFor, buildCustomMock, type BuilderSpec } from '../content/bank';
import { uid } from '../data/storage';
import { confirmDialog } from '../ui/components';
import { openMock } from './mocks';

type Paper = ExamId | 'custom';
interface DraftSection { subject: SubjectId; on: boolean; count: number; topics: string[] | null }
export interface Draft {
  name: string; paper: Paper; size: 'full' | 'half' | 'mini' | 'own';
  sections: DraftSection[];
  source: BuilderSpec['source']; weighting: BuilderSpec['weighting'];
  timing: MockRules['timing']; perQSec: number; sectionMode: MockRules['sectionMode'];
  marking: 'exam' | 'nonegative'; feedback: MockRules['feedback'];
}
export interface SavedTest { id: string; name: string; draft: Draft }

const PAPER_NAME: Record<Paper, string> = { pre: 'Tier 1', mains: 'Tier 2 Paper 1', stats: 'Paper 2 (Statistics)', custom: 'Pick subjects' };
const fullSections = (paper: Paper): DraftSection[] => paper === 'custom'
  ? SUBJECT_ORDER.filter((s) => s !== 'statistics' || app.settings.paper2).map((s, i) => ({ subject: s, on: i < 2, count: s === 'computer' ? 20 : 25, topics: null }))
  : EXAMS[paper].sections.map((s) => ({ subject: s.subject, on: true, count: s.count, topics: null }));
const pace = (subject: SubjectId, paper: Paper) => {
  const e = EXAMS[baseExamFor(subject, paper)];
  const s = e.sections.find((x) => x.subject === subject) ?? e.sections[0];
  return (s.minutes * 60) / s.count; // seconds per question at the real exam's pace
};
const baseMarks = (paper: Paper) => EXAMS[paper === 'custom' ? 'pre' : paper];

export const newDraft = (paper: Paper = 'pre', patch: Partial<Draft> = {}): Draft => ({
  name: '', paper, size: 'full', sections: fullSections(paper), source: 'all', weighting: 'exam',
  timing: 'exam', perQSec: 36, sectionMode: 'locked', marking: 'exam', feedback: 'end', ...patch,
});

function resize(d: Draft, size: Draft['size']) {
  d.size = size;
  if (size === 'own') return;
  const base = fullSections(d.paper);
  const on = d.sections.filter((s) => s.on);
  const fullMinutes = on.reduce((a, s) => a + ((base.find((b) => b.subject === s.subject)?.count ?? 25) * pace(s.subject, d.paper)) / 60, 0) || 60;
  const f = size === 'full' ? 1 : size === 'half' ? 0.5 : Math.min(1, 10 / fullMinutes);
  for (const s of d.sections) s.count = Math.max(size === 'mini' ? 2 : 3, Math.round((base.find((b) => b.subject === s.subject)?.count ?? 25) * f));
}

export const PRESETS: { name: string; about: string; draft: () => Draft }[] = [
  { name: 'Full Tier 1', about: '100 questions in 60 minutes, exactly like the exam', draft: () => newDraft('pre') },
  { name: 'Full Tier 2 Paper 1', about: '150 questions with sectional timing', draft: () => newDraft('mains') },
  { name: 'Half Tier 1', about: '52 questions in about 30 minutes', draft: () => { const d = newDraft('pre'); resize(d, 'half'); return d; } },
  { name: '10-minute mini', about: 'A few questions from all four subjects', draft: () => { const d = newDraft('pre'); resize(d, 'mini'); return d; } },
  { name: 'Weak-topic Tier 1', about: 'More questions where you lose marks', draft: () => newDraft('pre', { weighting: 'weak', name: 'Weak-topic Tier 1' }) },
  { name: 'Second chance', about: 'Only questions you got wrong, answers shown as you go', draft: () => newDraft('pre', { source: 'mistakes', feedback: 'instant', timing: 'none', sectionMode: 'free', name: 'Second chance' }) },
  { name: 'Advanced Maths sprint', about: '20 questions on algebra, geometry, mensuration and trigonometry', draft: () => newDraft('custom', {
    name: 'Advanced Maths sprint', size: 'own',
    sections: fullSections('custom').map((s) => (s.subject === 'quant' ? { ...s, on: true, count: 20, topics: ['q-algebra', 'q-geometry', 'q-mensuration', 'q-trigonometry'] } : { ...s, on: false })),
  }) },
];

export const loadSavedTests = async () => (await app.db.getKV<SavedTest[]>('my-tests')) ?? [];
const saveTests = (list: SavedTest[]) => app.db.setKV('my-tests', list);

const minutesOf = (d: Draft, s: DraftSection) => d.timing === 'perq' ? (s.count * d.perQSec) / 60 : (s.count * pace(s.subject, d.paper)) / 60;
const titleOf = (d: Draft) => d.name.trim() || (d.paper === 'custom'
  ? d.sections.filter((s) => s.on).map((s) => SUBJECTS[s.subject].short).join(' and ') || 'My test'
  : `${PAPER_NAME[d.paper]}${d.size === 'half' ? ', half' : d.size === 'mini' ? ', 10-minute mini' : ''}`);

export function specOf(d: Draft): BuilderSpec {
  const bm = baseMarks(d.paper);
  return {
    paper: d.paper, title: titleOf(d), source: d.source, weighting: d.weighting,
    sections: d.sections.filter((s) => s.on && s.count > 0).map((s) => ({ subject: s.subject, count: s.count, topics: s.topics?.length ? s.topics : null })),
    rules: { timing: d.timing, perQSec: d.perQSec, sectionMode: d.sectionMode, marks: bm.marks, negative: d.marking === 'nonegative' ? 0 : bm.negative, feedback: d.feedback },
  };
}

/** What the builder needs from the student's history. */
export function buildContext() {
  const exam = app.settings.target;
  const weak = weakTopics(app.stats, exam, 3);
  const weakWeights: Record<string, number> = {};
  for (const w of weak) weakWeights[w.topic.id] = w.lost !== null ? w.lost + 0.2 : w.weight * 0.3;
  return { seen: new Set(app.attempts.map((a) => a.questionId)), mistakes: mistakes(app.attempts).map((m) => m.questionId), weakWeights };
}

export async function startDraft(d: Draft) {
  const spec = specOf(d);
  if (!spec.sections.length) throw new Error('Choose at least one section.');
  const key = `mine-${Date.now()}`;
  await openMock(key, () => buildCustomMock(spec, key, buildContext()));
}

export default async function builder(el: HTMLElement) {
  let d = newDraft(app.settings.target === 'stats' ? 'stats' : app.settings.target);
  let saved = await loadSavedTests();
  let openTopics: SubjectId | null = null;
  let busy = false;
  const nMistakes = mistakes(app.attempts).length;

  const setPaper = (p: Paper) => { d = newDraft(p, { name: d.name, source: d.source, weighting: d.weighting, timing: d.timing, perQSec: d.perQSec, sectionMode: d.sectionMode, marking: d.marking, feedback: d.feedback }); draw(); };
  const start = async () => {
    if (busy) return;
    busy = true; draw();
    try { await startDraft(d); } catch (e) { toast((e as Error).message); busy = false; draw(); }
  };
  const saveMine = async () => {
    const name = titleOf(d);
    saved = [...saved.filter((t) => t.name !== name), { id: uid(), name, draft: structuredClone(d) }];
    await saveTests(saved);
    toast(`Saved as "${name}"`);
    draw();
  };

  const seg = <T extends string>(value: T, options: [T, string][], set: (v: T) => void) => html`<div class="seg">${options.map(([v, label]) => html`<button class=${value === v ? 'on' : ''} aria-pressed=${value === v} @click=${() => { set(v); draw(); }}>${label}</button>`)}</div>`;

  const draw = () => {
    const on = d.sections.filter((s) => s.on && s.count > 0);
    const total = on.reduce((a, s) => a + s.count, 0);
    const minutes = Math.round(on.reduce((a, s) => a + minutesOf(d, s), 0));
    const bm = baseMarks(d.paper);
    const neg = d.marking === 'nonegative' ? 0 : bm.negative;
    render(html`<div class="page builder" style="max-width:760px">
      <h1>Build a test</h1>

      <section aria-label="Start from">
        <h2>Start from</h2>
        <div class="preset-list">
          ${saved.map((t) => html`<div class="preset">
            <button class="preset-main" @click=${() => { d = structuredClone(t.draft); draw(); }}><b>${t.name}</b><span>Your test</span></button>
            <button class="btn ghost sm" aria-label="Delete ${t.name}" @click=${async () => { if (await confirmDialog(`Delete "${t.name}"?`, 'Delete')) { saved = saved.filter((x) => x.id !== t.id); await saveTests(saved); draw(); } }}>✕</button>
          </div>`)}
          ${PRESETS.map((p) => html`<div class="preset"><button class="preset-main" @click=${() => { d = p.draft(); draw(); }}><b>${p.name}</b><span>${p.about}</span></button></div>`)}
        </div>
      </section>

      <section class="paper stack" style="margin-top:1.2rem">
        <h2>1. What to test</h2>
        ${seg(d.paper, (['pre', 'mains', ...(app.settings.paper2 ? ['stats'] : []), 'custom'] as Paper[]).map((p) => [p, PAPER_NAME[p]]), setPaper)}
        ${seg(d.size, [['full', 'Full'], ['half', 'Half'], ['mini', '10 minutes'], ['own', 'Set my own']], (v) => resize(d, v))}
        <div class="sections">
          ${d.sections.map((s) => html`<div class="sec-row ${s.on ? '' : 'off'}">
            <label class="check"><input type="checkbox" .checked=${s.on} @change=${(e: Event) => { s.on = (e.target as HTMLInputElement).checked; draw(); }} /> <b>${SUBJECTS[s.subject].name}</b></label>
            ${s.on ? html`<span class="row">
              <input type="number" min="1" max="100" .value=${String(s.count)} aria-label="${SUBJECTS[s.subject].short} questions"
                @change=${(e: Event) => { s.count = Math.min(100, Math.max(1, Number((e.target as HTMLInputElement).value) || 1)); d.size = 'own'; draw(); }} />
              <span class="small muted">questions</span>
              <button class="btn ghost sm" @click=${() => { openTopics = openTopics === s.subject ? null : s.subject; draw(); }}>${s.topics?.length ? `${s.topics.length} topic${s.topics.length === 1 ? '' : 's'}` : 'All topics'}</button>
            </span>` : nothing}
            ${s.on && openTopics === s.subject ? html`<div class="topic-pick">
              ${topicsOf(s.subject).map((t) => html`<label class="check small"><input type="checkbox" .checked=${!!s.topics?.includes(t.id)}
                @change=${(e: Event) => { const c = (e.target as HTMLInputElement).checked; const cur = new Set(s.topics ?? []); c ? cur.add(t.id) : cur.delete(t.id); s.topics = cur.size ? [...cur] : null; draw(); }} /> ${t.name}</label>`)}
              <p class="small muted">Leave all unticked for every topic.</p>
            </div>` : nothing}
          </div>`)}
        </div>
      </section>

      <section class="paper stack" style="margin-top:1rem">
        <h2>2. Which questions</h2>
        ${seg(d.source, [['all', 'All questions'], ['unseen', 'Only ones I haven\'t seen'], ['mistakes', `My mistakes${nMistakes ? ` (${nMistakes})` : ''}`]], (v) => (d.source = v))}
        ${d.source === 'mistakes' && !nMistakes ? html`<p class="small muted">You have no mistakes saved yet. Practise a topic first.</p>` : nothing}
        ${d.source !== 'mistakes' ? html`<div><div class="kicker">Spread questions across topics</div>
          ${seg(d.weighting, [['exam', 'Like the exam'], ['weak', 'More on my weak topics'], ['equal', 'Equally']], (v) => (d.weighting = v))}</div>` : nothing}
      </section>

      <section class="paper stack" style="margin-top:1rem">
        <h2>3. Rules</h2>
        <div><div class="kicker">Time</div>
          ${seg(d.timing, [['exam', 'Exam pace'], ['perq', 'Seconds per question'], ['none', 'No timer']], (v) => (d.timing = v))}
          ${d.timing === 'perq' ? html`<label class="field" style="max-width:220px;margin-top:.5rem">Seconds for each question
            <input type="number" min="10" max="300" .value=${String(d.perQSec)} @change=${(e: Event) => { d.perQSec = Math.min(300, Math.max(10, Number((e.target as HTMLInputElement).value) || 36)); draw(); }} /></label>` : nothing}</div>
        ${on.length > 1 ? html`<div><div class="kicker">Sections</div>
          ${seg(d.sectionMode, [['locked', 'One at a time, like SSC'], ['free', 'Move between them freely']], (v) => (d.sectionMode = v))}</div>` : nothing}
        <div><div class="kicker">Marking</div>
          ${seg(d.marking, [['exam', `+${bm.marks} / −${bm.negative}, like the exam`], ['nonegative', 'No negative marking']], (v) => (d.marking = v))}</div>
        <div><div class="kicker">Answers</div>
          ${seg(d.feedback, [['end', 'At the end'], ['instant', 'After each question']], (v) => (d.feedback = v))}</div>
        <label class="field">Name (optional)<input type="text" maxlength="60" .value=${d.name} placeholder=${titleOf({ ...d, name: '' })} @input=${(e: Event) => { d.name = (e.target as HTMLInputElement).value; }} @change=${() => draw()} /></label>
      </section>

      <div class="builder-bar" role="region" aria-label="Summary">
        <p><b>${total} question${total === 1 ? '' : 's'}</b>${d.timing === 'none' ? ', no time limit' : `, about ${minutes} minute${minutes === 1 ? '' : 's'}`}. +${bm.marks}${neg ? ` / −${neg}` : ', no negative marking'}.</p>
        <div class="row">
          <button class="btn ghost" ?disabled=${!total} @click=${saveMine}>Save as my test</button>
          <button class="btn primary" ?disabled=${!total || busy} @click=${start}>${busy ? 'Preparing…' : 'Start test'}</button>
        </div>
      </div>
    </div>`, el);
  };
  draw();
}
