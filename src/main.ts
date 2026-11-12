// Indian-made type: Martel (headings), Mukta (body), Kalam (red-pen notes). Latin subsets only for now.
import '@fontsource/martel/latin-800.css';
import '@fontsource/martel/latin-900.css';
import '@fontsource/mukta/latin-400.css';
import '@fontsource/mukta/latin-500.css';
import '@fontsource/mukta/latin-600.css';
import '@fontsource/mukta/latin-700.css';
import '@fontsource/kalam/latin-700.css';
import './ui/styles.css';
import { app } from './app/state';
import { dispatch, route } from './app/router';
import { loadManifest } from './content/bank';
import { loadPyqManifest } from './content/pyq';
import { applyTheme } from './ui/theme';
import { initInstall, registerServiceWorker } from './ui/install';
import { initAuth, auth } from './app/auth';
import { renderAccountBadge } from './ui/account-badge';

// route(path, tab, title, parent-for-Back (null = root tab), view)
const v = (f: () => Promise<{ default: unknown }>) => () => f().then((m) => m.default as never);
route('/', 'today', 'Today', null, v(() => import('./views/today')));
route('/welcome', '', 'Welcome', null, v(() => import('./views/welcome')));
route('/roadmap', 'roadmap', 'Roadmap', null, v(() => import('./views/plan')));
route('/plan', 'roadmap', 'Roadmap', null, v(() => import('./views/plan')));
route('/study', 'study', 'Study', null, v(() => import('./views/syllabus')));
route('/syllabus/:subject?', 'study', 'Study', null, v(() => import('./views/syllabus')));
route('/topic/:id/:tab?', 'study', 'Topic', '#/study', v(() => import('./views/topic')));
route('/practice', 'study', 'Practice', '#/study', v(() => import('./views/practice')));
route('/revise/:deck?', 'study', 'Flashcards', '#/study', v(() => import('./views/revise')));
route('/formulas/:id?', 'study', 'Formula sheets', '#/study', v(() => import('./views/formulas')));
route('/mocks', 'mocks', 'Mocks', null, v(() => import('./views/mocks')));
route('/exam/:key', 'mocks', 'Mock test', '#/mocks', v(() => import('./views/exam')));
route('/result/:key', 'mocks', 'Result', '#/mocks', v(() => import('./views/result')));
route('/progress', 'progress', 'Progress', null, v(() => import('./views/analysis')));
route('/analysis', 'progress', 'Progress', null, v(() => import('./views/analysis')));
route('/mistakes', 'progress', 'My mistakes', '#/progress', v(() => import('./views/mistakes')));
route('/profile', '', 'Profile', '#/', v(() => import('./views/settings')));
route('/settings', '', 'Profile', '#/', v(() => import('./views/settings')));
route('/account', '', 'Account', '#/profile', v(() => import('./views/account')));


async function boot() {
  await Promise.all([app.init(), loadManifest().catch((e) => console.error(e)), loadPyqManifest()]);
  applyTheme(app.settings.theme);
  if (app.sync) {
    initAuth(app.sync);
    // server data arrived: reload in-memory state and redraw, unless the user is mid-test or mid-practice
    app.sync.onPulled = async () => {
      await app.init();
      applyTheme(app.settings.theme);
      if (!/^#\/(exam|practice)/.test(location.hash)) dispatch();
    };
    renderAccountBadge(app.sync, auth);
  }
  window.addEventListener('hashchange', dispatch);
  await dispatch();
}
boot();

initInstall();
if (import.meta.env.PROD) {
  registerServiceWorker((apply) => {
    // never reload in the middle of a mock; offer again when they leave the exam screen
    const show = () => {
      if (document.body.dataset.route === 'exam-live') { window.addEventListener('hashchange', show, { once: true }); return; }
      updateBar(apply);
    };
    show();
  });
}

function updateBar(apply: () => void) {
  if (document.getElementById('update-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'update-bar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>A new version of CGL Prep is ready.</span><button class="btn sm primary">Update</button>';
  bar.querySelector('button')!.addEventListener('click', () => { bar.remove(); apply(); });
  document.body.append(bar);
}
