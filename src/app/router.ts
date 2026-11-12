// Hash router (works unchanged inside Capacitor). Each route mounts a view into #main.
import { render, html, svg, type TemplateResult } from 'lit-html';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type View = (el: HTMLElement, params: string[]) => any;

interface Route { pattern: RegExp; nav: string; title: string; parent: string | null; view: () => Promise<View> }
const routes: Route[] = [];
let cleanup: (() => void) | void;

/**
 * @param nav     which bottom tab is highlighted ('' = none, e.g. Profile)
 * @param title   top-bar title (views may override with setTitle)
 * @param parent  where Back goes when there is no history; null = a root tab (no Back button)
 */
export function route(path: string, nav: string, title: string, parent: string | null, view: () => Promise<View>) {
  const pattern = new RegExp('^' + path.replace(/:\w+\??/g, (m) => (m.endsWith('?') ? '?([^/]*)' : '([^/]+)')) + '/?$');
  routes.push({ pattern, nav, title, parent, view });
}

export const go = (hash: string) => { location.hash = hash; };

const I = (d: TemplateResult) => d;
export const NAV: { id: string; label: string; href: string; icon: TemplateResult }[] = [
  { id: 'today', label: 'Today', href: '#/', icon: I(svg`<path d="M4 10l8-6 8 6v10H4z M9 20v-6h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: 'roadmap', label: 'Roadmap', href: '#/roadmap', icon: I(svg`<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z M9 4v14 M15 6v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: 'study', label: 'Study', href: '#/study', icon: I(svg`<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: 'mocks', label: 'Mocks', href: '#/mocks', icon: I(svg`<path d="M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5" fill="none" stroke="currentColor" stroke-width="2"/>`) },
  { id: 'progress', label: 'Progress', href: '#/progress', icon: I(svg`<path d="M4 20V10 M10 20V4 M16 20v-7 M22 20H2" fill="none" stroke="currentColor" stroke-width="2"/>`) },
];

const AVATAR = svg`<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" stroke-width="2"/>`;

function renderNav(active: string) {
  const t = html`${NAV.map((n) => html`<a href=${n.href} class=${n.id === active ? 'on' : ''} aria-current=${n.id === active ? 'page' : 'false'}>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${n.icon}</svg><span>${n.label}</span></a>`)}`;
  render(t, document.getElementById('rail-nav')!);
  render(t, document.getElementById('tabbar')!);
}

let current: Route | null = null;
let titleOverride: string | null = null;
let arrivedInApp = false; // true once we've navigated at least once inside the app (history.back is safe)

function renderTopbar() {
  const el = document.getElementById('topbar');
  if (!el || !current) return;
  const title = titleOverride ?? current.title;
  const back = () => { if (arrivedInApp && history.length > 1) history.back(); else go(current!.parent ?? '#/'); };
  render(html`
    ${current.parent !== null
      ? html`<button class="tb-back" aria-label="Back" @click=${back}><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
      : html`<span class="tb-brand">CGL <b>Prep</b></span>`}
    <div class="tb-title" aria-hidden="true">${current.parent !== null ? title : ''}</div>
    <a class="tb-avatar" href="#/profile" aria-label="Profile and settings"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${AVATAR}</svg></a>`, el);
  document.title = title === 'Today' ? 'CGL Prep' : `${title} · CGL Prep`;
}

/** Views call this to show a specific title (e.g. the topic name). */
export function setTitle(t: string) { titleOverride = t; renderTopbar(); }

export async function dispatch() {
  const main = document.getElementById('main')!;
  const path = location.hash.replace(/^#/, '') || '/';
  if (typeof cleanup === 'function') cleanup();
  cleanup = undefined;
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (!m) continue;
    if (current) arrivedInApp = true;
    current = r; titleOverride = null;
    renderNav(r.nav);
    renderTopbar();
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
