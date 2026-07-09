/// <reference types="vite/client" />
/**
 * src/lib/supabase.ts
 * -------------------
 * Supabase client singleton for CertiSphere.
 *
 * Keys are read from Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 * If they are absent the client is null — all service functions fall back to
 * localStorage so the app keeps working in demo / offline mode.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function isConfigured(): boolean {
  if (!url || !key) return false;
  // Reject obvious placeholder / test values that would only produce
  // 'Invalid API key' at runtime.
  const lowKey = key.toLowerCase();
  const lowUrl = url.toLowerCase();
  if (lowUrl.includes('your-project-id') || lowUrl.includes('example.com')) return false;
  if (lowKey.includes('your-anon-public-key') || lowKey === 'test' || lowKey.length < 30) return false;
  // Supabase anon keys are JWTs starting with 'eyJ'
  if (!key.startsWith('eyJ')) return false;
  return true;
}

export const supabase: SupabaseClient | null = isConfigured()
  ? createClient(url!, key!)
  : null;

/** Returns true when Supabase is properly wired up. */
export const isSupabaseEnabled = (): boolean => supabase !== null;
