import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Report    = Database['public']['Tables']['audit_reports']['Row'];
type ReportIns = Database['public']['Tables']['audit_reports']['Insert'];

const LS_KEY = 'cms_audit_reports';

const fromLS = (): Report[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const toLS = (rows: Report[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

export async function getReports(orgId?: number): Promise<Report[]> {
  if (isSupabaseEnabled()) {
    let q = supabase!.from('audit_reports').select('*').order('created_at', { ascending: false });
    if (orgId) q = (q as any).eq('org_id', orgId);
    const { data, error } = await q;
    if (!error && data) return data as Report[];
  }
  const rows = fromLS();
  return orgId ? rows.filter(r => Number(r.org_id) === orgId) : rows;
}

export async function createReport(row: ReportIns): Promise<Report | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('audit_reports').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const rn = `RPT-${new Date().getFullYear()}-${String(rows.length + 1).padStart(4,'0')}`;
  const next: Report = { ...row as Report, id: `r-${Date.now()}`, report_number: row.report_number ?? rn, findings_count: row.findings_count ?? 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  toLS([...rows, next]);
  return next;
}

export async function updateReport(id: string, patch: Partial<ReportIns>): Promise<Report | null> {
  if (isSupabaseEnabled()) {
    const { data } = await (supabase as any).from('audit_reports').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (data) return data;
  }
  const rows = fromLS();
  const idx = rows.findIndex(r => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
  toLS(rows);
  return rows[idx];
}

export async function deleteReport(id: string): Promise<void> {
  if (isSupabaseEnabled()) {
    await (supabase as any).from('audit_reports').delete().eq('id', id);
    return;
  }
  toLS(fromLS().filter(r => r.id !== id));
}
