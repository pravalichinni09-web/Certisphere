import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Finding    = Database['public']['Tables']['audit_findings']['Row'];
type FindingIns = Database['public']['Tables']['audit_findings']['Insert'];

const LS_KEY = 'cms_audit_findings_v1';

const fromLS = (): Finding[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const toLS = (rows: Finding[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

export async function getFindings(orgId?: number): Promise<Finding[]> {
  if (isSupabaseEnabled()) {
    let q = supabase!.from('audit_findings').select('*').order('created_at', { ascending: false });
    if (orgId) q = (q as any).eq('org_id', orgId);
    const { data, error } = await q;
    if (!error && data) return data as Finding[];
  }
  const rows = fromLS();
  return orgId ? rows.filter(f => Number(f.org_id) === orgId) : rows;
}

export async function getFindingById(id: string): Promise<Finding | null> {
  if (isSupabaseEnabled()) {
    const { data } = await (supabase as any).from('audit_findings').select('*').eq('id', id).single();
    if (data) return data;
  }
  return fromLS().find(f => f.id === id) ?? null;
}

export async function createFinding(row: FindingIns): Promise<Finding | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('audit_findings').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const next: Finding = {
    ...row as Finding,
    id: `f-${Date.now()}`,
    closed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  toLS([...rows, next]);
  return next;
}

export async function updateFinding(id: string, patch: Partial<FindingIns>): Promise<Finding | null> {
  if (isSupabaseEnabled()) {
    const { data } = await (supabase as any).from('audit_findings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (data) return data;
  }
  const rows = fromLS();
  const idx = rows.findIndex(f => f.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
  toLS(rows);
  return rows[idx];
}

export async function deleteFinding(id: string): Promise<void> {
  if (isSupabaseEnabled()) {
    await (supabase as any).from('audit_findings').delete().eq('id', id);
    return;
  }
  toLS(fromLS().filter(f => f.id !== id));
}
