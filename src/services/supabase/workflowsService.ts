import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Workflow    = Database['public']['Tables']['audit_workflows']['Row'];
type WorkflowIns = Database['public']['Tables']['audit_workflows']['Insert'];

const LS_KEY = 'cms_audit_workflow';

const fromLS = (): Workflow[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const toLS = (rows: Workflow[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

export async function getWorkflows(orgId?: number): Promise<Workflow[]> {
  if (isSupabaseEnabled()) {
    let q = supabase!.from('audit_workflows').select('*').order('created_at', { ascending: false });
    if (orgId) q = (q as any).eq('org_id', orgId);
    const { data, error } = await q;
    if (!error && data) return data as Workflow[];
  }
  const rows = fromLS();
  return orgId ? rows.filter(w => Number(w.org_id) === orgId) : rows;
}

export async function createWorkflow(row: WorkflowIns): Promise<Workflow | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('audit_workflows').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const next: Workflow = { ...row as Workflow, id: `wf-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  toLS([...rows, next]);
  return next;
}

export async function updateWorkflow(id: string, patch: Partial<WorkflowIns>): Promise<Workflow | null> {
  if (isSupabaseEnabled()) {
    const { data } = await (supabase as any).from('audit_workflows').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (data) return data;
  }
  const rows = fromLS();
  const idx = rows.findIndex(w => w.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
  toLS(rows);
  return rows[idx];
}

export async function deleteWorkflow(id: string): Promise<void> {
  if (isSupabaseEnabled()) {
    await (supabase as any).from('audit_workflows').delete().eq('id', id);
    return;
  }
  toLS(fromLS().filter(w => w.id !== id));
}
