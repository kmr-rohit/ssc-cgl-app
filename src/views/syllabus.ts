import { html, render, nothing } from 'lit-html';
import { SUBJECTS, SUBJECT_ORDER, sectionsOf } from '../core/syllabus';
import { isImp, weightText } from '../ui/components';
import type { SubjectId } from '../core/types';
import { app } from '../app/state';
import { getManifest } from '../content/bank';

import { pct } from '../ui/html';
import { isDue } from '../core/srs';
import { mistakes } from '../core/mistakes';

export default function syllabus(el: HTMLElement, [subj]: string[]) {
  const subject = (SUBJECTS[subj as SubjectId] ? subj : 'quant') as SubjectId;
  const subjects = SUBJECT_ORDER.filter((s) => s !== 'statistics' || app.settings.paper2);
  const m = getManifest();
  const stats = app.stats;
  const dueCards = [...app.cards.values()].filter((c) => isDue(c)).length;
  const nMistakes = mistakes(app.attempts).length;
  const target = app.settings.target;
  const key = target === 'pre' ? 'pre' : target === 'mains' ? 'mains' : 'stats';
  const progress = (id: string, count: number) => {
    const st = stats[id];
    if (st) return html`<span class=${st.accuracy < 0.5 ? 'hand' : ''}>${pct(st.accuracy)}</span><br><span class="small">${st.attempts} done</span>`;
    return count ? html`<span>Not started</span>` : html`<span>Notes coming</span>`;
  };

  render(html`<div class="page">
    <h1>Study</h1>
    <div class="hub">
      <a class="hub-tile" href="#/revise"><b>Flashcards</b>${dueCards ? html`<span class="due">${dueCards} due</span>` : nothing}</a>
      <a class="hub-tile" href="#/formulas"><b>Formula sheets</b></a>
      <a class="hub-tile" href="#/mistakes"><b>My mistakes</b>${nMistakes ? html`<span class="due">${nMistakes} to fix</span>` : nothing}</a>
    </div>
    <nav class="tabs" aria-label="Subjects" style="margin-top:1.4rem">
      ${subjects.map((s) => html`<a href="#/syllabus/${s}" class=${s === subject ? 'on' : ''}>${SUBJECTS[s].short}</a>`)}
    </nav>
    ${SUBJECTS[subject].mainsOnly ? html`<p class="small muted">${subject === 'statistics' ? 'Only for JSO and Statistical Investigator posts (Tier 2 Paper 2).' : 'Tier 2 only. You need to pass this section, but it doesn\'t add to your score.'}</p>` : nothing}
    ${sectionsOf(subject).map((sec) => html`
      <div class="sec-head"><h2>${sec.name}</h2></div>
      <section class="paper" style="padding:.2rem 1rem .2rem .6rem">
        ${sec.topics.map((t) => {
          const count = m?.topics[t.id]?.questions ?? 0;
          const imp = isImp(t, key);
          return html`<a class="topic-row" href="#/topic/${t.id}">
            ${imp ? html`<span class="imp" aria-label="Important">IMP</span>` : nothing}
            <span class="name">${t.name}</span>
            <span class="prog">${progress(t.id, count)}</span>
            <span class="meta">${weightText(t, key)}</span>
          </a>`;
        })}
      </section>`)}
  </div>`, el);
}
