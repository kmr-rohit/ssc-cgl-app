import { html, render, nothing } from 'lit-html';
import { SUBJECTS, SUBJECT_ORDER, sectionsOf } from '../core/syllabus';
import type { SubjectId } from '../core/types';
import { app } from '../app/state';
import { getManifest, hasGenerator } from '../content/bank';
import { accBar, dot, priorityChip, weightChips } from '../ui/components';
import { pct } from '../ui/html';

export default function syllabus(el: HTMLElement, [subj]: string[]) {
  const subject = (SUBJECTS[subj as SubjectId] ? subj : 'quant') as SubjectId;
  const subjects = SUBJECT_ORDER.filter((s) => s !== 'statistics' || app.settings.paper2);
  const m = getManifest();
  const stats = app.stats;
  render(html`<div class="page">
    <h1>Syllabus</h1>
    <p class="muted">Topics ordered by section, tagged with the number of questions expected in each paper (from previous-year trends).</p>
    <nav class="tabs" aria-label="Subjects">
      ${subjects.map((s) => html`<a href="#/syllabus/${s}" class=${s === subject ? 'on' : ''}>${dot(s)} ${SUBJECTS[s].short}</a>`)}
    </nav>
    ${SUBJECTS[subject].mainsOnly ? html`<p class="chip">${subject === 'statistics' ? 'Tier 2 Paper 2 (JSO / SI Gr. II) only' : 'Tier 2 only (qualifying section)'}</p>` : nothing}
    ${sectionsOf(subject).map((sec) => html`
      <section class="paper" style="margin-bottom:1rem">
        <h2>${sec.name}</h2>
        ${sec.topics.map((t) => {
          const s = stats[t.id];
          const entry = m?.topics[t.id];
          const count = entry?.questions ?? 0;
          return html`<a class="topic-row" href="#/topic/${t.id}">
            <span class="name">${t.name}</span>
            <span class="small muted">${s ? html`${pct(s.accuracy)} · ${s.attempts} done` : count ? 'Not started' : html`<span class="chip">No content yet</span>`}</span>
            <span class="meta">${priorityChip(t)} ${weightChips(t)}
              <span class="chip">${count} Qs${hasGenerator(t.id) ? ' + generated' : ''}</span>
              ${s ? accBar(s.accuracy) : nothing}</span>
          </a>`;
        })}
      </section>`)}
  </div>`, el);
}
