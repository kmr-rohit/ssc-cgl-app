// Indian-made type: Martel (headings), Mukta (body), Kalam (red-pen notes). Latin subsets only for now.
import '@fontsource/martel/latin-800.css';
import '@fontsource/martel/latin-900.css';
import '@fontsource/mukta/latin-400.css';
import '@fontsource/mukta/latin-500.css';
import '@fontsource/mukta/latin-600.css';
import '@fontsource/mukta/latin-700.css';
import '@fontsource/kalam/latin-700.css';
import 'katex/dist/katex.min.css';
import './ui/styles.css';
import { app } from './app/state';
import { dispatch, route } from './app/router';
import { loadManifest } from './content/bank';
import { loadPyqManifest } from './content/pyq';
import { applyTheme } from './ui/theme';
import { initInstall, registerServiceWorker } from './ui/install';
import { initAuth, auth } from './app/auth';
import { renderAccountBadge } from './ui/account-badge';
import { confirmDialog } from './ui/components';

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
route('/c/:code', 'mocks', 'Challenge', '#/mocks', v(() => import('./views/challenge')));
route('/build', 'mocks', 'Build a test', '#/mocks', v(() => import('./views/builder')));
route('/exam/:key', 'mocks', 'Mock test', '#/mocks', v(() => import('./views/exam')));
route('/result/:key', 'mocks', 'Result', '#/mocks', v(() => import('./views/result')));
route('/progress', 'progress', 'Progress', null, v(() => import('./views/analysis')));
route('/analysis', 'progress', 'Progress', null, v(() => import('./views/analysis')));
route('/mistakes', 'progress', 'My mistakes', '#/progress', v(() => import('./views/mistakes')));
route('/profile', '', 'Profile', '#/', v(() => import('./views/settings')));
route('/settings', '', 'Profile', '#/', v(() => import('./views/settings')));
route('/account', '', 'Account', '#/profile', v(() => import('./views/account')));
route('/admin', '', 'Admin', '#/profile', v(() => import('./views/admin')));


async function boot() {
  await Promise.all([app.init(), loadManifest().catch((e) => console.error(e)), loadPyqManifest()]);
  applyTheme(app.settings.theme);
  if (app.sync) {
    initAuth(app.sync);
    // server data arrived: reload in-memory state and redraw, unless the user is mid-test or mid-practice.
    // reset = local data was wiped (account switch or deletion): always leave a test, it belonged to the old data.
    app.sync.onPulled = async (reset) => {
      await app.init();
      applyTheme(app.settings.theme);
      const busy = /^#\/(exam|practice)/.test(location.hash);
      if (reset && busy) location.hash = '#/';
      else if (!busy) dispatch();
    };
    app.sync.confirmCarryOver = (n) => confirmDialog(
      `This device has ${n} ${n === 1 ? 'change' : 'changes'} not yet uploaded to the account last used here. Add ${n === 1 ? 'it' : 'them'} to the account you just signed in with? If you cancel, ${n === 1 ? 'it stays' : 'they stay'} on this device and ${n === 1 ? 'uploads' : 'upload'} when that other account signs in here again.`,
      'Add to this account');
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
