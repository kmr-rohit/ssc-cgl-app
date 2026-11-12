// Shared view pieces.
import { html, nothing } from 'lit-html';
import type { Question, SubjectId } from '../core/types';
import { topicPriority, type Topic, type Range } from '../core/syllabus';
import { passageOf } from '../content/bank';
import { LETTERS, img, rich } from './html';

export const dot = (s: SubjectId) => html`<span class="dot s-${s}" aria-hidden="true"></span>`;
export const rangeText = (r: Range) => (r[1] === 0 ? '—' : r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`);
export const priorityChip = (t: Topic) => {
  const p = topicPriority(t);
  return html`<span class="chip ${p}">${p === 'high' ? 'High priority' : p === 'medium' ? 'Medium' : 'Low'}</span>`;
};
export const weightChips = (t: Topic) => html`
  ${t.pre[1] ? html`<span class="chip" title="Expected questions in Tier 1">T1 ${rangeText(t.pre)}</span>` : nothing}
  ${t.mains[1] ? html`<span class="chip" title="Expected questions in Tier 2">T2 ${rangeText(t.mains)}</span>` : nothing}
  ${t.stats[1] ? html`<span class="chip" title="Expected questions in Paper 2">P2 ${rangeText(t.stats)}</span>` : nothing}`;

/** Plain words: how many questions a topic usually gets in the student's target paper. */
export function weightText(t: Topic, target: 'pre' | 'mains' | 'stats') {
  const paper = target === 'pre' ? 'Tier 1' : target === 'mains' ? 'Tier 2' : 'Paper 2';
  const r = t[target];
  if (!r[1]) {
    const other = target === 'pre' ? t.mains : t.pre;
    return other[1] ? `Not in ${paper}. ${target === 'pre' ? 'Tier 2' : 'Tier 1'} only` : `Not in ${paper}`;
  }
  if (r[0] === r[1]) return `About ${r[0]} question${r[0] === 1 ? '' : 's'} in ${paper}`;
  return r[0] ? `${r[0]} to ${r[1]} questions in ${paper}` : `Up to ${r[1]} question${r[1] === 1 ? '' : 's'} in ${paper}`;
}
export const isImp = (t: Topic, target: 'pre' | 'mains' | 'stats') => topicPriority(t) === 'high' && t[target][1] > 0;

export const accBar = (acc: number) =>
  html`<span class="bar ${acc < 0.5 ? 'bad' : acc < 0.75 ? 'warn' : ''}" role="img" aria-label="Accuracy ${Math.round(acc * 100)}%"><i style="width:${Math.round(acc * 100)}%"></i></span>`;

/** OMR row: n bubbles, k filled. */
export const omr = (k: number, n = 5) => html`<span class="omr" aria-hidden="true">${Array.from({ length: n }, (_, i) => html`<i class=${i < k ? 'f' : ''}></i>`)}</span>`;

export const stamp = (kind: 'ok' | 'no' | 'skip') =>
  html`<span class="stamp ${kind}">${kind === 'ok' ? 'Correct' : kind === 'no' ? 'Wrong' : 'Skipped'}</span>`;

export interface QOpts {
  chosen: number | null;
  reveal: boolean;               // show right/wrong + solution
  onPick?: (i: number) => void;  // omit for read-only
  head?: unknown;
  showPassage?: boolean;
}

export function questionView(q: Question, o: QOpts) {
  const passage = o.showPassage !== false ? passageOf(q) : null;
  const pics = !!q.optionImgs;
  const cls = (i: number) => {
    if (o.reveal) {
      if (i === q.answer) return 'opt right';
      if (i === o.chosen) return 'opt wrong';
      return 'opt';
    }
    return i === o.chosen ? 'opt sel' : 'opt';
  };
  return html`
    ${passage ? html`<div class="passage" aria-label="Passage">${passage.title ? html`<h3>${passage.title}</h3>` : nothing}${img(passage.img)}${rich(passage.text)}</div>` : nothing}
    <div class="q">
      ${o.head ?? nothing}
      <div>${rich(q.q)}</div>
      ${img(q.img, 'Question figure')}
    </div>
    <div class="opts ${pics ? 'pics' : ''}" role="radiogroup" aria-label="Options">
      ${q.options.map((opt, i) => html`
        <button class=${cls(i)} role="radio" aria-checked=${i === o.chosen ? 'true' : 'false'} ?disabled=${!o.onPick || o.reveal}
          @click=${() => o.onPick?.(i)}>
          <span class="bubble">${LETTERS[i]}</span>
          <span>${q.optionImgs ? img(q.optionImgs[i], `Option ${LETTERS[i]}`, '') : rich(opt)}</span>
        </button>`)}
    </div>
    ${o.reveal ? html`<div class="solution">
      <h3>Solution ${stamp(o.chosen === null ? 'skip' : o.chosen === q.answer ? 'ok' : 'no')}</h3>
      <div>${rich(q.solution)}</div>
    </div>` : nothing}`;
}

export function confirmDialog(message: string, okLabel = 'Yes'): Promise<boolean> {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.innerHTML = `<p></p><div class="row" style="justify-content:flex-end"><button class="btn" value="no">Cancel</button><button class="btn primary" value="yes"></button></div>`;
    d.querySelector('p')!.textContent = message;
    d.querySelector('.primary')!.textContent = okLabel;
    d.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) d.close(b.value);
    });
    d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove(); });
    document.body.append(d);
    d.showModal();
  });
}

/** Ask for a short piece of text (e.g. the name friends see). Resolves null if cancelled. */
export function promptDialog(message: string, value = '', okLabel = 'OK'): Promise<string | null> {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog" class="stack"><label class="field"><span></span><input type="text" maxlength="40" required></label>
      <div class="row" style="justify-content:flex-end"><button class="btn" value="no" formnovalidate>Cancel</button><button class="btn primary" value="yes"></button></div></form>`;
    d.querySelector('span')!.textContent = message;
    const input = d.querySelector('input')!;
    input.value = value;
    d.querySelector('.primary')!.textContent = okLabel;
    d.addEventListener('close', () => { resolve(d.returnValue === 'yes' ? input.value.trim() || null : null); d.remove(); });
    document.body.append(d);
    d.showModal();
    input.select();
  });
}
