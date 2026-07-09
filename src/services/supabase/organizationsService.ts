import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Org    = Database['public']['Tables']['organizations']['Row'];
type OrgIns = Database['public']['Tables']['organizations']['Insert'];

const LS_KEY = 'cms_client_registrations';

// ── helpers ────────────────────────────────────────────────────────────────
const fromLS = (): Org[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const toLS = (rows: Org[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

// ── public API ─────────────────────────────────────────────────────────────
export async function getOrganizations(): Promise<Org[]> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('organizations').select('*').order('name');
    if (!error && data) return data;
  }
  return fromLS();
}

export async function getOrganizationById(id: number): Promise<Org | null> {
  if (isSupabaseEnabled()) {
    const { data } = await (supabase as any).from('organizations').select('*').eq('id', id).single();
    if (data) return data;
  }
  return fromLS().find(o => o.id === id) ?? null;
}

export async function createOrganization(row: OrgIns): Promise<Org | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('organizations').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const next: Org = { ...row as Org, id: Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  toLS([...rows, next]);
  return next;
}

export async function updateOrganization(id: number, patch: Partial<OrgIns>): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('organizations').update(patch).eq('id', id);
    return !error;
  }
  const rows = fromLS().map(o => o.id === id ? { ...o, ...patch, updated_at: new Date().toISOString() } : o);
  toLS(rows);
  return true;
}

export async function deleteOrganization(id: number): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('organizations').delete().eq('id', id);
    return !error;
  }
  toLS(fromLS().filter(o => o.id !== id));
  return true;
}
