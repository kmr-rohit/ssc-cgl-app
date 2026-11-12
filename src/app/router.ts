// Hash router (works unchanged inside Capacitor). Each route mounts a view into #main.
import { render, html, svg, type TemplateResult } from 'lit-html';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type View = (el: HTMLElement, params: string[]) => any;

interface Route { pattern: RegExp; nav: string; view: () => Promise<View> }
const routes: Route[] = [];
let cleanup: (() => void) | void;

export function route(path: string, nav: string, view: () => Promise<View>) {
  const pattern = new RegExp('^' + path.replace(/:\w+\??/g, (m) => (m.endsWith('?') ? '?([^/]*)' : '([^/]+)')) + '/?$');
  routes.push({ pattern, nav, view });
}

export const go = (hash: string) => { location.hash = hash; };

export const NAV: { id: string; label: string; href: string; icon: TemplateResult }[] = [
  { id: 'today', label: 'Today', href: '#/', icon: svg`<path d="M4 10l8-6 8 6v10H4z" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { id: 'syllabus', label: 'Syllabus', href: '#/syllabus', icon: svg`<path d="M5 4h11l3 3v13H5z M9 9h7 M9 13h7 M9 17h4" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { id: 'mocks', label: 'Mocks', href: '#/mocks', icon: svg`<path d="M4 6h16v12H4z M4 10h16 M8 14h4" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { id: 'revise', label: 'Revise', href: '#/revise', icon: svg`<path d="M6 5h12v14H6z M9 3v4 M15 3v4 M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { id: 'analysis', label: 'Analysis', href: '#/analysis', icon: svg`<path d="M4 20V10 M10 20V4 M16 20v-7 M22 20H2" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { id: 'settings', label: 'Settings', href: '#/settings', icon: svg`<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2" stroke="currentColor" stroke-width="2"/>` },
];

function renderNav(active: string) {
  const t = html`${NAV.map((n) => html`<a href=${n.href} class=${n.id === active ? 'on' : ''} aria-current=${n.id === active ? 'page' : 'false'}>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${n.icon}</svg><span>${n.label}</span></a>`)}`;
  render(t, document.getElementById('rail-nav')!);
  render(t, document.getElementById('tabbar')!);
}

export async function dispatch() {
  const main = document.getElementById('main')!;
  const path = location.hash.replace(/^#/, '') || '/';
  if (typeof cleanup === 'function') cleanup();
  cleanup = undefined;
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (!m) continue;
    renderNav(r.nav);
    document.body.dataset.route = r.nav;
    window.scrollTo(0, 0);
    try {
      const view = await r.view();
      // fresh host per route: lit-html keeps render state on the container
      const host = document.createElement('div');
      main.replaceChildren(host);
      cleanup = await view(host, m.slice(1).map((x) => decodeURIComponent(x ?? '')));
    } catch (e) {
      console.error(e);
      main.replaceChildren();
      render(html`<div class="page"><h1>Something went wrong</h1><p class="muted">${(e as Error).message}</p><a class="btn" href="#/">Go home</a></div>`, main);
    }
    return;
  }
  main.replaceChildren();
  render(html`<div class="page"><h1>Page not found</h1><a class="btn" href="#/">Go home</a></div>`, main);
}

let toastTimer: number | undefined;
export function toast(msg: string) {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
}
