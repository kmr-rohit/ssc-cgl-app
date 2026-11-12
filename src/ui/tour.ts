// Guided app tour: spotlights each tab with one sentence. Skippable (Skip / Esc), keyboard friendly, replayable from Profile.
import { html, render, nothing } from 'lit-html';

export interface TourStep {
  /** CSS selector of the element to spotlight; null = centred card with no spotlight */
  target: string | null;
  title: string;
  body: string;
}

const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
const navSel = (href: string) => () => `${isMobile() ? '#tabbar' : '#rail-nav'} a[href="${href}"]`;

export const STEPS: (Omit<TourStep, 'target'> & { target: string | null | (() => string) })[] = [
  { target: null, title: 'Your roadmap is ready 🎯', body: 'Here is a 30-second tour of the app. You can skip it and replay it any time from your profile.' },
  { target: navSel('#/'), title: 'Today', body: "Open this every day. It lists today's tasks (a topic to study, mistakes to fix, flashcards, a mock) and ticks them off as you work." },
  { target: navSel('#/roadmap'), title: 'Roadmap', body: 'Your week-by-week plan to exam day. High-weightage topics come first, and topics you already know well get less time.' },
  { target: navSel('#/study'), title: 'Study', body: 'Every topic with easy notes, solved examples and practice at three levels, plus flashcards and formula sheets.' },
  { target: navSel('#/mocks'), title: 'Mocks', body: 'A full Tier 1 and Tier 2 paper every day, in the real SSC screen format with sectional timers. Sectional tests too.' },
  { target: navSel('#/progress'), title: 'Progress', body: 'Your scores, accuracy and speed by topic, the topics losing you the most marks, and every mistake to retry.' },
  { target: () => (isMobile() ? '.topbar .tb-avatar' : '#account-badge'), title: 'Profile', body: 'Change your exam date or hours, sign in to sync across phone and laptop, and back up your progress.' },
  { target: null, title: "You're all set", body: "Start with the first task on Today. Little and often beats long and rare: aim to tick everything off each day." },
];

let host: HTMLElement | null = null;

export function startTour(onDone: () => void) {
  if (host) return;
  host = document.createElement('div');
  host.className = 'tour';
  document.body.append(host);
  let i = 0;
  const prevFocus = document.activeElement as HTMLElement | null;

  const finish = () => {
    window.removeEventListener('resize', draw);
    window.removeEventListener('hashchange', finish);
    document.removeEventListener('keydown', onKey, true);
    host?.remove(); host = null;
    prevFocus?.focus?.();
    onDone();
  };
  const next = () => { if (i < STEPS.length - 1) { i++; draw(); } else finish(); };
  const back = () => { if (i > 0) { i--; draw(); } };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); finish(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  };

  function draw() {
    if (!host) return;
    const step = STEPS[i];
    const sel = typeof step.target === 'function' ? step.target() : step.target;
    const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
    const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
    const pad = 6;
    const vw = window.innerWidth, vh = window.innerHeight;
    // card placement: above a bottom-tab target, beside a rail target, centred otherwise
    let cardStyle = 'left:50%;top:50%;transform:translate(-50%,-50%)';
    if (r) {
      const w = Math.min(340, vw - 32);
      if (r.top > vh / 2) {
        const left = Math.max(16, Math.min(vw - w - 16, r.left + r.width / 2 - w / 2));
        cardStyle = `left:${left}px;bottom:${vh - r.top + 14}px;width:${w}px`;
      } else if (r.right + w + 24 < vw) {
        cardStyle = `left:${r.right + 18}px;top:${Math.max(16, r.top - 8)}px;width:${w}px`;
      } else {
        const left = Math.max(16, Math.min(vw - w - 16, r.left + r.width / 2 - w / 2));
        cardStyle = `left:${left}px;top:${r.bottom + 14}px;width:${w}px`;
      }
    }
    render(html`
      ${r ? (() => {
        // keep the highlight inside the viewport (e.g. the avatar sits at the very edge on phones)
        const x1 = Math.max(2, r.left - pad), y1 = Math.max(2, r.top - pad);
        const x2 = Math.min(vw - 2, r.right + pad), y2 = Math.min(vh - 2, r.bottom + pad);
        return html`<div class="tour-spot" style="left:${x1}px;top:${y1}px;width:${x2 - x1}px;height:${y2 - y1}px"></div>`;
      })()
          : html`<div class="tour-dim"></div>`}
      <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" style=${cardStyle}>
        <div class="kicker">Step ${i + 1} of ${STEPS.length}</div>
        <h2 id="tour-title">${step.title}</h2>
        <p id="tour-body">${step.body}</p>
        <div class="tour-dots" aria-hidden="true">${STEPS.map((_, k) => html`<i class=${k === i ? 'on' : ''}></i>`)}</div>
        <div class="spread">
          ${i < STEPS.length - 1 ? html`<button class="btn ghost sm" @click=${finish}>Skip tour</button>` : html`<span></span>`}
          <span class="row">
            ${i > 0 ? html`<button class="btn sm" @click=${back}>Back</button>` : nothing}
            <button class="btn primary sm tour-next" @click=${next}>${i === 0 ? 'Show me' : i === STEPS.length - 1 ? "Let's start" : 'Next'}</button>
          </span>
        </div>
      </div>`, host);
    (host.querySelector('.tour-next') as HTMLElement | null)?.focus();
  }

  window.addEventListener('resize', draw);
  // the tour describes the Today screen: leaving it (a tab tap, a link, Back) ends the tour
  window.addEventListener('hashchange', finish);
  document.addEventListener('keydown', onKey, true);
  draw();
}

export const tourActive = () => !!host;
