// Formula sheets: one page per topic that has formulas, plus computed reference tables. Print-friendly.
import { html, render, nothing } from 'lit-html';
import { SUBJECTS, TOPIC_MAP, topicsOf } from '../core/syllabus';
import type { SubjectId } from '../core/types';
import { app } from '../app/state';
import { getTopic, loadTopic } from '../content/bank';
import { TRIG_ANGLES, alphabet, cubes, fractionPercent, multiplication, powersOf2, squares, trigTable } from '../core/tables';
import { dot } from '../ui/components';
import { rich } from '../ui/html';

const SHEET_SUBJECTS: SubjectId[] = ['quant', 'reasoning', 'statistics', 'computer', 'english', 'ga'];

const TABLES: Record<string, { name: string; view: () => unknown }> = {
  squares: { name: 'Squares 1–50', view: () => grid(squares().map((x) => [`${x.n}²`, x.v])) },
  cubes: { name: 'Cubes 1–25', view: () => grid(cubes().map((x) => [`${x.n}³`, x.v])) },
  fractions: { name: 'Fractions ↔ percent', view: () => html`<table class="sheet"><thead><tr><th>Fraction</th><th>Percent</th><th>Decimal</th></tr></thead>
    <tbody>${fractionPercent().map((r) => html`<tr><td>${r.frac}</td><td>${r.pct}</td><td>${r.dec}</td></tr>`)}</tbody></table>` },
  tables: { name: 'Tables 11–20', view: () => html`<table class="sheet"><tbody>${multiplication().map((r) => html`<tr><th>${r.n}</th>${r.row.map((v) => html`<td>${v}</td>`)}</tr>`)}</tbody></table>` },
  powers: { name: 'Powers of 2', view: () => grid(powersOf2().map((x) => [`2^${x.n}`, x.v])) },
  trig: { name: 'Trigonometric values', view: () => html`<table class="sheet"><thead><tr><th></th>${TRIG_ANGLES.map((a) => html`<th>${a}</th>`)}</tr></thead>
    <tbody>${trigTable.map((r) => html`<tr><th>${r.f}</th>${r.v.map((v) => html`<td>${v}</td>`)}</tr>`)}</tbody></table>` },
  alphabet: { name: 'Alphabet positions', view: () => grid(alphabet().map((x) => [x.l, `${x.pos} · ${x.rev}`]), 'Letter: position from A · position from Z') },
};

function grid(cells: [string, string | number][], caption?: string) {
  return html`${caption ? html`<p class="small muted">${caption}</p>` : nothing}
    <div class="num-grid">${cells.map(([k, v]) => html`<div><span class="muted">${k}</span><b>${String(v)}</b></div>`)}</div>`;
}

export default async function formulas(el: HTMLElement, [arg]: string[]) {
  render(html`<div class="page"><p class="muted">Loading formula sheets…</p></div>`, el);
  const subjects = SHEET_SUBJECTS.filter((s) => s !== 'statistics' || app.settings.paper2);
  await Promise.all(subjects.flatMap((s) => topicsOf(s).map((t) => loadTopic(t.id))));
  const withFormulas = (s: SubjectId) => topicsOf(s).filter((t) => (getTopic(t.id)?.formulas?.length ?? 0) > 0);

  const sheet = (id: string) => {
    if (TABLES[id]) return html`<h1>${TABLES[id].name}</h1>${TABLES[id].view()}`;
    const t = TOPIC_MAP[id];
    const c = getTopic(id);
    if (!t || !c?.formulas?.length) return html`<h1>Not found</h1><p class="muted">No formula sheet for this topic.</p>`;
    return html`<p class="small no-print">${dot(t.subject)} ${SUBJECTS[t.subject].short} · <a href="#/topic/${t.id}/learn">Open notes</a></p>
      <h1>${t.name}</h1>
      <div class="paper">${c.formulas.map((f) => html`<div class="formula"><span>${f.name}</span><code>${rich(f.expr)}</code></div>`)}</div>
      ${c.notes.traps.length ? html`<h2>Watch out</h2>${c.notes.traps.map((x) => html`<div class="trap">${rich(x)}</div>`)}` : nothing}`;
  };

  if (arg) {
    render(html`<div class="page sheet-page" style="max-width:860px">
      <div class="row no-print" style="margin-bottom:.6rem"><a class="btn sm ghost" href="#/formulas">← All sheets</a><button class="btn sm" @click=${() => window.print()}>Print</button></div>
      ${sheet(arg)}</div>`, el);
    return;
  }

  render(html`<div class="page">
    <h1>Formula sheets</h1>
    <p class="muted">One page per topic, plus quick-reference tables. Each sheet prints on its own.</p>
    <h2>Reference tables</h2>
    <div class="row" style="margin-bottom:1.2rem">${Object.entries(TABLES).map(([id, t]) => html`<a class="btn" href="#/formulas/${id}">${t.name}</a>`)}</div>
    ${subjects.map((s) => {
      const list = withFormulas(s);
      return list.length ? html`<h2>${dot(s)} ${SUBJECTS[s].name}</h2>
        <div class="grid" style="margin-bottom:1.2rem">${list.map((t) => html`<a class="card" href="#/formulas/${t.id}">
          <b>${t.name}</b><div class="small muted">${getTopic(t.id)!.formulas!.length} formulas</div></a>`)}</div>` : nothing;
    })}
  </div>`, el);
}

