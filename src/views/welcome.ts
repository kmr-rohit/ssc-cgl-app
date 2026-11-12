// First-run setup: 3 quick questions → personal roadmap.
import { html, render, nothing } from 'lit-html';
import type { ExamId } from '../core/types';
import { addDays, dayKey } from '../core/srs';
import { app } from '../app/state';
import { go } from '../app/router';
import { auth } from '../app/auth';

export default function welcome(el: HTMLElement) {
  const s = app.settings;
  let target: ExamId = s.target;
  let paper2 = s.paper2;
  let examDate: string | null = s.examDate;
  let hours = s.dailyHours || 3;
  let name = s.name;
  const today = dayKey();

  const finish = async (skip = false) => {
    await app.saveSettings(skip ? { onboarded: true } : { onboarded: true, target, paper2: paper2 || target === 'stats', examDate, dailyHours: hours, name: name.trim().slice(0, 40) });
    go('#/'); // Today, where the guided tour starts
  };

  const quick = [
    { label: '3 months', d: addDays(today, 90) },
    { label: '6 months', d: addDays(today, 182) },
    { label: '1 year', d: addDays(today, 365) },
  ];

  const draw = () => render(html`<div class="page" style="max-width:600px">
    <div class="kicker">Welcome to CGL Prep</div>
    <h1>Let's build your roadmap</h1>
    <p class="muted">Three quick questions. You can change these anytime in your profile.</p>

    <section class="paper stack">
      <div>
        <h2>1. Which exam are you preparing for?</h2>
        <div class="choice-grid">
          ${([['pre', 'Tier 1', 'Prelims · 100 Qs · 60 min'], ['mains', 'Tier 2', 'Mains Paper 1 · 150 Qs']] as const).map(([id, t, sub]) => html`
            <button class="choice ${target === id ? 'on' : ''}" aria-pressed=${target === id} @click=${() => { target = id; draw(); }}><b>${t}</b><span>${sub}</span></button>`)}
        </div>
        <label class="check small" style="margin-top:.6rem"><input type="checkbox" .checked=${paper2} @change=${(e: Event) => { paper2 = (e.target as HTMLInputElement).checked; draw(); }} /> I'm also applying for JSO / Statistical Investigator (Paper 2: Statistics)</label>
      </div>

      <div>
        <h2>2. When is your exam?</h2>
        <div class="row">${quick.map((q) => html`<button class="btn sm ${examDate === q.d ? 'primary' : ''}" @click=${() => { examDate = q.d; draw(); }}>In ${q.label}</button>`)}</div>
        <label class="field" style="margin-top:.6rem">Or pick the date<input type="date" min=${today} .value=${examDate ?? ''} @change=${(e: Event) => { examDate = (e.target as HTMLInputElement).value || null; draw(); }} /></label>
        ${!examDate ? html`<p class="small muted">Not sure yet? Skip it and we'll plan for 12 weeks.</p>` : nothing}
      </div>

      <div>
        <h2>3. How many hours can you study each day?</h2>
        <div class="seg">${[1, 2, 3, 4, 6, 8].map((h) => html`<button class=${hours === h ? 'on' : ''} @click=${() => { hours = h; draw(); }}>${h === 8 ? '8+' : h}h</button>`)}</div>
      </div>

      <label class="field">Your name (optional)<input type="text" autocomplete="given-name" .value=${name} @input=${(e: Event) => (name = (e.target as HTMLInputElement).value)} /></label>

      <button class="btn primary" style="width:100%" @click=${() => finish()}>Create my roadmap</button>
      <button class="btn ghost sm" @click=${() => finish(true)}>Skip for now</button>
    </section>
    ${auth.enabled && !auth.user ? html`<p class="small muted" style="text-align:center;margin-top:1rem">Already using CGL Prep on another device? <a href="#/account">Sign in</a> to bring your progress.</p>` : nothing}
  </div>`, el);
  draw();
}
