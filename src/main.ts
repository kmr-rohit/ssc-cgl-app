import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './ui/styles.css';
import { app } from './app/state';
import { dispatch, route } from './app/router';
import { loadManifest } from './content/bank';
import { applyTheme } from './ui/theme';
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
  await Promise.all([app.init(), loadManifest().catch((e) => console.error(e))]);
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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW failed', e)));
}
