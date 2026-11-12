// Small "signed in / sync" badge in the desktop rail.
import type { SyncedAdapter } from '../data/sync';
import type { auth as Auth } from '../app/auth';
import { syncText } from '../views/account';

export function renderAccountBadge(sync: SyncedAdapter, auth: typeof Auth) {
  const el = document.getElementById('account-badge');
  if (!el) return;
  const draw = () => {
    const u = auth.user;
    el.replaceChildren();
    const b = document.createElement('b');
    b.textContent = u ? (u.email ?? 'Signed in') : 'Profile';
    const s = document.createElement('span');
    s.className = 'muted';
    s.textContent = u ? syncText(sync.status) : 'Sign in to sync · settings';
    el.append(b, s);
  };
  auth.onChange(draw);
  sync.onStatus(draw);
  draw();
}
