// The "Report a mistake" dialog under every solution.
import { html, render } from 'lit-html';
import type { Question } from '../core/types';
import { REPORT_REASONS, reportMistake, type ReportReason } from '../data/reports';
import { auth, setReturnTo } from '../app/auth';

export function openReportDialog(q: Pick<Question, 'id' | 'rev'>) {
  const d = document.createElement('dialog');
  d.className = 'report-dialog';
  document.body.append(d);
  let reason: ReportReason | null = null;
  let note = '';
  let state: 'form' | 'sending' | 'sent' | 'duplicate' = 'form';
  let error = '';

  const close = () => d.close();
  const send = async () => {
    if (!reason) return;
    state = 'sending'; error = ''; draw();
    try { state = await reportMistake(q, reason, note); } catch (e) { state = 'form'; error = (e as Error).message; }
    draw();
  };
  const signIn = () => { setReturnTo(location.hash); close(); location.hash = '#/account'; };

  const draw = () => render(html`
    <h3 style="margin-top:0">Report a mistake</h3>
    ${!auth.user ? html`
      <p>Sign in so we can tell you when it is fixed. Your progress stays on this phone either way.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" @click=${close}>Not now</button><button class="btn primary" @click=${signIn}>Sign in</button></div>`
    : state === 'sent' || state === 'duplicate' ? html`
      <p>${state === 'sent' ? 'Thank you. We check every report and fix the question in the next content update.' : 'You have already reported this question. We will look at it.'}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" @click=${close}>Done</button></div>`
    : html`
      <p class="muted" style="margin-top:0">What is wrong with this question?</p>
      <div class="stack" role="radiogroup" aria-label="What is wrong">
        ${REPORT_REASONS.map(([value, label]) => html`
          <label class="choice-line"><input type="radio" name="reason" .checked=${reason === value} @change=${() => { reason = value; draw(); }}> ${label}</label>`)}
      </div>
      <label class="field" style="margin-top:.8rem"><span>Details (optional)</span>
        <textarea rows="3" maxlength="500" placeholder="For example: the answer should be C because 25% of 480 is 120." .value=${note} @input=${(e: Event) => { note = (e.target as HTMLTextAreaElement).value; }}></textarea></label>
      ${error ? html`<p class="trap" role="alert">${error}</p>` : null}
      <div class="row" style="justify-content:flex-end;margin-top:.6rem">
        <button class="btn" @click=${close}>Cancel</button>
        <button class="btn primary" ?disabled=${!reason || state === 'sending'} @click=${send}>${state === 'sending' ? 'Sending' : 'Send report'}</button>
      </div>`}`, d);

  d.addEventListener('close', () => d.remove());
  draw();
  d.showModal();
}
