// Installing the web app ("Add to Home Screen") and app updates.
import { html, nothing } from 'lit-html';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export const onInstallChange = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = () => window.matchMedia('(max-width: 760px)').matches || isIOS() || /Android/.test(navigator.userAgent);

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}

export async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null; emit();
  return outcome === 'accepted';
}

const SHARE = html`<svg viewBox="0 0 24 24" width="18" height="18" aria-label="Share" style="vertical-align:-3px"><path d="M12 3v12 M7 8l5-5 5 5 M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Platform-specific install instructions / button. `compact` = one-line banner. */
export function installHelp(compact = false, onDone?: () => void) {
  if (isStandalone()) return compact ? nothing : html`<p class="tip">Installed ✓ You're using CGL Prep as an app.</p>`;
  if (deferred) {
    return html`<div class=${compact ? 'row' : 'stack'}>
      ${compact ? nothing : html`<p class="small">Install CGL Prep on this device: it opens full screen from your home screen and works offline.</p>`}
      <button class="btn primary ${compact ? 'sm' : ''}" @click=${async () => { if (await promptInstall()) onDone?.(); }}>Install app</button>
    </div>`;
  }
  if (isIOS()) {
    return html`<div class=${compact ? '' : 'stack'}>
      ${compact ? nothing : html`<p class="small">Add CGL Prep to your Home Screen: it opens full screen like an app and works offline.</p>`}
      <ol class="install-steps">
        <li>Tap ${SHARE} <b>Share</b> in Safari's toolbar</li>
        <li>Choose <b>Add to Home Screen</b>, then <b>Add</b></li>
      </ol>
    </div>`;
  }
  return compact ? nothing : html`<p class="small muted">Open this site in Chrome (Android, Windows, Mac) or Safari (iPhone, iPad) to install it as an app.</p>`;
}

/** Should Today show the dismissible install banner? */
export function shouldOfferInstall() {
  if (isStandalone() || !isMobile()) return false;
  try { if (localStorage.getItem('cglprep:install-dismissed')) return false; } catch { /* ignore */ }
  return !!deferred || isIOS();
}
export const dismissInstall = () => { try { localStorage.setItem('cglprep:install-dismissed', '1'); } catch { /* ignore */ } };

// ---------------------------------------------------------------- updates
export function registerServiceWorker(showUpdate: (apply: () => void) => void) {
  if (!('serviceWorker' in navigator)) return;
  // Reload only when the student tapped "Update". On the very first visit the worker also takes control
  // (clients.claim), and reloading then would yank a new user mid-action.
  let updateRequested = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested) return;
    updateRequested = false;
    location.reload();
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const offer = (w: ServiceWorker) => showUpdate(() => { updateRequested = true; w.postMessage('skip-waiting'); });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
      // installed apps can stay open for days: check for a new version when brought back to the foreground
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    } catch (e) { console.warn('SW registration failed', e); }
  });
}
