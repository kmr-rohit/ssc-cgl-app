// Sign-in (Google, email link/code) and account actions. Works only when Supabase env is configured.
import type { User } from '@supabase/supabase-js';
import { supabase, redirectUrl, cleanAuthParams } from '../data/supabase';
import type { SyncedAdapter } from '../data/sync';

type Listener = (u: User | null) => void;
const listeners = new Set<Listener>();
const RETURN_KEY = 'cglprep:return-to';

export const auth = {
  enabled: !!supabase,
  user: null as User | null,
  ready: Promise.resolve() as Promise<void>,
  onChange(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); },
};

let adapter: SyncedAdapter | null = null;
const emit = () => listeners.forEach((f) => f(auth.user));

export function initAuth(sync: SyncedAdapter) {
  adapter = sync;
  if (!supabase) return;
  auth.ready = (async () => {
    const { data } = await supabase.auth.getSession(); // also completes a ?code= redirect (PKCE)
    auth.user = data.session?.user ?? null;
    cleanAuthParams();
    emit();
    if (auth.user) sync.attach(auth.user.id);
    const back = sessionStorage.getItem(RETURN_KEY);
    if (back && auth.user) { sessionStorage.removeItem(RETURN_KEY); if (location.hash !== back) location.hash = back; }
  })();
  supabase.auth.onAuthStateChange((event, session) => {
    const prev = auth.user?.id;
    auth.user = session?.user ?? null;
    // don't await Supabase calls inside this callback; defer them
    if (event === 'SIGNED_IN' && auth.user && auth.user.id !== prev) setTimeout(() => sync.attach(auth.user!.id), 0);
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') emit();
  });
}

/** Where to land after sign-in. A page that sends people to sign in (e.g. a challenge link) sets this first. */
export const setReturnTo = (hash: string) => { try { sessionStorage.setItem(RETURN_KEY, hash); } catch { /* ignore */ } };
const remember = () => {
  try {
    // signing in from the Account page keeps a return target set by the page that sent them there
    if (location.hash === '#/account' && sessionStorage.getItem(RETURN_KEY)) return;
    sessionStorage.setItem(RETURN_KEY, location.hash || '#/account');
  } catch { /* ignore */ }
};

export async function signInWithGoogle() {
  remember();
  const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
  if (error) throw new Error(error.message);
}

export async function sendEmailLink(email: string) {
  remember();
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } });
  if (!error) return;
  // "For security purposes, you can only request this after N seconds" = an email was just sent to this address.
  if (error.status === 429 && /for security purposes/i.test(error.message)) return;
  throw new Error(error.status === 429 ? 'Too many sign-in emails sent. Wait a few minutes and try again.' : error.message);
}

export async function verifyEmailCode(email: string, code: string) {
  const { error } = await supabase!.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  if (error) throw new Error(error.message.includes('expired') ? 'That code has expired. Send a new one.' : 'That code is not valid.');
}

/** Returns false if there were unsynced changes the user chose to keep (sign-out cancelled). */
export async function signOut(confirmLoss: () => Promise<boolean>) {
  const clean = await adapter!.beforeSignOut();
  if (!clean && !(await confirmLoss())) return false;
  await supabase!.auth.signOut();
  return true;
}

export async function deleteAccount() {
  const { error } = await supabase!.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw new Error('Could not delete your account. Check your connection and try again.');
  await supabase!.auth.signOut({ scope: 'local' });
  await adapter!.local.wipe();
}
