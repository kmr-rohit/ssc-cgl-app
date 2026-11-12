import { html, render, svg, nothing } from 'lit-html';
import { EXAMS, SUBJECTS, SUBJECT_ORDER, TOPIC_MAP, topicsOf } from '../core/syllabus';
import { TARGET_SEC, weakTopics } from '../core/analysis';
import type { ExamId, MockRecord } from '../core/types';
import { app } from '../app/state';
import { accBar, dot } from '../ui/components';
import { niceDate, pct } from '../ui/html';

// Previous Tier 1 cut-off for reference (CGL 2025, UR, posts other than JSO/SI, normalised, out of 200).
// Source: SSC revised Tier 1 result as reported by pw.live / careers360. Normalised marks are not directly comparable to raw mock scores.
const REF_CUTOFF: Partial<Record<ExamId, { value: number; label: string }>> = { pre: { value: 136.4, label: 'CGL 2025 Tier 1 UR cut-off (normalised)' } };

function trendChart(mocks: MockRecord[], exam: ExamId) {
  const W = 640, H = 220, P = 34;
  const max = mocks[0]?.score?.max ?? 200;
  const pts = mocks.map((m, i) => ({ x: P + (mocks.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (mocks.length - 1)), y: H - P - ((m.score!.total / max) * (H - 2 * P)), m }));
  const cut = REF_CUTOFF[exam];
  const cy = cut ? H - P - (cut.value / max) * (H - 2 * P) : 0;
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mock score trend">
    ${svg`<line class="axis" x1=${P} y1=${H - P} x2=${W - P} y2=${H - P}/><line class="axis" x1=${P} y1=${P} x2=${P} y2=${H - P}/>
    <text x=${P - 6} y=${P + 4} text-anchor="end">${max}</text><text x=${P - 6} y=${H - P + 4} text-anchor="end">0</text>
    ${cut ? svg`<line class="cut" x1=${P} y1=${cy} x2=${W - P} y2=${cy}/><text x=${W - P} y=${cy - 6} text-anchor="end">${cut.label}: ${cut.value}</text>` : ''}
    <polyline class="line" points=${pts.map((p) => `${p.x},${p.y}`).join(' ')}/>
    ${pts.map((p) => svg`<circle class="pt" cx=${p.x} cy=${p.y} r="4"><title>${niceDate(p.m.submittedAt!)}: ${p.m.score!.total}</title></circle>
      <text x=${p.x} y=${H - P + 16} text-anchor="middle">${niceDate(p.m.submittedAt!)}</text>`)}`}
  </svg>`;
}

export default function analysis(el: HTMLElement) {
  let exam: ExamId = app.settings.target;
  const draw = () => {
    const stats = app.stats;
    const done = [...app.mocks.values()].filter((m) => m.status === 'submitted' && m.exam === exam && m.kind === 'daily')
      .sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!)).slice(-12);
    const weak = weakTopics(stats, exam).filter((w) => w.lost !== null).slice(0, 8);
    const careless = app.attempts.filter((a) => !a.correct && a.chosen !== null && a.ms < (TARGET_SEC[TOPIC_MAP[a.topic]?.subject ?? 'quant'] * 1000) / 3).length;
    const wrong = app.attempts.filter((a) => !a.correct && a.chosen !== null).length;
    const types = Object.values(stats).flatMap((s) => Object.entries(s.byType).filter(([, v]) => v.attempts >= 3).map(([type, v]) => ({ topic: s.topic, type, acc: v.correct / v.attempts, n: v.attempts })))
      .sort((a, b) => a.acc - b.acc).slice(0, 6);
    const recent = done.slice(-3);
    const avg = recent.length ? recent.reduce((a, m) => a + m.score!.total, 0) / recent.length : null;

    render(html`<div class="page">
      <h1>Analysis</h1>
      <div class="seg" style="margin-bottom:1rem">${(app.settings.paper2 ? ['pre', 'mains', 'stats'] : ['pre', 'mains']).map((x) => html`<button class=${exam === x ? 'on' : ''} @click=${() => { exam = x as ExamId; draw(); }}>${EXAMS[x as ExamId].short}</button>`)}</div>
      ${!app.attempts.length ? html`<div class="paper"><p>No data yet. Practise a topic or take a mock and your analysis will appear here.</p><a class="btn primary" href="#/mocks">Take a mock</a></div>` : html`
      <section class="paper" style="margin-bottom:1rem">
        <div class="spread"><h2>Mock scores</h2>${avg !== null ? html`<span class="small">Estimated score band (last ${recent.length}): <b>${Math.max(0, avg - 8).toFixed(0)}–${(avg + 8).toFixed(0)}</b> <span class="muted">· an estimate, not a prediction</span></span>` : nothing}</div>
        ${done.length ? trendChart(done, exam) : html`<p class="muted small">Take daily mocks to see your trend.</p>`}
      </section>

      <div class="grid" style="margin-bottom:1rem">
        <section class="paper"><h2>Biggest mark leaks</h2>
          ${weak.length ? weak.map((w) => html`<div class="spread" style="padding:.35rem 0;border-bottom:1px solid var(--rule)">
            <span>${dot(w.topic.subject)} <a href="#/topic/${w.topic.id}">${w.topic.name}</a></span>
            <span class="small">${pct(w.stat!.accuracy)} · <b>~${w.lost!.toFixed(1)}</b> marks/paper</span></div>`) : html`<p class="muted small">Need at least 4 attempts per topic.</p>`}
        </section>
        <section class="paper"><h2>Weakest question types</h2>
          ${types.length ? types.map((t) => html`<div class="spread" style="padding:.35rem 0;border-bottom:1px solid var(--rule)">
            <span><a href="#/topic/${t.topic}/practice">${TOPIC_MAP[t.topic]?.name}</a> · ${t.type.replace(/-/g, ' ')}</span><span class="small">${pct(t.acc)} of ${t.n}</span></div>`) : html`<p class="muted small">Need at least 3 attempts per type.</p>`}
          ${wrong ? html`<p class="trap small" style="margin-top:1rem"><b>${careless}</b> of your ${wrong} wrong answers took less than a third of the target time. Slow down on those: they are likely careless errors.</p>` : nothing}
        </section>
      </div>

      ${SUBJECT_ORDER.filter((s) => EXAMS[exam].sections.some((x) => x.subject === s)).map((s) => html`
        <section class="paper" style="margin-bottom:1rem"><h2>${dot(s)} ${SUBJECTS[s].name}</h2>
          <table style="display:table;width:100%"><thead><tr><th>Topic</th><th>Done</th><th>Accuracy</th><th>Avg time</th></tr></thead><tbody>
          ${topicsOf(s).filter((t) => stats[t.id]).map((t) => { const x = stats[t.id]; return html`<tr>
            <td><a href="#/topic/${t.id}">${t.name}</a></td><td>${x.attempts}</td>
            <td><span class="row">${accBar(x.accuracy)} ${pct(x.accuracy)}</span></td>
            <td class=${x.slow ? 'chip medium' : ''}>${Math.round(x.avgSec)}s <span class="muted small">/ ${TARGET_SEC[s]}s</span></td></tr>`; })}
          </tbody></table>
          ${!topicsOf(s).some((t) => stats[t.id]) ? html`<p class="muted small">No attempts yet.</p>` : nothing}
        </section>`)}`}
    </div>`, el);
  };
  draw();
}
