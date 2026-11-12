import { html, render } from 'lit-html';
import type { ExamId, Settings } from '../core/types';
import { app } from '../app/state';
import { toast } from '../app/router';
import { getManifest } from '../content/bank';
import { confirmDialog } from '../ui/components';
import { applyTheme } from '../ui/theme';

export default function settings(el: HTMLElement) {
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
      if (!(await confirmDialog('Replace all progress on this device with the backup?', 'Restore'))) return;
      await app.importAll(data);
      applyTheme(app.settings.theme);
      toast('Backup restored');
      draw();
    } catch (err) { toast((err as Error).message || 'Could not read that file'); }
  };

  const draw = () => {
    const s = app.settings;
    render(html`<div class="page" style="max-width:720px">
      <h1>Settings</h1>
      <section class="paper stack">
        <h2>You</h2>
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
        <label class="row"><input type="checkbox" .checked=${s.paper2} @change=${(e: Event) => save({ paper2: (e.target as HTMLInputElement).checked })} /> Show Statistics (Paper 2, for JSO / SI Gr. II)</label>
      </section>
      <section class="paper stack" style="margin-top:1rem">
        <h2>Appearance</h2>
        <div class="seg">${(['auto', 'light', 'dark'] as const).map((t) => html`<button class=${s.theme === t ? 'on' : ''} @click=${() => save({ theme: t })}>${t[0].toUpperCase() + t.slice(1)}</button>`)}</div>
      </section>
      <section class="paper stack" style="margin-top:1rem">
        <h2>Your data</h2>
        <p class="small muted">Progress is stored on this device only (${app.attempts.length} answers, ${app.mocks.size} mocks). Download a backup to move it to another device.</p>
        <div class="row">
          <button class="btn" @click=${exportFile}>Download backup</button>
          <label class="btn">Restore from file<input type="file" accept="application/json" hidden @change=${importFile} /></label>
          <button class="btn danger" @click=${async () => { if (await confirmDialog('Delete all progress on this device? This cannot be undone.', 'Delete everything')) { await app.wipe(); toast('All progress deleted'); draw(); } }}>Reset progress</button>
        </div>
      </section>
      <p class="small muted" style="margin-top:1rem">Content version ${getManifest()?.version ?? '—'} · Test data, not yet reviewed by a subject expert.</p>
    </div>`, el);
  };
  draw();
}
