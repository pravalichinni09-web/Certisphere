/**
 * src/services/supabase/authService.ts
 * ──────────────────────────────────────
 * Supabase Auth wrapper.
 * Falls back to the hard-coded demo credentials when Supabase is not configured.
 */
import { supabase, isSupabaseEnabled } from '../../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  fullName?: string;
  orgId?: number | null;
}

/** Hard-coded demo credentials (used when Supabase is not configured). */
const DEMO_USERS: Array<{ email: string; password: string; role: string; fullName: string }> = [
  { email: 'management@cms.com',  password: 'Manage123!@#',   role: 'Management',         fullName: 'Admin User' },
  { email: 'coordinator@cms.com', password: 'AuditCoord@123', role: 'Audit Coordinator',  fullName: 'Audit Coordinator' },
  { email: 'lead@cms.com',        password: 'LeadAudit@123',  role: 'Lead Auditor',       fullName: 'Lead Auditor' },
  { email: 'auditor@cms.com',     password: 'Auditor@123',    role: 'Auditor',            fullName: 'Auditor' },
  { email: 'client@cms.com',      password: 'AuditClient@123',role: 'Auditee',            fullName: 'Client User' },
  { email: 'coord.client@cms.com',password: 'ClientCoord@123',role: 'Client Coordinator', fullName: 'Client Coordinator' },
];

export interface SignInResult {
  user: AuthUser | null;
  error: string | null;
}

/**
 * Sign in with email + password.
 * Uses Supabase Auth when configured; falls back to demo credentials.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error: error.message };

    // Fetch role from public.users profile table
    const { data: profile } = await supabase!
      .from('users')
      .select('role, full_name, org_id')
      .eq('id', data.user.id)
      .single();

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        role: profile?.role ?? 'Auditee',
        fullName: profile?.full_name ?? undefined,
        orgId: profile?.org_id ?? null,
      },
      error: null,
    };
  }

  // ── Demo fallback ────────────────────────────────────────────
  const match = DEMO_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!match) return { user: null, error: 'Invalid email or password.' };

  return {
    user: { id: 'demo-' + match.role.replace(/\s+/g,'-').toLowerCase(), email: match.email, role: match.role, fullName: match.fullName },
    error: null,
  };
}

/** Sign out. */
export async function signOut(): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabase!.auth.signOut();
  }
}

/** Get the currently authenticated user (Supabase session). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseEnabled()) return null;
  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return null;
  const { data: profile } = await (supabase as any).from('users').select('role, full_name, org_id').eq('id', user.id).single();
  return {
    id: user.id,
    email: user.email!,
    role: profile?.role ?? 'Auditee',
    fullName: profile?.full_name ?? undefined,
    orgId: profile?.org_id ?? null,
  };
}

/**
 * Create a user in Supabase Auth + matching row in public.users.
 * Called when Management creates a new auditor/auditee account.
 */
export async function createUser(params: {
  email: string;
  password: string;
  role: string;
  fullName?: string;
  orgId?: number | null;
}): Promise<{ userId: string | null; error: string | null }> {
  if (!isSupabaseEnabled()) {
    console.warn('[CertiSphere] Supabase not configured — user creation skipped (demo mode)');
    return { userId: 'demo-' + Date.now(), error: null };
  }

  // Use admin API only available server-side normally; for client-side we use signUp
  const { data, error } = await supabase!.auth.signUp({ email: params.email, password: params.password });
  if (error || !data.user) return { userId: null, error: error?.message ?? 'Signup failed' };

  await (supabase as any).from('users').insert({
    id: data.user.id,
    email: params.email,
    role: params.role,
    full_name: params.fullName ?? null,
    org_id: params.orgId ?? null,
    status: 'Active',
  });

  return { userId: data.user.id, error: null };
}
