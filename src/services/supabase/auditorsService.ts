import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Auditor    = Database['public']['Tables']['auditors']['Row'];
type AuditorIns = Database['public']['Tables']['auditors']['Insert'];

const LS_KEY = 'cms_auditors_data';

const fromLS = (): Auditor[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || localStorage.getItem('cms_auditors') || '[]'); } catch { return []; }
};
const toLS = (rows: Auditor[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

export async function getAuditors(): Promise<Auditor[]> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('auditors').select('*').order('name');
    if (!error && data) return data;
  }
  return fromLS();
}

export async function getAuditorById(id: number): Promise<Auditor | null> {
  if (isSupabaseEnabled()) {
    const { data } = await (supabase as any).from('auditors').select('*').eq('id', id).single();
    if (data) return data;
  }
  return fromLS().find(a => a.id === id) ?? null;
}

export async function createAuditor(row: AuditorIns): Promise<Auditor | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('auditors').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const next: Auditor = { ...row as Auditor, id: Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  toLS([...rows, next]);
  return next;
}

export async function updateAuditor(id: number, patch: Partial<AuditorIns>): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('auditors').update(patch).eq('id', id);
    return !error;
  }
  toLS(fromLS().map(a => a.id === id ? { ...a, ...patch, updated_at: new Date().toISOString() } : a));
  return true;
}

export async function deleteAuditor(id: number): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('auditors').delete().eq('id', id);
    return !error;
  }
  toLS(fromLS().filter(a => a.id !== id));
  return true;
}

export async function updateAuditorApproval(
  id: number,
  status: 'Approved' | 'Rejected',
  approvedBy: string,
  notes?: string
): Promise<boolean> {
  const patch: Partial<AuditorIns> = {
    approval_status: status,
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
    approval_notes: notes ?? null,
  };
  return updateAuditor(id, patch);
}
