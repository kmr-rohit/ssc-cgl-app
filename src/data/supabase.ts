// Supabase client (browser). Null when env is not configured, so the app still runs local-only.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, {
      auth: {
        flowType: 'pkce',          // ?code=… in the query string; our hash router is untouched
        detectSessionInUrl: true,  // exchanges the code automatically after Google / magic-link redirect
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// exposed in dev only, so e2e tests can assert they talk to the local stack
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __sbUrl?: string }).__sbUrl = url ?? '';

/** Where auth redirects come back to (must be in the Supabase redirect allow-list). */
export const redirectUrl = () => `${location.origin}/`;

/** Remove ?code= / auth error params from the address bar after the client has consumed them. */
export function cleanAuthParams() {
  const u = new URL(location.href);
  let changed = false;
  for (const k of ['code', 'error', 'error_code', 'error_description', 'sb_flow_id']) if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; }
  if (changed) history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
}
