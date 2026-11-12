// Admin dashboard (#/admin): how the app is doing, questions whose key may be wrong, and the report queue.
// The server checks admin rights on every call; this page only decides what to show.
import { html, render, svg, nothing, type TemplateResult } from 'lit-html';
import { auth } from '../app/auth';
import { toast } from '../app/router';
import { TOPIC_MAP } from '../core/syllabus';
import type { Question } from '../core/types';
import { ensureQuestions, getManifest, lookup } from '../content/bank';
import { getPyqManifest, loadPyqManifest } from '../content/pyq';
import { amIAdmin, getOverview, getQuestionHealth, getReports, getTopicStats, resolveQuestion,
  type HealthRow, type Overview, type ReportRow, type TopicRow } from '../data/admin';
import { REPORT_REASONS } from '../data/reports';
import { LETTERS, pct } from '../ui/html';
import { questionView } from '../ui/components';

const n = (x: number) => x.toLocaleString('en-IN');
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;
const reasonLabel = Object.fromEntries(REPORT_REASONS) as Record<string, string>;
const topicName = (id: string) => TOPIC_MAP[id]?.name ?? id;

/** Daily bars: one value per day, the last day labelled. Plain SVG, theme colours. */
function bars(rows: { day: string; v: number }[], label: string): TemplateResult {
  const max = Math.max(1, ...rows.map((r) => r.v));
  const w = 300, h = 64, gap = 2, bw = (w - gap * (rows.length - 1)) / Math.max(1, rows.length);
  const total = rows.reduce((a, r) => a + r.v, 0);
  return html`<figure class="admin-chart">
    <figcaption>${label}: ${n(total)} in ${rows.length} days, ${n(rows.at(-1)?.v ?? 0)} today</figcaption>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label=${label}>
      ${rows.map((r, i) => svg`<rect x=${i * (bw + gap)} y=${h - Math.max(r.v > 0 ? 2 : 0, (r.v / max) * h)} width=${bw} height=${Math.max(r.v > 0 ? 2 : 0, (r.v / max) * h)} rx="1"><title>${r.day}: ${r.v}</title></rect>`)}
    </svg></figure>`;
}

export default async function admin(el: HTMLElement) {
  let allowed: boolean | null = null;
  let error = '';
  let ov: Overview | null = null;
  let health: HealthRow[] = [];
  let topics: TopicRow[] = [];
  let reports: ReportRow[] = [];
  let reportStatus: ReportRow['status'] = 'open';
  const open = new Map<string, Question | 'missing' | 'loading'>();

  const load = async () => {
    error = '';
    try {
      allowed = await amIAdmin();
      if (!allowed) { draw(); return; }
      [ov, health, topics, reports] = await Promise.all([getOverview(30), getQuestionHealth(5), getTopicStats(30), getReports(reportStatus), loadPyqManifest()]);
    } catch (e) { error = (e as Error).message; }
    draw();
  };

  const toggle = async (qid: string) => {
    if (open.has(qid)) { open.delete(qid); draw(); return; }
    open.set(qid, 'loading'); draw();
    try { await ensureQuestions([qid]); } catch { /* shown as missing */ }
    open.set(qid, lookup(qid) ?? 'missing'); draw();
  };
  const resolve = async (qid: string, status: ReportRow['status']) => {
    try {
      const k = await resolveQuestion(qid, status);
      toast(`${plural(k, 'report')} marked ${status}`);
      reports = await getReports(reportStatus); ov = await getOverview(30);
    } catch (e) { toast((e as Error).message); }
    draw();
  };

  const questionBlock = (qid: string) => {
    const q = open.get(qid);
    if (!q) return nothing;
    if (q === 'loading') return html`<p class="muted">Loading the question</p>`;
    if (q === 'missing') return html`<p class="trap">This question is not in the current content. It may have been removed or renamed.</p>`;
    return html`<div class="admin-q">${questionView(q, { chosen: null, reveal: true, review: true })}
      <p class="muted small">Answer key: ${LETTERS[q.answer]}. Version ${q.rev ?? 1}. Source: ${q.source ?? 'ours'}.</p></div>`;
  };

  const summary = (o: Overview) => html`
    <p class="lead">${plural(o.users, 'person', 'people')} have an account and ${n(o.signedInOnce)} have signed in at least once.
      ${plural(o.new7d, 'new account')} this week.</p>
    <p>${n(o.active7d)} studied in the last 7 days (${n(o.active1d)} in the last day, ${n(o.active30d)} in 30 days), and
      ${n(o.returning7d)} of them came back on two or more days.
      They answered ${plural(o.answers7d, 'question')}${o.accuracy7d !== null ? html` with ${pct(o.accuracy7d)} right` : nothing}
      and submitted ${plural(o.mocksSubmitted7d, 'mock')} (${n(o.mocksSubmitted)} in total).</p>
    <p>${plural(o.challenges, 'challenge')} created, ${plural(o.challengeScores, 'score')} posted.
      ${o.reportsOpen ? html`<b>${plural(o.reportsOpen, 'open report')} on ${plural(o.reportsOpenQuestions, 'question')}.</b>` : 'No open reports.'}</p>`;

  const contentLine = () => {
    const m = getManifest(), p = getPyqManifest();
    const ours = m ? Object.values(m.topics).reduce((a, t) => a + t.questions, 0) : 0;
    const moved = p?.moved ? Object.values(p.moved).reduce((a, x) => a + x.length, 0) : 0;
    return html`<p class="muted small">Content version ${m?.version ?? 'unknown'}: ${plural(ours, 'practice question')}.
      Past-paper bank ${p?.version ?? 'not loaded'}: ${n(p?.counts.questions ?? 0)} questions from ${n(p?.counts.papers ?? 0)} papers${moved ? html`, ${n(moved)} moved to a corrected topic` : nothing}.</p>`;
  };

  const reportGroups = () => {
    const by = new Map<string, ReportRow[]>();
    for (const r of reports) by.set(r.question_id, [...(by.get(r.question_id) ?? []), r]);
    return [...by].sort((a, b) => b[1].length - a[1].length);
  };

  const draw = () => {
    if (!auth.enabled) { render(html`<div class="page"><h1>Admin</h1><p>This build has no account service.</p></div>`, el); return; }
    if (!auth.user) { render(html`<div class="page"><h1>Admin</h1><p>Sign in with the admin account to see this page. <a href="#/account">Go to sign in</a></p></div>`, el); return; }
    if (allowed === false) { render(html`<div class="page"><h1>Admin</h1><p>This account is not an admin. <a href="#/">Back to Today</a></p></div>`, el); return; }
    const groups = reportGroups();
    render(html`<div class="page admin" style="max-width:860px">
      <div class="row" style="justify-content:space-between"><h1>Admin</h1><button class="btn sm" @click=${() => { allowed = null; draw(); load(); }}>Refresh</button></div>
      ${error ? html`<p class="trap" role="alert">${error}</p>` : nothing}
      ${allowed === null || (!ov && !error) ? html`<p class="muted">Loading</p>` : nothing}
      ${ov ? html`
        <section class="paper stack">
          <h2>This week</h2>
          ${summary(ov)}
          <div class="admin-charts">
            ${bars(ov.daily.map((d) => ({ day: d.day, v: d.active })), 'Students active per day')}
            ${bars(ov.daily.map((d) => ({ day: d.day, v: d.signups })), 'New accounts per day')}
            ${bars(ov.daily.map((d) => ({ day: d.day, v: d.answers })), 'Questions answered per day')}
            ${bars(ov.daily.map((d) => ({ day: d.day, v: d.mocks })), 'Mocks submitted per day')}
          </div>
          ${contentLine()}
        </section>

        <section class="paper stack">
          <div class="row" style="justify-content:space-between">
            <h2>Reported questions</h2>
            <select aria-label="Which reports" @change=${async (e: Event) => { reportStatus = (e.target as HTMLSelectElement).value as ReportRow['status']; reports = await getReports(reportStatus).catch(() => []); draw(); }}>
              ${(['open', 'fixed', 'rejected'] as const).map((s) => html`<option value=${s} ?selected=${s === reportStatus}>${s[0].toUpperCase() + s.slice(1)}</option>`)}
            </select>
          </div>
          ${!groups.length ? html`<p class="muted">${reportStatus === 'open' ? 'Nothing to review. Reports appear here when students use "Report a mistake" under a solution.' : `No ${reportStatus} reports.`}</p>` : nothing}
          ${groups.map(([qid, rs]) => html`
            <article class="admin-item">
              <p><b>${plural(rs.length, 'report')}</b> on <code>${qid}</code> (${topicName(qid.split(':')[1] ?? qid.replace(/-\d+$/, ''))})</p>
              <ul class="admin-notes">${rs.map((r) => html`<li>${reasonLabel[r.reason] ?? r.reason}${r.note ? html`: <q>${r.note}</q>` : nothing}
                <span class="muted small">${new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></li>`)}</ul>
              <div class="row">
                <button class="btn sm" @click=${() => toggle(qid)}>${open.has(qid) ? 'Hide question' : 'Show question'}</button>
                ${reportStatus === 'open' ? html`
                  <button class="btn sm" @click=${() => resolve(qid, 'fixed')}>Mark fixed</button>
                  <button class="btn sm ghost" @click=${() => resolve(qid, 'rejected')}>Not a mistake</button>`
                : html`<button class="btn sm ghost" @click=${() => resolve(qid, 'open')}>Reopen</button>`}
              </div>
              ${questionBlock(qid)}
            </article>`)}
        </section>

        <section class="paper stack">
          <h2>Answer keys to check</h2>
          <p class="muted">Questions answered at least 5 times where under 30% got it right, or where half the answers picked the same wrong option. A shared wrong option often means the key is wrong.</p>
          ${!health.length ? html`<p class="muted">None yet. This fills in as students answer questions.</p>` : html`
            <div class="table-scroll"><table class="admin-table"><thead><tr><th>Question</th><th>Answers</th><th>Right</th><th>Most picked wrong</th></tr></thead>
              <tbody>${health.map((h) => html`
                <tr><td><button class="linkish" @click=${() => toggle(h.question_id)}>${h.question_id}</button><br><span class="muted small">${topicName(h.topic)}${h.reports ? html`, ${plural(h.reports, 'open report')}` : nothing}</span></td>
                  <td>${n(h.answers)}</td><td>${pct(h.accuracy)}</td><td>${h.top_wrong !== null ? html`${LETTERS[h.top_wrong]} (${pct(h.top_wrong_share)})` : 'none'}</td></tr>
                ${open.has(h.question_id) ? html`<tr><td colspan="4">${questionBlock(h.question_id)}</td></tr>` : nothing}`)}</tbody></table></div>`}
        </section>

        <section class="paper stack">
          <h2>Topics, hardest first (30 days)</h2>
          ${!topics.length ? html`<p class="muted">No answers in the last 30 days.</p>` : html`
            <div class="table-scroll"><table class="admin-table"><thead><tr><th>Topic</th><th>Students</th><th>Answers</th><th>Right</th><th>Time each</th></tr></thead>
              <tbody>${topics.map((t) => html`<tr><td>${topicName(t.topic)}</td><td>${n(t.users)}</td><td>${n(t.answers)}</td><td>${pct(t.accuracy)}</td><td>${t.avg_seconds}s</td></tr>`)}</tbody></table></div>`}
        </section>` : nothing}
    </div>`, el);
  };

  draw();
  await auth.ready;
  load();
  const off = auth.onChange(() => { allowed = null; draw(); load(); });
  return () => off();
}
