import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Notif    = Database['public']['Tables']['notifications']['Row'];
type NotifIns = Database['public']['Tables']['notifications']['Insert'];

const LS_KEY = 'cms_notifications_v1';

const fromLS = (): Notif[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const toLS = (rows: Notif[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

export async function getNotifications(userId?: string, role?: string, orgId?: number): Promise<Notif[]> {
  if (isSupabaseEnabled()) {
    let q = supabase!.from('notifications').select('*').order('created_at', { ascending: false });
    if (userId) q = q.or(`user_id.eq.${userId},user_id.is.null`);
    const { data, error } = await q;
    if (!error && data) return data;
  }
  let rows = fromLS();
  if (role)  rows = rows.filter(n => !n.role  || n.role  === role);
  if (orgId) rows = rows.filter(n => !n.org_id || n.org_id === orgId);
  return rows;
}

export async function createNotification(row: NotifIns): Promise<Notif | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('notifications').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const next: Notif = { ...row as Notif, id: Date.now(), read: false, created_at: new Date().toISOString() };
  toLS([next, ...rows]);
  return next;
}

export async function markNotificationRead(id: number): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('notifications').update({ read: true }).eq('id', id);
    return !error;
  }
  toLS(fromLS().map(n => n.id === id ? { ...n, read: true } : n));
  return true;
}

export async function markAllNotificationsRead(role?: string): Promise<boolean> {
  if (isSupabaseEnabled()) {
    let q = supabase!.from('notifications').update({ read: true }).eq('read', false);
    if (role) q = q.eq('role', role);
    const { error } = await q;
    return !error;
  }
  toLS(fromLS().map(n => (!role || n.role === role) ? { ...n, read: true } : n));
  return true;
}
