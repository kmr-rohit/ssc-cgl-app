import { html, render, nothing } from 'lit-html';
import { app } from '../app/state';
import { auth, deleteAccount, sendEmailLink, signInWithGoogle, signOut, verifyEmailCode } from '../app/auth';
import { toast } from '../app/router';
import { confirmDialog } from '../ui/components';
import type { SyncStatus } from '../data/sync';

const GOOGLE = html`<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

export const syncText = (s: SyncStatus) =>
  s.state === 'syncing' ? 'Syncing…'
  : s.state === 'offline' ? `Offline${s.pending ? ` · ${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : ''}`
  : s.state === 'error' ? 'Sync problem: will retry'
  : s.state === 'idle' ? (s.pending ? `${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : `Synced${s.lastSync ? ` ${new Date(s.lastSync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}`)
  : '';

export default async function account(el: HTMLElement) {
  let email = '';
  let sent = false;
  let busy = false;
  let err = '';
  const sync = app.sync;

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return; // ignore double taps while a request is in flight
    busy = true; err = ''; draw();
    try { await fn(); } catch (e) { err = (e as Error).message; }
    busy = false; draw();
  };

  const draw = () => {
    if (!auth.enabled) {
      render(html`<div class="page" style="max-width:640px"><h1>Account</h1>
        <div class="paper"><p>Accounts aren't configured in this build. Your progress is saved on this device; use Settings → Download backup to move it.</p></div></div>`, el);
      return;
    }
    const u = auth.user;
    const s = sync?.status;
    render(html`<div class="page" style="max-width:640px">
      <h1>Account</h1>
      ${!u ? html`
        <section class="paper stack">
          <p>Sign in to keep your progress safe and use it on your phone, tablet and laptop. Everything you've done on this device so far will be uploaded to your account.</p>
          <button class="btn" style="width:100%" ?disabled=${busy} @click=${() => run(signInWithGoogle)}>${GOOGLE} Continue with Google</button>
          <div class="muted small" style="text-align:center">or</div>
          ${!sent ? html`
            <form class="stack" @submit=${(e: Event) => { e.preventDefault(); run(async () => { await sendEmailLink(email); sent = true; }); }}>
              <label class="field">Email<input type="email" required autocomplete="email" .value=${email} @input=${(e: Event) => { email = (e.target as HTMLInputElement).value.trim(); draw(); }} /></label>
              <button class="btn primary" ?disabled=${busy || !email}>Email me a sign-in link</button>
            </form>` : html`
            <div class="stack">
              <p class="tip">We sent an email to <b>${email}</b>. Open the link in it on this device to sign in.</p>
              <form class="row" @submit=${(e: Event) => { e.preventDefault(); const code = (e.target as HTMLFormElement).code.value; run(() => verifyEmailCode(email, code)); }}>
                <label class="field" style="flex:1">If the email has a 6-digit code, enter it here
                  <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" /></label>
                <button class="btn" ?disabled=${busy}>Verify</button>
              </form>
              <button class="btn ghost sm" @click=${() => { sent = false; draw(); }}>Use a different email</button>
            </div>`}
          ${err ? html`<p class="trap" role="alert">${err}</p>` : nothing}
          <p class="small muted">We only store your email and your practice data. No ads, no tracking.</p>
        </section>` : html`
        <section class="paper stack">
          <div class="spread"><div><div class="kicker">Signed in</div><b>${u.email}</b></div>
            <span class="chip">${s ? syncText(s) : ''}</span></div>
          <p class="small muted">Your answers, mocks, flashcards and settings sync automatically across your devices. The app keeps working offline and catches up when you're back online.</p>
          <div class="row">
            <button class="btn" ?disabled=${busy} @click=${() => run(async () => { await sync?.sync(); toast('Synced'); })}>Sync now</button>
            <button class="btn" ?disabled=${busy} @click=${() => run(async () => {
              const ok = await signOut(() => confirmDialog('Some changes haven\'t been uploaded yet (are you offline?). Sign out anyway? They stay on this device and upload next time you sign in here with this account.', 'Sign out'));
              if (ok) toast('Signed out');
            })}>Sign out</button>
          </div>
          ${err ? html`<p class="trap" role="alert">${err}</p>` : nothing}
        </section>
        <section class="paper stack" style="margin-top:1rem">
          <h2>Delete account</h2>
          <p class="small">Permanently deletes your account and all your progress from our servers and this device. This cannot be undone. Download a backup first (Settings) if you want to keep a copy.</p>
          <button class="btn danger" ?disabled=${busy} @click=${async () => {
            if (!(await confirmDialog(`Delete the account ${u.email} and all its progress? This cannot be undone.`, 'Delete my account'))) return;
            run(async () => { await deleteAccount(); toast('Account deleted'); });
          }}>Delete my account</button>
        </section>`}
    </div>`, el);
  };

  const offA = auth.onChange(draw);
  const offS = sync?.onStatus(() => draw());
  await auth.ready;
  draw();
  return () => { offA(); offS?.(); };
}
