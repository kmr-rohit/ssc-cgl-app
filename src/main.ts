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

route('/', 'today', () => import('./views/today').then((m) => m.default));
route('/syllabus/:subject?', 'syllabus', () => import('./views/syllabus').then((m) => m.default));
route('/topic/:id/:tab?', 'syllabus', () => import('./views/topic').then((m) => m.default));
route('/practice', 'syllabus', () => import('./views/practice').then((m) => m.default));
route('/mocks', 'mocks', () => import('./views/mocks').then((m) => m.default));
route('/exam/:key', 'mocks', () => import('./views/exam').then((m) => m.default));
route('/result/:key', 'mocks', () => import('./views/result').then((m) => m.default));
route('/analysis', 'analysis', () => import('./views/analysis').then((m) => m.default));
route('/revise/:deck?', 'revise', () => import('./views/revise').then((m) => m.default));
route('/formulas/:id?', 'revise', () => import('./views/formulas').then((m) => m.default));
route('/plan', 'today', () => import('./views/plan').then((m) => m.default));
route('/account', 'settings', () => import('./views/account').then((m) => m.default));
route('/settings', 'settings', () => import('./views/settings').then((m) => m.default));


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
