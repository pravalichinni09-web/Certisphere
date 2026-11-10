/**
 * liveAuth — real accounts for the live site (Supabase Auth)
 * ----------------------------------------------------------------------
 * Live mode  = Supabase is configured (VITE_SUPABASE_URL / _ANON_KEY) and
 *              VITE_DEMO_MODE is not "true". Every person signs in with their
 *              own email + password; their role comes from the server-side
 *              `profiles` table and cannot be changed from the browser.
 * Demo mode  = no Supabase (e.g. plain `npm run dev`): one-click demo role
 *              logins and sample data, for testing only.
 */
import { supabase, isSupabaseEnabled } from './supabase';

export type AppRole =
  | 'Management' | 'Audit Coordinator' | 'Lead Auditor' | 'Auditor' | 'Auditee' | 'Client Coordinator';

export interface LiveProfile {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  clientId: number | null;
}

export const isLiveMode = (): boolean =>
  isSupabaseEnabled() && String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() !== 'true';
export const isDemoMode = (): boolean => !isLiveMode();

const loadProfile = async (userId: string): Promise<{ profile: LiveProfile | null; error: string | null }> => {
  const { data, error } = await supabase!
    .from('profiles')
    .select('id, email, full_name, role, client_id, active')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { profile: null, error: 'Could not load your account. Please try again.' };
  if (!data) return { profile: null, error: 'Your account has not been given access to CertiSphere yet. Contact your administrator.' };
  if (!data.active) return { profile: null, error: 'Your account is disabled. Contact your administrator.' };
  return {
    profile: { id: data.id, email: data.email, fullName: data.full_name || data.email, role: data.role as AppRole, clientId: data.client_id ?? null },
    error: null,
  };
};

/** Sign in with email + password. Signs straight back out if the account has no active profile. */
export const liveSignIn = async (email: string, password: string): Promise<{ profile: LiveProfile | null; error: string | null }> => {
  if (!supabase) return { profile: null, error: 'Live sign-in is not configured.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) {
    const msg = /invalid login/i.test(error?.message || '') ? 'Incorrect email or password.' : (error?.message || 'Sign-in failed.');
    return { profile: null, error: msg };
  }
  const res = await loadProfile(data.user.id);
  if (!res.profile) await supabase.auth.signOut();
  return res;
};

/** The signed-in user's profile, or null (used when the page loads or refreshes). */
export const currentLiveProfile = async (): Promise<LiveProfile | null> => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  const res = await loadProfile(data.session.user.id);
  if (!res.profile) { await supabase.auth.signOut(); return null; }
  return res.profile;
};

export const liveSignOut = async (): Promise<void> => {
  if (supabase) await supabase.auth.signOut();
};

/** Sends a password-reset email that links back to /reset-password. */
export const sendPasswordReset = async (email: string): Promise<string | null> => {
  if (!supabase) return 'Not available in demo mode.';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return error ? error.message : null;
};

export const setNewPassword = async (password: string): Promise<string | null> => {
  if (!supabase) return 'Not available in demo mode.';
  const { error } = await supabase.auth.updateUser({ password });
  return error ? error.message : null;
};

/** fetch() to our own /api functions with the user's access token attached. */
export const apiFetch = async (path: string, body?: unknown, method = 'POST'): Promise<{ ok: boolean; status: number; data: any }> => {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  const res = await fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { ok: res.ok, status: res.status, data };
};
