import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Schedule    = Database['public']['Tables']['audit_schedules']['Row'];
type ScheduleIns = Database['public']['Tables']['audit_schedules']['Insert'];

const LS_KEY = 'cms_audit_schedules_v3';

const fromLS = (): Schedule[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const toLS = (rows: Schedule[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

export async function getSchedules(orgId?: number): Promise<Schedule[]> {
  if (isSupabaseEnabled()) {
    let q = supabase!.from('audit_schedules').select('*').order('scheduled_date', { ascending: true });
    if (orgId) q = q.eq('org_id', orgId);
    const { data, error } = await q;
    if (!error && data) return data;
  }
  const rows = fromLS();
  return orgId ? rows.filter(s => Number(s.org_id) === orgId) : rows;
}

export async function getScheduleById(id: string): Promise<Schedule | null> {
  if (isSupabaseEnabled()) {
    const { data } = await (supabase as any).from('audit_schedules').select('*').eq('id', id).single();
    if (data) return data;
  }
  return fromLS().find(s => s.id === id) ?? null;
}

export async function createSchedule(row: ScheduleIns): Promise<Schedule | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('audit_schedules').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const next: Schedule = { ...row as Schedule, id: `s-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  toLS([...rows, next]);
  return next;
}

export async function updateSchedule(id: string, patch: Partial<ScheduleIns>): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('audit_schedules').update(patch).eq('id', id);
    return !error;
  }
  toLS(fromLS().map(s => s.id === id ? { ...s, ...patch, updated_at: new Date().toISOString() } : s));
  return true;
}

export async function deleteSchedule(id: string): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('audit_schedules').delete().eq('id', id);
    return !error;
  }
  toLS(fromLS().filter(s => s.id !== id));
  return true;
}
