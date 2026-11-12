import { amIAdmin } from '../data/admin';
import { html, render } from 'lit-html';
import type { ExamId, Settings } from '../core/types';
import { app } from '../app/state';
import { toast } from '../app/router';
import { getManifest } from '../content/bank';
import { confirmDialog } from '../ui/components';
import { applyTheme } from '../ui/theme';
import { auth } from '../app/auth';
import { startTour } from '../ui/tour';
import { installHelp, onInstallChange } from '../ui/install';
import { go } from '../app/router';

export default function settings(el: HTMLElement) {
  let isAdmin = false;
  amIAdmin().then((x) => { if (x) { isAdmin = true; draw(); } }).catch(() => {});
  const save = async (patch: Partial<Settings>) => {
    await app.saveSettings(patch);
    if (patch.theme) applyTheme(patch.theme);
    toast('Saved');
    draw();
  };
  const exportFile = async () => {
    const data = await app.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cgl-prep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importFile = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const ask = auth.user
        ? 'Restore the backup? It replaces the progress on this device and is added to your account; answers and mocks already in your account stay, and the backup\'s settings replace your account settings.'
        : 'Replace all progress on this device with the backup?';
      if (!(await confirmDialog(ask, 'Restore'))) return;
      await app.importAll(data);
      applyTheme(app.settings.theme);
      toast('Backup restored');
      draw();
    } catch (err) { toast((err as Error).message || 'Could not read that file'); }
  };

  const draw = () => {
    const s = app.settings;
    render(html`<div class="page" style="max-width:720px">
      <h1>Profile</h1>
      ${auth.enabled ? html`<a class="ticket" href="#/account" style="display:block;text-decoration:none;color:inherit;margin-bottom:1rem">
        <div class="kicker">Account & sync</div>
        <b>${auth.user ? auth.user.email : 'Sign in to sync your progress across devices'}</b></a>` : ''}
      ${isAdmin ? html`<p><a href="#/admin">Open the admin dashboard</a></p>` : ''}
      <section class="paper stack">
        <h2>Your exam</h2>
        <label class="field">Name<input type="text" .value=${s.name} @change=${(e: Event) => save({ name: (e.target as HTMLInputElement).value.trim().slice(0, 40) })} /></label>
        <label class="field">Main target
          <select @change=${(e: Event) => save({ target: (e.target as HTMLSelectElement).value as ExamId })}>
            <option value="pre" ?selected=${s.target === 'pre'}>Tier 1 (Pre)</option>
            <option value="mains" ?selected=${s.target === 'mains'}>Tier 2 Paper 1 (Mains)</option>
            <option value="stats" ?selected=${s.target === 'stats'} ?disabled=${!s.paper2}>Tier 2 Paper 2 (Statistics)</option>
          </select></label>
        <label class="field">Exam date<input type="date" .value=${s.examDate ?? ''} @change=${(e: Event) => save({ examDate: (e.target as HTMLInputElement).value || null })} /></label>
        <label class="field">Study hours per day<input type="number" min="1" max="14" .value=${String(s.dailyHours)} @change=${(e: Event) => save({ dailyHours: Math.min(14, Math.max(1, Number((e.target as HTMLInputElement).value) || 3)) })} /></label>
        <label class="field">New flashcards per deck per day<input type="number" min="0" max="50" .value=${String(s.newWordsPerDay)} @change=${(e: Event) => save({ newWordsPerDay: Math.min(50, Math.max(0, Number((e.target as HTMLInputElement).value) || 0)) })} /></label>
        <label class="check"><input type="checkbox" .checked=${s.examMode} @change=${(e: Event) => save({ examMode: (e.target as HTMLInputElement).checked })} /> Exam mode for mocks (full screen; leaving the test is counted and shown in results)</label>
        <label class="check"><input type="checkbox" .checked=${s.paper2} @change=${(e: Event) => save({ paper2: (e.target as HTMLInputElement).checked })} /> Show Statistics (Paper 2, for JSO / SI Gr. II)</label>
      </section>
      <section class="paper stack" style="margin-top:1rem">
        <h2>Install the app</h2>
        ${installHelp(false, () => draw())}
      </section>
      <section class="paper stack" style="margin-top:1rem">
        <h2>Help</h2>
        <p class="small muted">A 30-second walkthrough of what each tab does.</p>
        <button class="btn" @click=${() => { go('#/'); setTimeout(() => startTour(() => app.saveSettings({ toured: true })), 300); }}>Take the app tour</button>
      </section>
      <section class="paper stack" style="margin-top:1rem">
        <h2>Appearance</h2>
        <div class="seg">${(['light', 'dark'] as const).map((t) => html`<button class=${(s.theme === 'dark' ? 'dark' : 'light') === t ? 'on' : ''} @click=${() => save({ theme: t })}>${t === 'light' ? 'Light' : 'Dark (night study)'}</button>`)}</div>
      </section>
      <section class="paper stack" style="margin-top:1rem">
        <h2>Your data</h2>
        <p class="small muted">${auth.user ? `Progress is saved on this device and synced to your account (${app.attempts.length} answers, ${app.mocks.size} mocks).` : `Progress is stored on this device only (${app.attempts.length} answers, ${app.mocks.size} mocks). Sign in to sync it, or download a backup.`}</p>
        <div class="row">
          <button class="btn" @click=${exportFile}>Download backup</button>
          <label class="btn">Restore from file<input type="file" accept="application/json" hidden @change=${importFile} /></label>
          <button class="btn danger" @click=${async () => { if (await confirmDialog(auth.user ? 'Delete all progress on this device AND in your account on all devices? This cannot be undone.' : 'Delete all progress on this device? This cannot be undone.', 'Delete everything')) { await app.wipe(); toast('All progress deleted'); draw(); } }}>Reset progress</button>
        </div>
      </section>
      <p class="small muted" style="margin-top:1rem">Content version ${getManifest()?.version ?? '—'}. Test data, not yet reviewed by a subject expert.</p>
    </div>`, el);
  };
  draw();
  const off = onInstallChange(draw);
  return () => { off(); };
}
